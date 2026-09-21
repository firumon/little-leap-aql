/**
 * Planned visits distributed across the next 7 days (today through today+6).
 *
 * Answers: How is visit workload distributed over the week ahead?
 *
 * Uses:
 *   - useVisitData: weekAhead, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useVisitData from '../Data/useVisitData'

export default (props) => {
  const d = useVisitData()

  return {
    widget: 'ColumnBar',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { OutletVisits: 'Read' },
    title: 'Week ahead',
    caption: 'Planned visits today to +6 days',
    data: computed(() => ({
      items: d.weekAhead.value,
      empty: !d.weekAhead.value.some((b) => b.value > 0),
      loading: d.loading.value
    }))
  }
}
