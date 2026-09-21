/**
 * Restocks dated today, against yesterday. Drafts are left out.
 *
 * Answers: Is today busier or quieter than yesterday?
 *
 * Uses:
 *   - useRestockIntakeData: raisedToday, raisedYesterday, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useRestockIntakeData from '../Data/useRestockIntakeData'

export default (props) => {
  const d = useRestockIntakeData()

  return {
    widget: 'MetricDelta',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletRestocks: 'Read' },
    title: 'Raised today',
    caption: 'vs yesterday',
    data: computed(() => ({
      value: d.raisedToday.value,
      compare: d.raisedYesterday.value,
      empty: d.raisedToday.value === 0 && d.raisedYesterday.value === 0,
      loading: d.loading.value
    }))
  }
}
