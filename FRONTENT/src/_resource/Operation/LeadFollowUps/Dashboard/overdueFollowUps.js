/**
 * Overdue follow-ups and those critically overdue past 7 days.
 *
 * Answers: How many talks are late, how many very late?
 *
 * Uses:
 *   - useFollowUpDueData: overdueCount, veryLateCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useFollowUpDueData from '../Data/useFollowUpDueData'

export default (props) => {
  const d = useFollowUpDueData()

  return {
    widget: 'MetricDeltaInverse',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { LeadFollowUps: 'Read' },
    title: 'Overdue follow-ups',
    caption: 'Over 7 days late',
    data: computed(() => ({
      value: d.overdueCount.value,
      compare: d.veryLateCount.value,
      empty: d.overdueCount.value === 0 && d.veryLateCount.value === 0,
      loading: d.loading.value
    }))
  }
}
