/**
 * Domain data composable for Leads outcome, conversion, and closure metrics.
 *
 * Reads:
 *   Leads: Progress, ProgressApprovedAt, ProgressRejectedAt, ProgressLaterAt, Name, Code, Type
 *
 * Exposes:
 *   loading             - Boolean computed, true if Leads resource is loading with 0 rows
 *   approvedThisMonth   - Count of approvals in current month
 *   approvedLastMonth   - Count of approvals in previous month
 *   conversionWon       - Count of approved leads (numerator for conversion rate)
 *   conversionTotal     - Count of closed leads (approved + rejected, denominator for conversion rate)
 *   monthOutcomes       - Array of outcome counts this month ([{ label: 'Approved', value }, ...])
 *   recentApprovals     - Top 5 recently approved leads ({ label, date, caption })
 *   controls            - Empty array (no controls)
 *
 * Controls:
 *   none
 */

import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import { APPROVED, REJECTED, progressOf } from './_shared'

export default function useLeadOutcomeData() {
  const { rows, isLoading, remember } = useRecord()
  const { countAt, inRange } = useDataContext()

  return remember('useLeadOutcomeData', () => {
    const loading = computed(() => isLoading('Leads') && rows('Leads').length === 0)

    const approvedThisMonth = computed(() => {
      return countAt(rows('Leads'), '$thisMonth', null, 'ProgressApprovedAt')
    })

    const approvedLastMonth = computed(() => {
      return countAt(rows('Leads'), '$lastMonth', null, 'ProgressApprovedAt')
    })

    const allLeads = computed(() => rows('Leads'))
    const approvedLeads = computed(() => allLeads.value.filter((r) => progressOf(r) === APPROVED))
    const rejectedLeads = computed(() => allLeads.value.filter((r) => progressOf(r) === REJECTED))

    const conversionWon = computed(() => approvedLeads.value.length)
    const conversionTotal = computed(() => approvedLeads.value.length + rejectedLeads.value.length)

    const monthOutcomes = computed(() => {
      const list = rows('Leads')
      const approved = list.filter((r) => inRange(r.ProgressApprovedAt, '$thisMonth')).length
      const rejected = list.filter((r) => inRange(r.ProgressRejectedAt, '$thisMonth')).length
      const later = list.filter((r) => inRange(r.ProgressLaterAt, '$thisMonth')).length

      return [
        { label: 'Approved', value: approved },
        { label: 'Rejected', value: rejected },
        { label: 'Later', value: later }
      ]
    })

    const recentApprovedLeads = computed(() => {
      return rows('Leads').filter((r) => progressOf(r) === APPROVED && r.ProgressApprovedAt)
    })

    const recentApprovals = computed(() => {
      return recentApprovedLeads.value
        .slice()
        .sort((a, b) => {
          const da = new Date(a.ProgressApprovedAt).getTime() || 0
          const db = new Date(b.ProgressApprovedAt).getTime() || 0
          return db - da
        })
        .slice(0, 5)
        .map((r) => ({
          label: r.Name || r.Code,
          date: r.ProgressApprovedAt,
          caption: r.Type || ''
        }))
    })

    const controls = []

    return {
      loading,
      approvedThisMonth,
      approvedLastMonth,
      conversionWon,
      conversionTotal,
      monthOutcomes,
      recentApprovals,
      controls
    }
  })
}
