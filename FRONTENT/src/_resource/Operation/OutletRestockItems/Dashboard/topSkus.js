/**
 * The products sent to outlets in the largest approved quantity.
 *
 * Answers: What do outlets ask for the most?
 *
 * Uses:
 *   - useRestockLineData: topSkus, lineCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useRestockLineData from '../Data/useRestockLineData'

export default (props) => {
  const d = useRestockLineData()

  return {
    widget: 'TopProductsList',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { OutletRestockItems: 'Read', OutletRestocks: true, SKUs: true, Products: true },
    title: 'Most restocked products',
    caption: 'Approved quantity',
    data: computed(() => ({
      items: d.topSkus.value,
      empty: d.lineCount.value === 0,
      loading: d.loading.value
    }))
  }
}
