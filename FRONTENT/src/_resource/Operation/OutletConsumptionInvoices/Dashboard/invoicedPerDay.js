/**
 * Invoiced monetary sales per day over the last 30 days.
 *
 * Answers: What is the daily billing trend over the last 30 days?
 *
 * Uses:
 *   - useInvoiceData: invoicedPerDay, loading
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
    widget: 'DailySalesLine',
    size: { xs: [12], sm: [12], md: [8, 12], lg: [6, 8, 12], xl: [6, 8] },
    permission: { OutletConsumptionInvoices: 'Read' },
    title: 'Invoiced per day',
    caption: 'Last 30 days',
    widgetProps: {
      valueFormat: (v) => _C(v, true)
    },
    data: computed(() => ({
      points: d.invoicedPerDay.value,
      empty: !d.invoicedPerDay.value.some((p) => p.y > 0),
      loading: d.loading.value
    }))
  }
}
