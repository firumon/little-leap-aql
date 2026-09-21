/**
 * Open returns split across four age bands from their return date.
 *
 * Answers: How long have open returns waited?
 *
 * Uses:
 *   - useReturnWorkData: openAgeing, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useReturnWorkData from '../Data/useReturnWorkData'

export default (props) => {
  const d = useReturnWorkData()

  return {
    widget: 'DebtAgeing',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { OutletReturns: 'Read' },
    title: 'Open return ageing',
    caption: 'Time since return date',
    data: computed(() => ({
      items: d.openAgeing.value,
      empty: !d.openAgeing.value.some((b) => b.value > 0),
      loading: d.loading.value
    }))
  }
}
