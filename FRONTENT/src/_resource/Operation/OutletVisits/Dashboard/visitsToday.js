/**
 * Visits planned for today, with tomorrow count in caption.
 *
 * Answers: How many visits are scheduled for today?
 *
 * Uses:
 *   - useVisitData: visitsTodayCount, visitsTomorrowCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useVisitData from '../Data/useVisitData'

export default (props) => {
  const d = useVisitData()

  return {
    widget: 'MetricPlain',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletVisits: 'Read' },
    title: 'Visits today',
    data: computed(() => ({
      value: d.visitsTodayCount.value,
      caption: `${d.visitsTomorrowCount.value} tomorrow`,
      empty: d.visitsTodayCount.value === 0 && d.visitsTomorrowCount.value === 0,
      loading: d.loading.value
    }))
  }
}
