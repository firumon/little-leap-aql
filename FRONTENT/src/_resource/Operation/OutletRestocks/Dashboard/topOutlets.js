/**
 * The outlets that raised the most restocks in the chosen range.
 *
 * Answers: Which outlets ask for stock the most?
 *
 * Uses:
 *   - useRestockIntakeData: topOutlets, range, raisedCount, loading, controls
 *
 * Controls: range
 */

import { computed } from 'vue'
import { useDataContext } from 'src/composables/data/useDataContext'
import useRestockIntakeData from '../Data/useRestockIntakeData'

export default (props) => {
  const d = useRestockIntakeData()
  const { rangeLabel } = useDataContext()

  return {
    widget: 'HorizontalRankBar',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { OutletRestocks: 'Read', Outlets: true },
    title: 'Busiest outlets',
    controls: d.controls.filter((c) => ['range'].includes(c.name)),
    data: computed(() => ({
      items: d.topOutlets.value,
      caption: `Restocks raised, ${rangeLabel(d.range.value)}`,
      empty: d.raisedCount.value === 0,
      loading: d.loading.value
    }))
  }
}
