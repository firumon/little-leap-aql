/**
 * Open leads grouped by geographic location.
 *
 * Answers: Where are our open leads?
 *
 * Uses:
 *   - useLeadPipelineData: leadsByPlace, groupBy, openCount, loading, controls
 *
 * Controls: groupBy
 */

import { computed } from 'vue'
import useLeadPipelineData from '../Data/useLeadPipelineData'

export default (props) => {
  const d = useLeadPipelineData()

  return {
    widget: 'HorizontalRankBar',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { Leads: 'Read' },
    title: 'Leads by place',
    controls: d.controls.filter((c) => ['groupBy'].includes(c.name)),
    data: computed(() => ({
      items: d.leadsByPlace.value,
      caption: `Open leads by ${d.groupBy.value}`,
      empty: d.openCount.value === 0,
      loading: d.loading.value
    }))
  }
}
