/**
 * Processing leads that have never received any follow-up entry.
 *
 * Answers: Which Processing leads has nobody talked to at all?
 *
 * Uses:
 *   - useFollowUpCoverageData: neverFollowedUp, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useFollowUpCoverageData from '../Data/useFollowUpCoverageData'

export default (props) => {
  const d = useFollowUpCoverageData()

  return {
    widget: 'LowStockList',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { LeadFollowUps: 'Read', Leads: 'Read' },
    widgetProps: { color: 'negative', valueFormat: (v) => v + ' days' },
    title: 'Never followed up',
    caption: 'Processing leads with no records',
    data: computed(() => ({
      items: d.neverFollowedUp.value,
      empty: d.neverFollowedUp.value.length === 0,
      loading: d.loading.value
    }))
  }
}
