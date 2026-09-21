/**
 * Completed visits per day over the last 30 days.
 *
 * Answers: What is the daily trend of completed field visits over the last 30 days?
 *
 * Uses:
 *   - useVisitData: visitsPerDay, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useVisitData from '../Data/useVisitData'

export default (props) => {
  const d = useVisitData()

  return {
    widget: 'StaffVisitsLine',
    size: { xs: [12], sm: [12], md: [8, 12], lg: [6, 8, 12], xl: [6, 8] },
    permission: { OutletVisits: 'Read' },
    title: 'Visits per day',
    caption: 'Last 30 days',
    data: computed(() => ({
      points: d.visitsPerDay.value,
      empty: !d.visitsPerDay.value.some((p) => p.y > 0),
      loading: d.loading.value
    }))
  }
}
