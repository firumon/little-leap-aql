/**
 * Field personnel ranking by count of completed visits inside the chosen range.
 *
 * Answers: Who has completed the most visits in the chosen range?
 *
 * Uses:
 *   - useVisitData: visitsByPerson, completedCount, range, loading, controls
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
    widget: 'HorizontalRankBar',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { OutletVisits: 'Read' },
    users: true,
    title: 'Visits by person',
    controls: d.controls.filter((c) => ['range'].includes(c.name)),
    widgetProps: {
      valueFormat: (v) => `${v} ${v === 1 ? 'visit' : 'visits'}`
    },
    data: computed(() => ({
      items: d.visitsByPerson.value,
      caption: `Visits completed in ${rangeLabel(d.range.value)}`,
      empty: d.completedCount.value === 0,
      loading: d.loading.value
    }))
  }
}
