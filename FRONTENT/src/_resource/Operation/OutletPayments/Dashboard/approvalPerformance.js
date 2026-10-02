/**
 * Average time from payment submission to approval.
 *
 * Answers: How quickly are submitted payments being approved?
 *
 * Uses:
 *   - usePaymentData: approvalPerformance, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import usePaymentData from '../Data/usePaymentData'

export default () => {
  const d = usePaymentData()

  return {
    widget: 'MetricPlain',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4] },
    permission: { OutletPayments: 'Read' },
    title: 'Approval performance',
    widgetProps: { valueFormat: (value) => `${value} hours` },
    data: computed(() => ({
      value: d.approvalPerformance.value.averageHours,
      caption: `${d.approvalPerformance.value.approvedCount} approved payment${d.approvalPerformance.value.approvedCount === 1 ? '' : 's'}`,
      empty: d.approvalPerformance.value.approvedCount === 0,
      loading: d.loading.value
    }))
  }
}
