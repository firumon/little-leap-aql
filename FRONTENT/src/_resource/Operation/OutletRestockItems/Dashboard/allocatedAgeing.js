/**
 * Kept-aside lines split by how long since the stock was kept aside.
 *
 * Answers: Has kept-aside stock waited too long to go out?
 *
 * Uses:
 *   - useRestockLineData: allocatedWait, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useRestockLineData from '../Data/useRestockLineData'

export default (props) => {
  const d = useRestockLineData()

  return {
    widget: 'DebtAgeing',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { OutletRestockItems: 'Read', OutletRestocks: true },
    title: 'Kept aside wait',
    caption: 'Time since stock was kept aside',
    data: computed(() => ({
      items: d.allocatedWait.value,
      empty: !d.allocatedWait.value.some((b) => b.value > 0),
      loading: d.loading.value
    }))
  }
}
