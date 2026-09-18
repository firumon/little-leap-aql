/**
 * Most recently approved leads timeline.
 *
 * Answers: Which leads did we win last?
 *
 * Uses:
 *   - useLeadOutcomeData: recentApprovals, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useLeadOutcomeData from '../Data/useLeadOutcomeData'

export default (props) => {
  const d = useLeadOutcomeData()

  return {
    widget: 'EventTimeline',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { Leads: 'Read' },
    title: 'Recent approvals',
    caption: 'Last won leads',
    data: computed(() => ({
      items: d.recentApprovals.value,
      empty: d.recentApprovals.value.length === 0,
      loading: d.loading.value
    }))
  }
}
