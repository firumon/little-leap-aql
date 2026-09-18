/**
 * Recency distribution of follow-up responses across standard activity bands.
 *
 * Answers: How long since we last heard back?
 *
 * Uses:
 *   - useFollowUpCoverageData: activityAgeing, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useFollowUpCoverageData from '../Data/useFollowUpCoverageData'

export default (props) => {
  const d = useFollowUpCoverageData()

  return {
    widget: 'DebtAgeing',
    size: { xs: [6, 12], sm: [6, 12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { LeadFollowUps: 'Read' },
    title: 'Activity ageing',
    caption: 'Time since response received',
    data: computed(() => ({
      items: d.activityAgeing.value,
      empty: !d.activityAgeing.value.some((b) => b.value > 0),
      loading: d.loading.value
    }))
  }
}
