/**
 * Total money collected this month compared to last month.
 *
 * Answers: Are collections tracking higher or lower than last month?
 *
 * Uses:
 *   - usePaymentData: collectedThisMonth, collectedLastMonth, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import { useCurrency } from 'src/composables/useCurrency'
import usePaymentData from '../Data/usePaymentData'

export default (props) => {
  const d = usePaymentData()
  const { _C } = useCurrency()

  return {
    widget: 'MetricDelta',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletPayments: 'Read' },
    title: 'Collected this month',
    caption: 'vs last month',
    widgetProps: {
      valueFormat: (v) => _C(v, true)
    },
    data: computed(() => ({
      value: d.collectedThisMonth.value,
      compare: d.collectedLastMonth.value,
      empty: d.collectedThisMonth.value === 0 && d.collectedLastMonth.value === 0,
      loading: d.loading.value
    }))
  }
}
