/**
 * Open returns waiting for warehouse intake action.
 *
 * Answers: How many returns wait for the warehouse to take them?
 *
 * Uses:
 *   - useReturnWorkData: awaitingWarehouseCount, awaitingWarehouseUnits, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useReturnWorkData from '../Data/useReturnWorkData'

export default (props) => {
  const d = useReturnWorkData()

  return {
    widget: 'MetricPlain',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletReturns: 'Read' },
    title: 'Awaiting warehouse',
    data: computed(() => ({
      value: d.awaitingWarehouseCount.value,
      caption: `${d.awaitingWarehouseUnits.value} ${d.awaitingWarehouseUnits.value === 1 ? 'unit' : 'units'}`,
      empty: d.awaitingWarehouseCount.value === 0,
      loading: d.loading.value
    }))
  }
}
