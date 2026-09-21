/**
 * Total invoiced money this month compared to last month.
 *
 * Answers: Are we invoicing more sales value this month than last month?
 *
 * Uses:
 *   - useInvoiceData: invoicedThisMonth, invoicedLastMonth, loading
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
    widget: 'MetricDelta',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletConsumptionInvoices: 'Read' },
    title: 'Invoiced this month',
    caption: 'vs last month',
    widgetProps: {
      valueFormat: (v) => _C(v, true)
    },
    data: computed(() => ({
      value: d.invoicedThisMonth.value,
      compare: d.invoicedLastMonth.value,
      empty: d.invoicedThisMonth.value === 0 && d.invoicedLastMonth.value === 0,
      loading: d.loading.value
    }))
  }
}
