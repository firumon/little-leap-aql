/**
 * Cancelled payments this month compared to last month.
 * Lower value represents fewer payment cancellations/reversals.
 *
 * Answers: Are payment cancellations/reversals increasing or decreasing?
 *
 * Uses:
 *   - usePaymentData: cancelledThisMonthCount, cancelledLastMonthCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import usePaymentData from '../Data/usePaymentData'

export default (props) => {
  const d = usePaymentData()

  return {
    widget: 'MetricDeltaInverse',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletPayments: 'Read' },
    title: 'Cancelled payments',
    caption: 'vs last month',
    data: computed(() => ({
      value: d.cancelledThisMonthCount.value,
      compare: d.cancelledLastMonthCount.value,
      empty: d.cancelledThisMonthCount.value === 0 && d.cancelledLastMonthCount.value === 0,
      loading: d.loading.value
    }))
  }
}
