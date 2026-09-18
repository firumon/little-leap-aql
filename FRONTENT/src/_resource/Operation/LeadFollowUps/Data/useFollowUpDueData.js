/**
 * Domain data composable for follow-up schedules, deadlines, and due queues.
 *
 * Reads:
 *   LeadFollowUps: Date, Progress, Purpose, LeadCode, RespondDate
 *   Leads: Code, Name
 *
 * Exposes:
 *   loading             - Boolean computed, true if LeadFollowUps or Leads is loading with 0 rows
 *   dueTodayCount       - Count of awaiting follow-ups scheduled for today
 *   overdueCount        - Total count of awaiting follow-ups past due date
 *   veryLateCount       - Count of awaiting follow-ups overdue by more than 7 days
 *   nextFollowUps       - Top 5 upcoming awaiting follow-ups for today and later ({ label, date, caption })
 *   weekAhead           - Array of 7 days ({ label: weekday, value: count }) from today
 *   dueAnsweredCount    - Count of due follow-ups that have a RespondDate
 *   dueTotalCount       - Total count of follow-ups that have come due (Date <= today)
 *   controls            - Empty array (no controls)
 *
 * Controls:
 *   none
 */

import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { parseAnyDate, toDateOnly } from 'src/utils/dateHelpers'
import { daysUntilFollowUp, isAwaiting, isOverdue } from './_shared'

const DAY = 24 * 60 * 60 * 1000
const toDateStr = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10)

export default function useFollowUpDueData() {
  const { rows, recordBy, isLoading, remember } = useRecord()

  return remember('useFollowUpDueData', () => {
    const loading = computed(() => {
      const fuLoading = isLoading('LeadFollowUps') && rows('LeadFollowUps').length === 0
      const leadsLoading = isLoading('Leads') && rows('Leads').length === 0
      return fuLoading || leadsLoading
    })

    const allFollowUps = computed(() => rows('LeadFollowUps'))

    const dueTodayCount = computed(() => {
      return allFollowUps.value.filter((r) => isAwaiting(r) && daysUntilFollowUp(r) === 0).length
    })

    const overdueList = computed(() => allFollowUps.value.filter(isOverdue))
    const overdueCount = computed(() => overdueList.value.length)

    const veryLateCount = computed(() => {
      return overdueList.value.filter((r) => {
        const days = daysUntilFollowUp(r)
        return days !== null && days < -7
      }).length
    })

    const awaitingFollowUps = computed(() => {
      return allFollowUps.value.filter((r) => isAwaiting(r) && r.Date && (daysUntilFollowUp(r) ?? -1) >= 0)
    })

    const nextFollowUps = computed(() => {
      const sorted = awaitingFollowUps.value
        .slice()
        .sort((a, b) => {
          const da = parseAnyDate(a.Date)?.getTime() || 0
          const db = parseAnyDate(b.Date)?.getTime() || 0
          return da - db
        })
        .slice(0, 5)

      return sorted.map((r) => {
        const lead = recordBy('Leads', 'Code', r.LeadCode)
        const label = lead?.Name || r.LeadCode || ''
        return {
          label,
          date: r.Date,
          caption: r.Purpose || ''
        }
      })
    })

    const weekAhead = computed(() => {
      const list = allFollowUps.value.filter(isAwaiting)
      const now = new Date()
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

      const days = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(todayMidnight + i * DAY)
        days.push({
          key: toDateStr(d),
          label: d.toLocaleDateString('en-US', { weekday: 'short' }),
          value: 0
        })
      }

      for (const r of list) {
        const parsed = parseAnyDate(r.Date)
        if (!parsed) continue
        const k = toDateStr(parsed)
        const target = days.find((d) => d.key === k)
        if (target) {
          target.value++
        }
      }

      return days.map(({ label, value }) => ({ label, value }))
    })

    const dueList = computed(() => {
      const today = toDateOnly(new Date())
      return allFollowUps.value.filter((r) => {
        const planned = toDateOnly(r.Date)
        return planned && planned <= today
      })
    })

    const dueTotalCount = computed(() => dueList.value.length)
    const dueAnsweredCount = computed(() => dueList.value.filter((r) => r.RespondDate).length)

    const controls = []

    return {
      loading,
      dueTodayCount,
      overdueCount,
      veryLateCount,
      nextFollowUps,
      weekAhead,
      dueAnsweredCount,
      dueTotalCount,
      controls
    }
  })
}
