/**
 * Completed visits this month compared to last month.
 *
 * Answers: Are we completing more visits this month than last month?
 *
 * Uses:
 *   - useVisitData: completedThisMonth, completedLastMonth, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useVisitData from '../Data/useVisitData'

export default (props) => {
  const d = useVisitData()

  return {
    widget: 'MetricDelta',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletVisits: 'Read' },
    title: 'Completed this month',
    caption: 'vs last month',
    data: computed(() => ({
      value: d.completedThisMonth.value,
      compare: d.completedLastMonth.value,
      empty: d.completedThisMonth.value === 0 && d.completedLastMonth.value === 0,
      loading: d.loading.value
    }))
  }
}
