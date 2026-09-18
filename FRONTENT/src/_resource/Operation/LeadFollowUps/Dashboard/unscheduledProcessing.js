/**
 * Processing leads that lack an upcoming awaiting follow-up.
 *
 * Answers: Which Processing leads have no talk booked?
 *
 * Uses:
 *   - useFollowUpCoverageData: unscheduledCount, unscheduledOver30Count, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useFollowUpCoverageData from '../Data/useFollowUpCoverageData'

export default (props) => {
  const d = useFollowUpCoverageData()

  return {
    widget: 'MetricDeltaInverse',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { LeadFollowUps: 'Read', Leads: 'Read' },
    title: 'Unscheduled leads',
    caption: 'Over 30 days unscheduled',
    data: computed(() => ({
      value: d.unscheduledCount.value,
      compare: d.unscheduledOver30Count.value,
      empty: d.unscheduledCount.value === 0 && d.unscheduledOver30Count.value === 0,
      loading: d.loading.value
    }))
  }
}
