/**
 * Breakdown of responded visits into completed, postponed, and cancelled outcomes.
 *
 * Answers: What are the outcomes of visits in the chosen time window?
 *
 * Uses:
 *   - useVisitData: visitOutcomes, respondedCount, range, loading, controls
 *
 * Controls: range
 */

import { computed } from 'vue'
import { useDataContext } from 'src/composables/data/useDataContext'
import useVisitData from '../Data/useVisitData'

export default (props) => {
  const d = useVisitData()
  const { rangeLabel } = useDataContext()

  return {
    widget: 'RingDonut',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { OutletVisits: 'Read' },
    title: 'Visit outcomes',
    controls: d.controls.filter((c) => ['range'].includes(c.name)),
    data: computed(() => ({
      items: d.visitOutcomes.value,
      caption: `Outcomes in ${rangeLabel(d.range.value)}`,
      empty: d.respondedCount.value === 0,
      loading: d.loading.value
    }))
  }
}
