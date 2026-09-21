/**
 * Consumptions waiting for invoice generation grouped into four wait age bands.
 *
 * Answers: How long have uninvoiced consumptions been waiting?
 *
 * Uses:
 *   - useConsumptionData: awaitingInvoiceAgeing, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useConsumptionData from '../Data/useConsumptionData'

export default (props) => {
  const d = useConsumptionData()

  return {
    widget: 'DebtAgeing',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { OutletConsumptions: 'Read' },
    title: 'Awaiting invoice ageing',
    caption: 'Time since consumption date',
    data: computed(() => ({
      items: d.awaitingInvoiceAgeing.value,
      empty: !d.awaitingInvoiceAgeing.value.some((b) => b.value > 0),
      loading: d.loading.value
    }))
  }
}
