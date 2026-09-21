/**
 * The products returned in the greatest quantity with their total monetary credit.
 *
 * Answers: Which products come back most?
 *
 * Uses:
 *   - useReturnVolumeData: topReturnedProducts, nonCancelledCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useReturnVolumeData from '../Data/useReturnVolumeData'

export default (props) => {
  const d = useReturnVolumeData()

  return {
    widget: 'TopProductsList',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { OutletReturns: 'Read', SKUs: true, Products: true },
    title: 'Top returned products',
    caption: 'By returned quantity',
    data: computed(() => ({
      items: d.topReturnedProducts.value,
      empty: d.nonCancelledCount.value === 0,
      loading: d.loading.value
    }))
  }
}
