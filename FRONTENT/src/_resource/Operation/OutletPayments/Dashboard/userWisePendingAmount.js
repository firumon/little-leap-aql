/**
 * Pending payment money grouped by collector.
 *
 * Answers: Which collectors have the most money waiting for approval?
 *
 * Uses:
 *   - usePaymentData: userWisePendingAmount, pendingApproval, loading
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
    widget: 'HorizontalRankBar',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8] },
    permission: { OutletPayments: 'Read' },
    users: true,
    title: 'Pending by collector',
    widgetProps: { valueFormat: (value) => _C(value, true) },
    data: computed(() => ({
      items: d.userWisePendingAmount.value,
      empty: d.pendingApproval.value.count === 0,
      loading: d.loading.value
    }))
  }
}
