/**
 * Lead approvals this month compared to last month.
 *
 * Answers: Did we win more this month than last?
 *
 * Uses:
 *   - useLeadOutcomeData: approvedThisMonth, approvedLastMonth, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useLeadOutcomeData from '../Data/useLeadOutcomeData'

export default (props) => {
  const d = useLeadOutcomeData()

  return {
    widget: 'MetricDelta',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { Leads: 'Read' },
    title: 'Approved this month',
    caption: 'vs last month',
    data: computed(() => ({
      value: d.approvedThisMonth.value,
      compare: d.approvedLastMonth.value,
      empty: d.approvedThisMonth.value === 0 && d.approvedLastMonth.value === 0,
      loading: d.loading.value
    }))
  }
}
