/**
 * Non-cancelled consumptions counted this month compared to last month.
 *
 * Answers: Are we counting more outlet consumptions this month than last month?
 *
 * Uses:
 *   - useConsumptionData: countsThisMonth, countsLastMonth, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useConsumptionData from '../Data/useConsumptionData'

export default (props) => {
  const d = useConsumptionData()

  return {
    widget: 'MetricDelta',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletConsumptions: 'Read' },
    title: 'Counts this month',
    caption: 'vs last month',
    data: computed(() => ({
      value: d.countsThisMonth.value,
      compare: d.countsLastMonth.value,
      empty: d.countsThisMonth.value === 0 && d.countsLastMonth.value === 0,
      loading: d.loading.value
    }))
  }
}
