/**
 * Average delay in responding to follow-ups.
 *
 * Answers: How many days late do we answer, on average?
 *
 * Uses:
 *   - useFollowUpResponseData: respondDelayThisMonth, respondDelayLastMonth, thisMonthResponseCount, lastMonthResponseCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useFollowUpResponseData from '../Data/useFollowUpResponseData'

export default (props) => {
  const d = useFollowUpResponseData()

  return {
    widget: 'MetricDeltaInverse',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { LeadFollowUps: 'Read' },
    title: 'Response delay',
    caption: 'vs last month',
    data: computed(() => ({
      value: d.respondDelayThisMonth.value,
      compare: d.respondDelayLastMonth.value,
      empty: d.thisMonthResponseCount.value === 0 && d.lastMonthResponseCount.value === 0,
      loading: d.loading.value
    }))
  }
}
