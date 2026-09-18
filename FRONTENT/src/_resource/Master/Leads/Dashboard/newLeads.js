/**
 * New leads created recently compared to the previous week.
 *
 * Answers: Are new leads coming faster than last week?
 *
 * Uses:
 *   - useLeadIntakeData: newLeadsCount, newLeadsCompare, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useLeadIntakeData from '../Data/useLeadIntakeData'

export default (props) => {
  const d = useLeadIntakeData()

  return {
    widget: 'MetricDelta',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { Leads: 'Read' },
    title: 'New leads',
    caption: 'vs previous 7 days',
    data: computed(() => ({
      value: d.newLeadsCount.value,
      compare: d.newLeadsCompare.value,
      empty: d.newLeadsCount.value === 0 && d.newLeadsCompare.value === 0,
      loading: d.loading.value
    }))
  }
}
