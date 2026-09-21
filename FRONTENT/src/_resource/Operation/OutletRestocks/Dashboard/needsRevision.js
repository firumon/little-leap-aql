/**
 * Restocks an approver sent back to be fixed.
 *
 * Answers: How many restocks must be fixed and sent again?
 *
 * Uses:
 *   - useRestockApprovalData: revisionCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useRestockApprovalData from '../Data/useRestockApprovalData'

export default (props) => {
  const d = useRestockApprovalData()

  return {
    widget: 'MetricPlain',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletRestocks: 'Read' },
    title: 'Needs revision',
    caption: 'Sent back to fix',
    data: computed(() => ({
      value: d.revisionCount.value,
      empty: d.revisionCount.value === 0,
      loading: d.loading.value
    }))
  }
}
