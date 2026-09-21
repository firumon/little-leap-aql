/**
 * The outlets logging the highest count of returns in the chosen range.
 *
 * Answers: Which outlets return most?
 *
 * Uses:
 *   - useReturnVolumeData: topOutlets, range, nonCancelledCount, loading, controls
 *
 * Controls: range
 */

import { computed } from 'vue'
import { useDataContext } from 'src/composables/data/useDataContext'
import useReturnVolumeData from '../Data/useReturnVolumeData'

export default (props) => {
  const d = useReturnVolumeData()
  const { rangeLabel } = useDataContext()

  return {
    widget: 'HorizontalRankBar',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { OutletReturns: 'Read', Outlets: true },
    title: 'Returns by outlet',
    controls: d.controls.filter((c) => ['range'].includes(c.name)),
    data: computed(() => ({
      items: d.topOutlets.value,
      caption: `Returns logged, ${rangeLabel(d.range.value)}`,
      empty: d.nonCancelledCount.value === 0,
      loading: d.loading.value
    }))
  }
}
