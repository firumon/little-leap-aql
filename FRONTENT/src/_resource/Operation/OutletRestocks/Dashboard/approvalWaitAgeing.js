/**
 * The waiting-for-approval pile split by how long each one has waited.
 *
 * Answers: Is the waiting pile fresh, or has some of it gone stale?
 *
 * Uses:
 *   - useRestockApprovalData: approvalWait, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useRestockApprovalData from '../Data/useRestockApprovalData'

export default (props) => {
  const d = useRestockApprovalData()

  return {
    widget: 'DebtAgeing',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { OutletRestocks: 'Read' },
    title: 'Approval wait',
    caption: 'Time since sent for approval',
    data: computed(() => ({
      items: d.approvalWait.value,
      empty: !d.approvalWait.value.some((b) => b.value > 0),
      loading: d.loading.value
    }))
  }
}
