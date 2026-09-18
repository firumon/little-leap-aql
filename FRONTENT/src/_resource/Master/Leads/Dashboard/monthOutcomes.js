/**
 * Lead transitions occurring in the current calendar month.
 *
 * Answers: What happened this month?
 *
 * Uses:
 *   - useLeadOutcomeData: monthOutcomes, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useLeadOutcomeData from '../Data/useLeadOutcomeData'

export default (props) => {
  const d = useLeadOutcomeData()

  return {
    widget: 'ColumnBar',
    size: { xs: [6, 12], sm: [6, 12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { Leads: 'Read' },
    title: 'Outcomes this month',
    caption: 'Approved, Rejected and Later',
    data: computed(() => ({
      items: d.monthOutcomes.value,
      empty: !d.monthOutcomes.value.some((b) => b.value > 0),
      loading: d.loading.value
    }))
  }
}
