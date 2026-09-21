/**
 * Overdue planned visits compared to the overdue count 7 days ago.
 *
 * Answers: Are overdue visits accumulating or clearing?
 *
 * Uses:
 *   - useVisitData: overdueVisitsCount, overdueVisits7DaysAgo, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useVisitData from '../Data/useVisitData'

export default (props) => {
  const d = useVisitData()

  return {
    widget: 'MetricDeltaInverse',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletVisits: 'Read' },
    title: 'Overdue visits',
    caption: 'vs 7 days ago',
    data: computed(() => ({
      value: d.overdueVisitsCount.value,
      compare: d.overdueVisits7DaysAgo.value,
      empty: d.overdueVisitsCount.value === 0 && d.overdueVisits7DaysAgo.value === 0,
      loading: d.loading.value
    }))
  }
}
