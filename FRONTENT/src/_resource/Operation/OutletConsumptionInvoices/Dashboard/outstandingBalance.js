/**
 * Total balance of all open invoices.
 *
 * Answers: How much money is currently outstanding on open invoices?
 *
 * Uses:
 *   - useInvoiceData: totalOutstandingBalance, openInvoicesCount, loading
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
    title: 'Outstanding balance',
    widgetProps: {
      valueFormat: (v) => _C(v, true)
    },
    data: computed(() => ({
      value: d.totalOutstandingBalance.value,
      caption: `${d.openInvoicesCount.value} ${d.openInvoicesCount.value === 1 ? 'invoice' : 'invoices'}`,
      empty: d.totalOutstandingBalance.value === 0,
      loading: d.loading.value
    }))
  }
}
