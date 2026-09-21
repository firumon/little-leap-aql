/**
 * Restocks the signed-in user started and has not sent for approval.
 *
 * Answers: Did I leave my own restocks unsent?
 *
 * Uses:
 *   - useRestockIntakeData: myDraftCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useRestockIntakeData from '../Data/useRestockIntakeData'

export default (props) => {
  const d = useRestockIntakeData()

  return {
    widget: 'MetricPlain',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletRestocks: 'Read' },
    auth: true,
    title: 'My drafts',
    caption: 'Not sent for approval yet',
    data: computed(() => ({
      value: d.myDraftCount.value,
      empty: d.myDraftCount.value === 0,
      loading: d.loading.value
    }))
  }
}
