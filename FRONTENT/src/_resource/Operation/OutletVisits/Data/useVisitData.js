/**
 * Planned, overdue, completed and scheduled visits across outlets.
 * Field operations track visits today, week ahead, cadence coverage, outcomes, and response delay.
 *
 * Reads:
 *   OutletVisits: Date, RespondDate, Progress, ProgressCompletedBy, Status, OutletCode
 *   Outlets (through useOutletResource): Code, Name, Status, visitFrequencyDays
 *   OutletOperatingRules (through useOutletOperatingRulesResource / useVisitCadence): rules and defaults
 *
 * Exposes:
 *   loading             - true while OutletVisits or Outlets is loading and has no rows
 *   visitsTodayCount    - PLANNED visits dated today
 *   visitsTomorrowCount - PLANNED visits dated tomorrow
 *   overdueVisitsCount  - PLANNED visits with Date before today
 *   overdueVisits7DaysAgo - PLANNED visits with Date before today-7 days
 *   outletsDueForVisit  - active outlets past frequency sorted by days, followed by never-visited, top 8
 *   visitedOutlets30Days - active outlets with a COMPLETED visit in the last 30 days
 *   totalActiveOutlets  - all active outlets count
 *   weekAhead           - PLANNED visits per day for today+0..+6, with short weekday labels
 *   respondedCount      - total count of responded visits (base count for visitOutcomes)
 *   visitOutcomes       - counts of COMPLETED, POSTPONED, CANCELLED inside chosen range
 *   completedCount      - total count of completed visits (base count for visitsByPerson)
 *   visitsByPerson      - COMPLETED visits inside range grouped by ProgressCompletedBy
 *   respondDelay        - responded visits in 3 bands: On time (<=0), 1-5 days late, Over 5 days late
 *   completedThisMonth  - COMPLETED visits responded/dated this month
 *   completedLastMonth  - COMPLETED visits responded/dated last month
 *   visitsPerDay        - 30 daily points of COMPLETED visits over last 30 days
 *   range               - ref holding chosen range word
 *   controls            - array containing range control
 *
 * Controls:
 *   range: menu picker, $last7Days / $last30Days / $last90Days / $thisMonth / $lastMonth,
 *          changes the window visitOutcomes and visitsByPerson count in
 */

import { ref, computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import { dataControl } from 'src/composables/data/useDataControls'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useOutletOperatingRulesResource } from 'src/_resource/Master/OutletOperatingRules/composables/useOutletOperatingRulesResource'
import {
  isActiveRow,
  isPlanned,
  isResponded,
  respondDelayDays,
  visitFrequencyFor,
  COMPLETED,
  POSTPONED,
  CANCELLED,
  progressOf
} from './_shared'

