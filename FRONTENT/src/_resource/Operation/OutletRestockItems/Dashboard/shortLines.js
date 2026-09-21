/**
 * Approved restock lines that still have no stock behind them.
 *
 * Answers: How many approved lines are stuck for lack of stock?
 *
 * Uses:
 *   - useRestockLineData: shortCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useRestockLineData from '../Data/useRestockLineData'

export default (props) => {
  const d = useRestockLineData()

  return {
    widget: 'MetricPlain',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletRestockItems: 'Read', OutletRestocks: true },
    title: 'Short of stock',
    caption: 'Approved lines with no stock yet',
    data: computed(() => ({
      value: d.shortCount.value,
      empty: d.shortCount.value === 0,
      loading: d.loading.value
    }))
  }
}
