/**
 * Age distribution of leads waiting in Processing.
 *
 * Answers: How long have leads been stuck in Processing?
 *
 * Uses:
 *   - useLeadPipelineData: processingAgeing, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useLeadPipelineData from '../Data/useLeadPipelineData'

export default (props) => {
  const d = useLeadPipelineData()

  return {
    widget: 'DebtAgeing',
    size: { xs: [6, 12], sm: [6, 12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { Leads: 'Read' },
    title: 'Processing ageing',
    caption: 'Time since marked Processing',
    data: computed(() => ({
      items: d.processingAgeing.value,
      empty: !d.processingAgeing.value.some((b) => b.value > 0),
      loading: d.loading.value
    }))
  }
}