const DAY = 24 * 60 * 60 * 1000
const dayKey = (t) => new Date(t).toISOString().slice(0, 10)
const todayISO = () => new Date().toISOString().slice(0, 10)
const RANGES = ['$last7Days', '$last30Days', '$last90Days', '$thisMonth', '$lastMonth']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function toMidnightDate (value) {
  if (!value) return null
  const str = String(value).slice(0, 10)
  const d = new Date(`${str}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function daysDiff (fromMidnight, toMidnight) {
  return Math.round((toMidnight - fromMidnight) / DAY)
}

export default function useVisitData () {
  const { rows, isLoading, remember } = useRecord()
  const { countAt, daysAgo, daysSince, inRange, rangeLabel, topN } = useDataContext()
  const { activeOutlets } = useOutletResource()
  const { rulesByOutletMap } = useOutletOperatingRulesResource()

  return remember('useVisitData', () => {
    const loading = computed(() =>
      (isLoading('OutletVisits') && rows('OutletVisits').length === 0) ||
      (isLoading('Outlets') && rows('Outlets').length === 0)
    )

    const activeVisits = computed(() => rows('OutletVisits').filter(isActiveRow))
    const plannedVisits = computed(() => activeVisits.value.filter(isPlanned))
    const completedVisits = computed(() => activeVisits.value.filter((r) => progressOf(r) === COMPLETED))
    const respondedVisits = computed(() => activeVisits.value.filter(isResponded))

    const respondedCount = computed(() => respondedVisits.value.length)
    const completedCount = computed(() => completedVisits.value.length)

    // Today and tomorrow planned
    const visitsTodayCount = computed(() => {
      const today = todayISO()
      return plannedVisits.value.filter((r) => String(r.Date || '').slice(0, 10) === today).length
    })

    const visitsTomorrowCount = computed(() => {
      const tomorrow = new Date(Date.now() + DAY).toISOString().slice(0, 10)
      return plannedVisits.value.filter((r) => String(r.Date || '').slice(0, 10) === tomorrow).length
    })

    // Overdue planned visits: Date before today
    const overdueVisitsCount = computed(() => {
      const today = todayISO()
      return plannedVisits.value.filter((r) => {
        const d = String(r.Date || '').slice(0, 10)
        return d && d < today
      }).length
    })

    // Overdue visits 7 days ago: Date before today-7
    const overdueVisits7DaysAgo = computed(() => {
      const sevenDaysAgo = new Date(Date.now() - 7 * DAY).toISOString().slice(0, 10)
      return plannedVisits.value.filter((r) => {
        const d = String(r.Date || '').slice(0, 10)
        return d && d < sevenDaysAgo
      }).length
    })

    // Week ahead: today+0..+6
    const weekAhead = computed(() => {
      const now = new Date()
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const counts = [0, 0, 0, 0, 0, 0, 0]
      const labels = []

      for (let i = 0; i < 7; i++) {
        const d = new Date(todayMidnight.getTime() + i * DAY)
        labels.push(WEEKDAYS[d.getDay()])
      }

      for (const r of plannedVisits.value) {
        const visitDate = toMidnightDate(r.Date)
        if (!visitDate) continue
        const diff = daysDiff(todayMidnight, visitDate)
        if (diff >= 0 && diff < 7) {
          counts[diff]++
        }
      }

      return labels.map((label, i) => ({ label, value: counts[i] }))
    })

    // Outlets due for visit
    const outletsDueForVisit = computed(() => {
      const today = todayISO()
      const rules = rulesByOutletMap.value
      const plannedFutureOutlets = new Set()
      for (const r of plannedVisits.value) {
        const d = String(r.Date || '').slice(0, 10)
        if (d >= today) {
          plannedFutureOutlets.add(String(r.OutletCode || '').trim())
        }
      }

      // Latest completed visit date per outlet
      const lastCompletedDateByOutlet = new Map()
      for (const r of completedVisits.value) {
        const code = String(r.OutletCode || '').trim()
        if (!code) continue
        const dateStr = String(r.RespondDate || r.Date || '').slice(0, 10)
        if (!dateStr) continue
        const current = lastCompletedDateByOutlet.get(code)
        if (!current || dateStr > current) {
          lastCompletedDateByOutlet.set(code, dateStr)
        }
      }

      const overdueVisited = []
      const neverVisited = []
      const todayDate = toMidnightDate(today)

      for (const outlet of activeOutlets.value) {
        const code = outlet.code
        if (plannedFutureOutlets.has(code)) continue

        const freq = visitFrequencyFor(code, rules) || outlet.visitFrequencyDays || 0
        const lastDateStr = lastCompletedDateByOutlet.get(code)

        if (!lastDateStr) {
          neverVisited.push({
            label: outlet.name || code,
            value: 0,
            caption: 'Never visited',
            daysSinceVisit: 0
          })
        } else {
          const lastDate = toMidnightDate(lastDateStr)
          const days = lastDate ? daysDiff(lastDate, todayDate) : 0
          if (freq > 0 && days > freq) {
            overdueVisited.push({
              label: outlet.name || code,
              value: days,
              caption: `every ${freq} days`,
              daysSinceVisit: days
            })
          }
        }
      }

      overdueVisited.sort((a, b) => b.daysSinceVisit - a.daysSinceVisit)
      const remainingSlots = Math.max(0, 8 - overdueVisited.length)
      return [...overdueVisited.slice(0, 8), ...neverVisited.slice(0, remainingSlots)]
    })

    // Visit coverage: active outlets with COMPLETED visit in last 30 days vs total active outlets
    const totalActiveOutlets = computed(() => activeOutlets.value.length)
    const visitedOutlets30Days = computed(() => {
      const activeCodes = new Set(activeOutlets.value.map((o) => o.code))
      const visitedCodes = new Set()
      for (const r of completedVisits.value) {
        const code = String(r.OutletCode || '').trim()
        if (!activeCodes.has(code)) continue
        const d = r.RespondDate || r.Date
        if (inRange(d, '$last30Days')) {
          visitedCodes.add(code)
        }
      }
      return visitedCodes.size
    })

    // Controls
    const range = ref('$last30Days')
    const controls = [
      dataControl('range', {
        type: 'menu',
        options: RANGES.map((value) => ({ label: rangeLabel(value), value })),
        value: range
      })
    ]

    // Visit outcomes: COMPLETED, POSTPONED, CANCELLED by RespondDate (fallback Date) inside range
    const visitOutcomes = computed(() => {
      let completed = 0
      let postponed = 0
      let cancelled = 0

      for (const r of respondedVisits.value) {
        const d = r.RespondDate || r.Date
        if (!inRange(d, range.value)) continue
        const p = progressOf(r)
        if (p === COMPLETED) completed++
        else if (p === POSTPONED) postponed++
        else if (p === CANCELLED) cancelled++
      }

      return [
        { label: 'Completed', value: completed },
        { label: 'Postponed', value: postponed },
        { label: 'Cancelled', value: cancelled }
      ]
    })

    // Visits by person: COMPLETED visits inside range grouped by ProgressCompletedBy
    const visitsByPerson = computed(() => {
      const counts = new Map()
      for (const r of completedVisits.value) {
        const d = r.RespondDate || r.Date
        if (!inRange(d, range.value)) continue
        const person = String(r.ProgressCompletedBy || '').trim() || '(Unassigned)'
        counts.set(person, (counts.get(person) || 0) + 1)
      }
      return topN(counts, 8)
    })

    // Respond delay: responded visits in 3 bands: On time (<=0), 1-5 days late, Over 5 days late
    const respondDelay = computed(() => {
      let onTime = 0
      let late1to5 = 0
      let over5Late = 0

      for (const r of respondedVisits.value) {
        const delay = respondDelayDays(r)
        if (delay === null || delay === undefined) continue
        if (delay <= 0) onTime++
        else if (delay <= 5) late1to5++
        else over5Late++
      }

      return [
        { label: 'On time', value: onTime },
        { label: '1–5 days late', value: late1to5 },
        { label: 'Over 5 days late', value: over5Late }
      ]
    })

    // Completed this month vs last month by RespondDate (fallback Date)
    const completedThisMonth = computed(() => {
      return completedVisits.value.filter((r) => inRange(r.RespondDate || r.Date, '$thisMonth')).length
    })

    const completedLastMonth = computed(() => {
      return completedVisits.value.filter((r) => inRange(r.RespondDate || r.Date, '$lastMonth')).length
    })

    // Visits per day: COMPLETED visits per day, last 30 days
    const visitsPerDay = computed(() => {
      const now = Date.now()
      const days = new Map()
      for (let d = 29; d >= 0; d--) days.set(dayKey(now - d * DAY), 0)
      for (const r of completedVisits.value) {
        const d = r.RespondDate || r.Date
        const age = daysSince(d)
        if (age === null || age < 0) continue
        const key = dayKey(now - age * DAY)
        if (days.has(key)) days.set(key, days.get(key) + 1)
      }
      return [...days.entries()].map(([x, y]) => ({ x, y }))
    })

    return {
      loading,
      visitsTodayCount,
      visitsTomorrowCount,
      overdueVisitsCount,
      overdueVisits7DaysAgo,
      outletsDueForVisit,
      visitedOutlets30Days,
      totalActiveOutlets,
      weekAhead,
      respondedCount,
      visitOutcomes,
      completedCount,
      visitsByPerson,
      respondDelay,
      completedThisMonth,
      completedLastMonth,
      visitsPerDay,
      range,
      controls
    }
  })
}
