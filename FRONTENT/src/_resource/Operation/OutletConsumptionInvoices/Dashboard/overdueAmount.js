/**
 * Total balance of overdue open invoices.
 *
 * Answers: How much invoiced money is past its payment due date?
 *
 * Uses:
 *   - useInvoiceData: totalOverdueAmount, overdueInvoicesCount, loading
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
    widget: 'MetricPlain',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletConsumptionInvoices: 'Read', OutletPayments: true },
    title: 'Overdue amount',
    widgetProps: {
      valueFormat: (v) => _C(v, true)
    },
    data: computed(() => ({
      value: d.totalOverdueAmount.value,
      caption: `${d.overdueInvoicesCount.value} ${d.overdueInvoicesCount.value === 1 ? 'invoice' : 'invoices'}`,
      empty: d.totalOverdueAmount.value === 0,
      loading: d.loading.value
    }))
  }
}
