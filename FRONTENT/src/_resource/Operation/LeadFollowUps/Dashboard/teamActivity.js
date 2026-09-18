/**
 * Recent team response activity over the past 48 hours.
 *
 * Answers: Who has been talking to leads in the last 48 hours?
 *
 * Uses:
 *   - useFollowUpTeamData: teamActivity, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useFollowUpTeamData from '../Data/useFollowUpTeamData'

export default (props) => {
  const d = useFollowUpTeamData()

  return {
    widget: 'HorizontalRankBar',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { LeadFollowUps: 'Read' },
    users: true,
    title: 'Team activity',
    caption: 'Active members in last 48h',
    data: computed(() => ({
      items: d.teamActivity.value,
      empty: d.teamActivity.value.length === 0,
      loading: d.loading.value
    }))
  }
}
