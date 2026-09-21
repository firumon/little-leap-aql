/**
 * Consumptions awaiting invoice generation, count cadence tiers, monthly and daily counts.
 *
 * Reads:
 *   OutletConsumptions: Date, OutletCode, Progress, Status
 *   Outlets (through useOutletResource): Code, Name, Status, visitFrequencyDays
 *   OutletOperatingRules (through useOutletOperatingRulesResource): rules map
 *
 * Exposes:
 *   loading                    - true while OutletConsumptions or Outlets is loading and has no rows
 *   awaitingInvoiceCount       - active consumptions at PENDING_INVOICE_GENERATION
 *   oldestAwaitingInvoiceDays  - age in whole days of the oldest awaiting invoice consumption
 *   awaitingInvoiceAgeing      - awaiting invoice consumptions in 4 wait bands (from Restocks _shared)
 *   countCadence               - active outlets split across OVERDUE_TIERS by days since last consumption
 *   activeOutletsCount         - count of all active outlets
 *   countsThisMonth            - non-cancelled consumptions dated this month
 *   countsLastMonth            - non-cancelled consumptions dated last month
 *   countsPerDay               - non-cancelled consumptions per day, last 30 days
 *   controls                   - empty array
 *
 * Controls:
 *   none
 */

import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useOutletOperatingRulesResource } from 'src/_resource/Master/OutletOperatingRules/composables/useOutletOperatingRulesResource'
import {
  isActiveRow,
  isCancelled,
  progressOf,
  PENDING_INVOICE_GENERATION,
  OVERDUE_TIERS,
  overdueBandOf,
  visitFrequencyFor,
  bandCounts
} from './_shared'

const DAY = 24 * 60 * 60 * 1000
const dayKey = (t) => new Date(t).toISOString().slice(0, 10)
const todayISO = () => new Date().toISOString().slice(0, 10)

function toMidnightDate (value) {
  if (!value) return null
  const str = String(value).slice(0, 10)
  const d = new Date(`${str}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function daysDiff (fromMidnight, toMidnight) {
  return Math.round((toMidnight - fromMidnight) / DAY)
}

export default function useConsumptionData () {
  const { rows, isLoading, remember } = useRecord()
  const { daysSince, inRange } = useDataContext()
  const { activeOutlets } = useOutletResource()
  const { rulesByOutletMap } = useOutletOperatingRulesResource()

  return remember('useConsumptionData', () => {
    const loading = computed(() =>
      (isLoading('OutletConsumptions') && rows('OutletConsumptions').length === 0) ||
      (isLoading('Outlets') && rows('Outlets').length === 0)
    )

    const rawRows = computed(() => rows('OutletConsumptions'))
    const activeConsumptions = computed(() => rawRows.value.filter(isActiveRow))
    const nonCancelled = computed(() => activeConsumptions.value.filter((r) => !isCancelled(r)))

    // Awaiting invoice generation: active at PENDING_INVOICE_GENERATION
    const awaitingInvoiceList = computed(() =>
      activeConsumptions.value.filter((r) => progressOf(r) === PENDING_INVOICE_GENERATION)
    )
    const awaitingInvoiceCount = computed(() => awaitingInvoiceList.value.length)

    // Oldest awaiting invoice age in whole days
    const oldestAwaitingInvoiceDays = computed(() => {
      let maxAge = 0
      for (const r of awaitingInvoiceList.value) {
        const age = daysSince(r.Date)
        if (age !== null && age > maxAge) {
          maxAge = Math.round(age)
        }
      }
      return maxAge
    })

    // Awaiting invoice ageing: 4 wait bands using bandCounts
    const awaitingInvoiceAgeing = computed(() => {
      const ages = awaitingInvoiceList.value.map((r) => daysSince(r.Date))
      return bandCounts(ages)
    })

    // Count cadence: active outlets placed into OVERDUE_TIERS by days since last non-cancelled consumption vs frequency
    const activeOutletsCount = computed(() => activeOutlets.value.length)

    const countCadence = computed(() => {
      const rules = rulesByOutletMap.value
      const todayDate = toMidnightDate(todayISO())

      // Latest non-cancelled consumption date per outlet
      const lastConsumptionDateByOutlet = new Map()
      for (const r of nonCancelled.value) {
        const code = String(r.OutletCode || '').trim()
        if (!code) continue
        const dateStr = String(r.Date || '').slice(0, 10)
        if (!dateStr) continue
        const current = lastConsumptionDateByOutlet.get(code)
        if (!current || dateStr > current) {
          lastConsumptionDateByOutlet.set(code, dateStr)
        }
      }

      // Prepare tiers map in exact OVERDUE_TIERS order
      const tierCounts = OVERDUE_TIERS.map((tier) => ({
        label: tier.label,
        value: 0,
        color: tier.color
      }))

      for (const outlet of activeOutlets.value) {
        const code = outlet.code
        const lastDateStr = lastConsumptionDateByOutlet.get(code)
        const freq = visitFrequencyFor(code, rules) || outlet.visitFrequencyDays || 0

        if (!lastDateStr) {
          // Outlets never counted go into the last tier (Critical)
          tierCounts[tierCounts.length - 1].value++
        } else {
          const lastDate = toMidnightDate(lastDateStr)
          const days = lastDate ? daysDiff(lastDate, todayDate) : 0
          const band = overdueBandOf(days, freq)
          if (!band) {
            tierCounts[tierCounts.length - 1].value++
          } else {
            const idx = tierCounts.findIndex((t) => t.label === band.label)
            if (idx !== -1) tierCounts[idx].value++
            else tierCounts[tierCounts.length - 1].value++
          }
        }
      }

      return tierCounts
    })

    // Counts this month vs last month by Date
    const countsThisMonth = computed(() => {
      return nonCancelled.value.filter((r) => inRange(r.Date, '$thisMonth')).length
    })

    const countsLastMonth = computed(() => {
      return nonCancelled.value.filter((r) => inRange(r.Date, '$lastMonth')).length
    })

    // Counts per day, last 30 days
    const countsPerDay = computed(() => {
      const now = Date.now()
      const days = new Map()
      for (let d = 29; d >= 0; d--) days.set(dayKey(now - d * DAY), 0)

      for (const r of nonCancelled.value) {
        const age = daysSince(r.Date)
        if (age === null || age < 0) continue
        const key = dayKey(now - age * DAY)
        if (days.has(key)) days.set(key, days.get(key) + 1)
      }

      return [...days.entries()].map(([x, y]) => ({ x, y }))
    })

    const controls = []

    return {
      loading,
      awaitingInvoiceCount,
      oldestAwaitingInvoiceDays,
      awaitingInvoiceAgeing,
      countCadence,
      activeOutletsCount,
      countsThisMonth,
      countsLastMonth,
      countsPerDay,
      controls
    }
  })
}
