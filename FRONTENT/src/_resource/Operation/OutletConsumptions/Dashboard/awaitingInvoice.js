/**
 * Active consumptions waiting for invoice generation.
 *
 * Answers: How many consumptions are waiting for an invoice to be generated?
 *
 * Uses:
 *   - useConsumptionData: awaitingInvoiceCount, oldestAwaitingInvoiceDays, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useConsumptionData from '../Data/useConsumptionData'

export default (props) => {
  const d = useConsumptionData()

  return {
    widget: 'MetricPlain',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletConsumptions: 'Read' },
    title: 'Awaiting invoice',
    data: computed(() => ({
      value: d.awaitingInvoiceCount.value,
      caption: `oldest ${d.oldestAwaitingInvoiceDays.value} ${d.oldestAwaitingInvoiceDays.value === 1 ? 'day' : 'days'}`,
      empty: d.awaitingInvoiceCount.value === 0,
      loading: d.loading.value
    }))
  }
}
