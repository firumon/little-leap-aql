/**
 * Every restock counted once, in the state it is in today.
 *
 * Answers: What does the whole restock pile look like right now?
 *
 * Uses:
 *   - useRestockApprovalData: progressMix, totalCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useRestockApprovalData from '../Data/useRestockApprovalData'

export default (props) => {
  const d = useRestockApprovalData()

  return {
    widget: 'RingDonut',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { OutletRestocks: 'Read' },
    title: 'Restocks by progress',
    caption: 'All restocks',
    data: computed(() => ({
      items: d.progressMix.value,
      empty: d.totalCount.value === 0,
      loading: d.loading.value
    }))
  }
}
