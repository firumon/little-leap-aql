/**
 * Distribution of responded visits across 3 delay bands from scheduled visit date.
 *
 * Answers: Are visits being responded to on time or with delay?
 *
 * Uses:
 *   - useVisitData: respondDelay, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useVisitData from '../Data/useVisitData'

export default (props) => {
  const d = useVisitData()

  return {
    widget: 'DebtAgeing',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { OutletVisits: 'Read' },
    title: 'Respond delay',
    caption: 'Days between planned date and response',
    data: computed(() => ({
      items: d.respondDelay.value,
      empty: !d.respondDelay.value.some((b) => b.value > 0),
      loading: d.loading.value
    }))
  }
}
