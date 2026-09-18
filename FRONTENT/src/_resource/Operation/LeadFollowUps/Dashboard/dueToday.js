/**
 * Follow-up tasks scheduled for today.
 *
 * Answers: What must be done today?
 *
 * Uses:
 *   - useFollowUpDueData: dueTodayCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useFollowUpDueData from '../Data/useFollowUpDueData'

export default (props) => {
  const d = useFollowUpDueData()

  return {
    widget: 'MetricPlain',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { LeadFollowUps: 'Read' },
    title: 'Due today',
    caption: 'Awaiting today',
    data: computed(() => ({
      value: d.dueTodayCount.value,
      empty: d.dueTodayCount.value === 0,
      loading: d.loading.value
    }))
  }
}
