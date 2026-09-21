/**
 * The number of returns logged per day across the past 30 days.
 *
 * Answers: Are returns going up or down?
 *
 * Uses:
 *   - useReturnVolumeData: returnsPerDay, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useReturnVolumeData from '../Data/useReturnVolumeData'

export default (props) => {
  const d = useReturnVolumeData()

  return {
    widget: 'DailySalesLine',
    size: { xs: [12], sm: [12], md: [8, 12], lg: [6, 8, 12], xl: [6, 8] },
    permission: { OutletReturns: 'Read' },
    title: 'Returns per day',
    caption: 'Last 30 days',
    data: computed(() => ({
      points: d.returnsPerDay.value,
      empty: !d.returnsPerDay.value.some((p) => p.y > 0),
      loading: d.loading.value
    }))
  }
}
