/**
 * Approved quantity against delivered quantity, for the top products.
 *
 * Answers: Which products do we fail to deliver in full?
 *
 * Uses:
 *   - useRestockLineData: askedVsDelivered, lineCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useRestockLineData from '../Data/useRestockLineData'

export default (props) => {
  const d = useRestockLineData()

  return {
    widget: 'GroupedBar',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { OutletRestockItems: 'Read', OutletRestocks: true, SKUs: true, Products: true },
    title: 'Approved vs delivered',
    caption: 'Top products by quantity',
    data: computed(() => ({
      series: d.askedVsDelivered.value,
      empty: d.lineCount.value === 0,
      loading: d.loading.value
    }))
  }
}
