/**
 * Active outlets visited in the last 30 days compared against total active outlets.
 *
 * Answers: What portion of our active outlets have been visited in the last 30 days?
 *
 * Uses:
 *   - useVisitData: visitedOutlets30Days, totalActiveOutlets, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useVisitData from '../Data/useVisitData'

export default (props) => {
  const d = useVisitData()

  return {
    widget: 'PercentWaffle',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4], xl: [3, 4] },
    permission: { OutletVisits: 'Read', Outlets: true },
    title: 'Visit coverage',
    caption: 'Visited in last 30 days',
    data: computed(() => ({
      value: d.visitedOutlets30Days.value,
      max: d.totalActiveOutlets.value,
      empty: d.totalActiveOutlets.value === 0,
      loading: d.loading.value
    }))
  }
}
