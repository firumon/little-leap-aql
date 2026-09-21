/**
 * The products we are most short of for approved restocks.
 *
 * Answers: Which products must we find stock for first?
 *
 * Uses:
 *   - useRestockLineData: shortSkus, shortCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useRestockLineData from '../Data/useRestockLineData'

export default (props) => {
  const d = useRestockLineData()

  return {
    widget: 'LowStockList',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { OutletRestockItems: 'Read', OutletRestocks: true, SKUs: true, Products: true },
    title: 'Most short products',
    caption: 'Quantity with no stock yet',
    widgetProps: { color: 'negative' },
    data: computed(() => ({
      items: d.shortSkus.value,
      empty: d.shortCount.value === 0,
      loading: d.loading.value
    }))
  }
}
