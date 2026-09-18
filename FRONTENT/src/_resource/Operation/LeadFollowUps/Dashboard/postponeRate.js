/**
 * Proportion of completed versus postponed and cancelled follow-ups.
 *
 * Answers: How often do we push a talk instead of doing it?
 *
 * Uses:
 *   - useFollowUpResponseData: postponeMix, totalRespondedCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useFollowUpResponseData from '../Data/useFollowUpResponseData'

export default (props) => {
  const d = useFollowUpResponseData()

  return {
    widget: 'HalfDonut',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { LeadFollowUps: 'Read' },
    title: 'Outcome mix',
    caption: 'Responded follow-up results',
    data: computed(() => ({
      items: d.postponeMix.value,
      empty: d.totalRespondedCount.value === 0,
      loading: d.loading.value
    }))
  }
}
