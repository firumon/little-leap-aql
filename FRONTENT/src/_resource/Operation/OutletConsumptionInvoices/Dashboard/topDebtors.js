/**
 * Top 8 outlets with the highest outstanding invoice balances.
 *
 * Answers: Which outlets owe the most money?
 *
 * Uses:
 *   - useInvoiceData: topDebtors, loading
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
    widget: 'LowStockList',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { OutletConsumptionInvoices: 'Read', OutletPayments: true, Outlets: true },
    title: 'Top debtors',
    widgetProps: {
      valueFormat: (v) => _C(v, true)
    },
    data: computed(() => ({
      items: d.topDebtors.value,
      empty: d.topDebtors.value.length === 0,
      loading: d.loading.value
    }))
  }
}
