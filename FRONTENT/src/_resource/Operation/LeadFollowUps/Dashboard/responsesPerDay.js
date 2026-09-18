/**
 * Daily trend of completed follow-up responses over the last 30 days.
 *
 * Answers: How many talks does the team close each day?
 *
 * Uses:
 *   - useFollowUpResponseData: responsesPerDay, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useFollowUpResponseData from '../Data/useFollowUpResponseData'

export default (props) => {
  const d = useFollowUpResponseData()

  return {
    widget: 'StaffVisitsLine',
    size: { xs: [12], sm: [12], md: [8, 12], lg: [6, 8, 12], xl: [6, 8] },
    permission: { LeadFollowUps: 'Read' },
    title: 'Responses per day',
    caption: 'Daily responses over last 30 days',
    data: computed(() => ({
      points: d.responsesPerDay.value,
      empty: !d.responsesPerDay.value.some((p) => p.y > 0),
      loading: d.loading.value
    }))
  }
}
