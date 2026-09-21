/**
 * The breakdown of warehouse-completed return quantities into stocked vs disposed.
 *
 * Answers: Of goods taken back, how much was stocked vs disposed?
 *
 * Uses:
 *   - useReturnVolumeData: warehouseOutcome, warehouseOutcomeUnits, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useReturnVolumeData from '../Data/useReturnVolumeData'

export default (props) => {
  const d = useReturnVolumeData()

  return {
    widget: 'ShareStrip',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { OutletReturns: 'Read' },
    title: 'Warehouse outcome',
    caption: 'Stocked vs disposed quantity',
    data: computed(() => ({
      items: d.warehouseOutcome.value,
      empty: d.warehouseOutcomeUnits.value === 0,
      loading: d.loading.value
    }))
  }
}
