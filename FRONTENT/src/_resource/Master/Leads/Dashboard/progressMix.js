/**
 * Distribution of all leads by workflow progress bucket.
 *
 * Answers: What does the whole lead pile look like now?
 *
 * Uses:
 *   - useLeadPipelineData: progressMix, openCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useLeadPipelineData from '../Data/useLeadPipelineData'

export default (props) => {
  const d = useLeadPipelineData()

  return {
    widget: 'RingDonut',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { Leads: 'Read' },
    title: 'Progress mix',
    caption: 'All leads by progress',
    data: computed(() => ({
      items: d.progressMix.value,
      empty: d.progressMix.value.length === 0,
      loading: d.loading.value
    }))
  }
}
