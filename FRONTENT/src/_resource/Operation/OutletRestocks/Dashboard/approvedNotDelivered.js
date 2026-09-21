/**
 * Approved restocks that have not fully reached the outlet.
 *
 * Answers: How much approved work is still owed to outlets?
 *
 * Uses:
 *   - useRestockDeliveryData: openCount, partialCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useRestockDeliveryData from '../Data/useRestockDeliveryData'

export default (props) => {
  const d = useRestockDeliveryData()

  return {
    widget: 'MetricPlain',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletRestocks: 'Read' },
    title: 'Approved, not delivered',
    data: computed(() => ({
      value: d.openCount.value,
      caption: `${d.partialCount.value} partly delivered`,
      empty: d.openCount.value === 0,
      loading: d.loading.value
    }))
  }
}
