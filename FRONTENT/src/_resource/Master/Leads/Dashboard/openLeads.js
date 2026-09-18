/**
 * Count of leads actively being worked.
 *
 * Answers: How many leads are still being worked?
 *
 * Uses:
 *   - useLeadPipelineData: openCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useLeadPipelineData from '../Data/useLeadPipelineData'

export default (props) => {
  const d = useLeadPipelineData()

  return {
    widget: 'MetricPlain',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { Leads: 'Read' },
    title: 'Open leads',
    caption: 'Draft and Processing',
    data: computed(() => ({
      value: d.openCount.value,
      empty: d.openCount.value === 0,
      loading: d.loading.value
    }))
  }
}
