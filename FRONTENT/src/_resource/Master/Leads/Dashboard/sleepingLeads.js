/**
 * Sleeping leads and how many have been asleep over 90 days.
 *
 * Answers: How many leads are asleep, and how many too long?
 *
 * Uses:
 *   - useLeadSleepData: sleepingCount, staleSleepingCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useLeadSleepData from '../Data/useLeadSleepData'

export default (props) => {
  const d = useLeadSleepData()

  return {
    widget: 'MetricDeltaInverse',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { Leads: 'Read' },
    title: 'Sleeping leads',
    caption: 'Over 90 days asleep',
    data: computed(() => ({
      value: d.sleepingCount.value,
      compare: d.staleSleepingCount.value,
      empty: d.sleepingCount.value === 0 && d.staleSleepingCount.value === 0,
      loading: d.loading.value
    }))
  }
}
