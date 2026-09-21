/**
 * Total money collected today compared to yesterday.
 *
 * Answers: How much payment did we collect today compared to yesterday?
 *
 * Uses:
 *   - usePaymentData: collectedToday, collectedYesterday, loading
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
    title: 'Collected today',
    caption: 'vs yesterday',
    widgetProps: {
      valueFormat: (v) => _C(v, true)
    },
    data: computed(() => ({
      value: d.collectedToday.value,
      compare: d.collectedYesterday.value,
      empty: d.collectedToday.value === 0 && d.collectedYesterday.value === 0,
      loading: d.loading.value
    }))
  }
}
