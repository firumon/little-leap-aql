/**
 * Stock kept aside for restocks, per warehouse, not sent yet.
 *
 * Answers: Which warehouse holds the most stock waiting to go out?
 *
 * Uses:
 *   - useRestockLineData: allocatedByWarehouse, allocatedCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useRestockLineData from '../Data/useRestockLineData'

export default (props) => {
  const d = useRestockLineData()

  return {
    widget: 'HorizontalRankBar',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { OutletRestockItems: 'Read', OutletRestocks: true, Warehouses: true },
    title: 'Kept aside by warehouse',
    caption: 'Quantity waiting to go out',
    data: computed(() => ({
      items: d.allocatedByWarehouse.value,
      empty: d.allocatedCount.value === 0,
      loading: d.loading.value
    }))
  }
}
