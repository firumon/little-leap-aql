/**
 * Total write-off settlement amount this month compared to last month.
 * Lower value represents lower leakage/bad debt write-offs.
 *
 * Answers: How much invoiced debt was settled or written off this month vs last month?
 *
 * Uses:
 *   - useInvoiceData: writtenOffThisMonth, writtenOffLastMonth, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import { useCurrency } from 'src/composables/useCurrency'
import useInvoiceData from '../Data/useInvoiceData'

export default (props) => {
  const d = useInvoiceData()
  const { _C } = useCurrency()

  return {
    widget: 'MetricDeltaInverse',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletConsumptionInvoices: 'Read' },
    title: 'Written off this month',
    caption: 'vs last month',
    widgetProps: {
      valueFormat: (v) => _C(v, true)
    },
    data: computed(() => ({
      value: d.writtenOffThisMonth.value,
      compare: d.writtenOffLastMonth.value,
      empty: d.writtenOffThisMonth.value === 0 && d.writtenOffLastMonth.value === 0,
      loading: d.loading.value
    }))
  }
}
