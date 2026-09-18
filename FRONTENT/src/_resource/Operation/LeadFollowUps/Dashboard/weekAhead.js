/**
 * Upcoming workload across the next seven calendar days.
 *
 * Answers: How busy is each of my next 7 days?
 *
 * Uses:
 *   - useFollowUpDueData: weekAhead, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useFollowUpDueData from '../Data/useFollowUpDueData'

export default (props) => {
  const d = useFollowUpDueData()

  return {
    widget: 'ColumnBar',
    size: { xs: [6, 12], sm: [6, 12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { LeadFollowUps: 'Read' },
    title: 'Week ahead',
    caption: 'Scheduled talks by day',
    data: computed(() => ({
      items: d.weekAhead.value,
      empty: !d.weekAhead.value.some((b) => b.value > 0),
      loading: d.loading.value
    }))
  }
}
