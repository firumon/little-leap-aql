/**
 * Non-cancelled return quantity grouped by return reason.
 *
 * Answers: Why do goods come back?
 *
 * Uses:
 *   - useReturnVolumeData: returnsByReason, nonCancelledCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useReturnVolumeData from '../Data/useReturnVolumeData'

export default (props) => {
  const d = useReturnVolumeData()

  return {
    widget: 'RingDonut',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { OutletReturns: 'Read' },
    title: 'Returns by reason',
    caption: 'Non-cancelled returns',
    data: computed(() => ({
      items: d.returnsByReason.value,
      empty: d.nonCancelledCount.value === 0,
      loading: d.loading.value
    }))
  }
}
