/**
 * Daily counts of non-cancelled consumptions over the past 30 days.
 *
 * Answers: What is the daily trend of outlet stock counts over the last 30 days?
 *
 * Uses:
 *   - useConsumptionData: countsPerDay, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useConsumptionData from '../Data/useConsumptionData'

export default (props) => {
  const d = useConsumptionData()

  return {
    widget: 'StaffVisitsLine',
    size: { xs: [12], sm: [12], md: [8, 12], lg: [6, 8, 12], xl: [6, 8] },
    permission: { OutletConsumptions: 'Read' },
    title: 'Counts per day',
    caption: 'Last 30 days',
    data: computed(() => ({
      points: d.countsPerDay.value,
      empty: !d.countsPerDay.value.some((p) => p.y > 0),
      loading: d.loading.value
    }))
  }
}
