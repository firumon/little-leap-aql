/**
 * Top 8 selling SKUs by line value across non-cancelled consumption invoices.
 *
 * Answers: Which products are generating the highest invoiced sales?
 *
 * Uses:
 *   - useInvoiceLineData: topSellingProducts, liveLineCount, range, loading, controls
 *
 * Controls: range
 */

import { computed } from 'vue'
import { useCurrency } from 'src/composables/useCurrency'
import { useDataContext } from 'src/composables/data/useDataContext'
import useInvoiceLineData from '../Data/useInvoiceLineData'

export default (props) => {
  const d = useInvoiceLineData()
  const { _C } = useCurrency()
  const { rangeLabel } = useDataContext()

  return {
    widget: 'TopProductsList',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: {
      OutletConsumptionInvoiceItems: 'Read',
      OutletConsumptionInvoices: true,
      SKUs: true,
      Products: true
    },
    title: 'Top selling products',
    controls: d.controls.filter((c) => ['range'].includes(c.name)),
    widgetProps: {
      valueFormat: (v) => _C(v, true)
    },
    data: computed(() => ({
      items: d.topSellingProducts.value,
      caption: `Invoiced products in ${rangeLabel(d.range.value)}`,
      empty: d.liveLineCount.value === 0,
      loading: d.loading.value
    }))
  }
}
