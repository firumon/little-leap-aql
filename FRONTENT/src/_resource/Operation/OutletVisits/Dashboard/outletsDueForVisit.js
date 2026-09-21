/**
 * Outlets due for a visit whose last visit exceeds their frequency, followed by never-visited outlets.
 *
 * Answers: Which outlets most urgently need a field visit?
 *
 * Uses:
 *   - useVisitData: outletsDueForVisit, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useVisitData from '../Data/useVisitData'

export default (props) => {
  const d = useVisitData()

  return {
    widget: 'LowStockList',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { OutletVisits: 'Read', Outlets: true, OutletOperatingRules: true },
    title: 'Outlets due for visit',
    caption: 'Urgent cadence backlog',
    widgetProps: {
      valueFormat: (v) => (v === 0 ? 'Never' : `${v} ${v === 1 ? 'day' : 'days'}`)
    },
    data: computed(() => ({
      items: d.outletsDueForVisit.value,
      empty: d.outletsDueForVisit.value.length === 0,
      loading: d.loading.value
    }))
  }
}
