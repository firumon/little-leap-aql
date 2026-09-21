/**
 * How many restocks reached each step: raised, sent, approved, delivered.
 *
 * Answers: Where do restocks stop on the way to the outlet?
 *
 * Uses:
 *   - useRestockApprovalData: funnel, totalCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useRestockApprovalData from '../Data/useRestockApprovalData'

export default (props) => {
  const d = useRestockApprovalData()

  return {
    widget: 'ApprovalFunnel',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { OutletRestocks: 'Read' },
    title: 'Approval funnel',
    caption: 'How far restocks got',
    data: computed(() => ({
      items: d.funnel.value,
      empty: d.totalCount.value === 0,
      loading: d.loading.value
    }))
  }
}
