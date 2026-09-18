/**
 * Leads that have remained in Processing longest.
 *
 * Answers: Which leads are dragging longest?
 *
 * Uses:
 *   - useLeadPipelineData: staleProcessing, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useLeadPipelineData from '../Data/useLeadPipelineData'

export default (props) => {
  const d = useLeadPipelineData()

  return {
    widget: 'LowStockList',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { Leads: 'Read' },
    widgetProps: { color: 'negative', valueFormat: (v) => v + ' days' },
    title: 'Stale processing',
    caption: 'Longest in processing',
    data: computed(() => ({
      items: d.staleProcessing.value,
      empty: d.staleProcessing.value.length === 0,
      loading: d.loading.value
    }))
  }
}
