/**
 * Open leads grouped by lead type.
 *
 * Answers: Which kind of lead do we have most of?
 *
 * Uses:
 *   - useLeadPipelineData: leadsByType, openCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useLeadPipelineData from '../Data/useLeadPipelineData'

export default (props) => {
  const d = useLeadPipelineData()

  return {
    widget: 'HorizontalRankBar',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { Leads: 'Read' },
    title: 'Leads by type',
    caption: 'Open leads by category',
    data: computed(() => ({
      items: d.leadsByType.value,
      empty: d.openCount.value === 0,
      loading: d.loading.value
    }))
  }
}
