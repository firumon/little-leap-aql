/**
 * Upcoming follow-up appointments timeline.
 *
 * Answers: What are the next talks, and with whom?
 *
 * Uses:
 *   - useFollowUpDueData: nextFollowUps, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useFollowUpDueData from '../Data/useFollowUpDueData'

export default (props) => {
  const d = useFollowUpDueData()

  return {
    widget: 'EventTimeline',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { LeadFollowUps: 'Read', Leads: 'Read' },
    title: 'Next follow-ups',
    caption: 'Upcoming scheduled talks',
    data: computed(() => ({
      items: d.nextFollowUps.value,
      empty: d.nextFollowUps.value.length === 0,
      loading: d.loading.value
    }))
  }
}
