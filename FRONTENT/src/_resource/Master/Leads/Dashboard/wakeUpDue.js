/**
 * Sleeping leads that have been on hold longest.
 *
 * Answers: Which sleeping leads should we wake first?
 *
 * Uses:
 *   - useLeadSleepData: wakeUpDue, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useLeadSleepData from '../Data/useLeadSleepData'

export default (props) => {
  const d = useLeadSleepData()

  return {
    widget: 'LowStockList',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { Leads: 'Read' },
    widgetProps: { color: 'warning', valueFormat: (v) => v + ' days' },
    title: 'Wake up due',
    caption: 'Sleeping leads longest on hold',
    data: computed(() => ({
      items: d.wakeUpDue.value,
      empty: d.wakeUpDue.value.length === 0,
      loading: d.loading.value
    }))
  }
}
