/**
 * Open balance money divided into four overdue ageing bands.
 *
 * Answers: How long has outstanding invoice money been overdue?
 *
 * Uses:
 *   - useInvoiceData: debtAgeing, loading
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
    widget: 'DebtAgeing',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { OutletConsumptionInvoices: 'Read', OutletPayments: true },
    title: 'Debt ageing',
    caption: 'By invoice due date',
    widgetProps: {
      valueFormat: (v) => _C(v, true)
    },
    data: computed(() => ({
      items: d.debtAgeing.value,
      empty: !d.debtAgeing.value.some((b) => b.value > 0),
      loading: d.loading.value
    }))
  }
}
