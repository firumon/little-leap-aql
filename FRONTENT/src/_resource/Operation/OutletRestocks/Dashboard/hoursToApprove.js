/**
 * Average hours from sent for approval to approved.
 *
 * Answers: Are approvers quick or slow?
 *
 * Uses:
 *   - useRestockApprovalData: hoursToApprove, approvedSample, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useRestockApprovalData from '../Data/useRestockApprovalData'

export default (props) => {
  const d = useRestockApprovalData()

  return {
    widget: 'SpeedoGauge',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { OutletRestocks: 'Read' },
    title: 'Time to approve',
    widgetProps: { valueFormat: (v) => v + ' h' },
    data: computed(() => ({
      value: d.hoursToApprove.value,
      max: 48,
      caption: `Average of ${d.approvedSample.value} approvals`,
      empty: d.approvedSample.value === 0,
      loading: d.loading.value
    }))
  }
}
