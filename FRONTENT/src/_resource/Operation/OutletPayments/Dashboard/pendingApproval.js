/**
 * Money waiting for manager approval.
 *
 * Answers: How many payments and how much money are waiting for approval?
 *
 * Uses:
 *   - usePaymentData: pendingApproval, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import { useCurrency } from 'src/composables/useCurrency'
import usePaymentData from '../Data/usePaymentData'

export default () => {
  const d = usePaymentData()
  const { _C } = useCurrency()

  return {
    widget: 'MetricPlain',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4] },
    permission: { OutletPayments: 'Read' },
    title: 'Pending approval',
    widgetProps: { valueFormat: (value) => _C(value, true) },
    data: computed(() => ({
      value: d.pendingApproval.value.amount,
      caption: `${d.pendingApproval.value.count} payment${d.pendingApproval.value.count === 1 ? '' : 's'}`,
      empty: d.pendingApproval.value.count === 0,
      loading: d.loading.value
    }))
  }
}
