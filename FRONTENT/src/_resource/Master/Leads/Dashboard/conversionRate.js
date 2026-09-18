/**
 * Ratio of approved leads among closed outcomes.
 *
 * Answers: Out of every 100 closed leads, how many did we win?
 *
 * Uses:
 *   - useLeadOutcomeData: conversionWon, conversionTotal, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useLeadOutcomeData from '../Data/useLeadOutcomeData'

export default (props) => {
  const d = useLeadOutcomeData()

  return {
    widget: 'PercentWaffle',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { Leads: 'Read' },
    title: 'Conversion rate',
    caption: 'Approved of closed leads',
    data: computed(() => ({
      value: d.conversionWon.value,
      max: d.conversionTotal.value,
      empty: d.conversionTotal.value === 0,
      loading: d.loading.value
    }))
  }
}
