/**
 * Completion quota of follow-ups that have come due.
 *
 * Answers: Of the talks already due, how many did we really answer?
 *
 * Uses:
 *   - useFollowUpDueData: dueAnsweredCount, dueTotalCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useFollowUpDueData from '../Data/useFollowUpDueData'

export default (props) => {
  const d = useFollowUpDueData()

  return {
    widget: 'QuotaBullet',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { LeadFollowUps: 'Read' },
    title: 'Due completion',
    caption: 'Answered vs total due',
    data: computed(() => ({
      value: d.dueAnsweredCount.value,
      target: d.dueTotalCount.value,
      max: d.dueTotalCount.value,
      empty: d.dueTotalCount.value === 0,
      loading: d.loading.value
    }))
  }
}
