/**
 * Restocks waiting for an approver right now.
 *
 * Answers: How many restocks wait for a yes, and how many waited too long?
 *
 * Uses:
 *   - useRestockApprovalData: awaitingCount, awaitingOverWeek, loading
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
    title: 'Waiting for approval',
    data: computed(() => ({
      value: d.awaitingCount.value,
      caption: `${d.awaitingOverWeek.value} waited over 7 days`,
      empty: d.awaitingCount.value === 0,
      loading: d.loading.value
    }))
  }
}
