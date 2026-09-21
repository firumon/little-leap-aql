/**
 * Restocks raised each day over the last 30 days. Drafts are left out.
 *
 * Answers: Is restock demand rising, falling or spiky?
 *
 * Uses:
 *   - useRestockIntakeData: perDay, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useRestockIntakeData from '../Data/useRestockIntakeData'

export default (props) => {
  const d = useRestockIntakeData()

  return {
    widget: 'DailySalesLine',
    size: { xs: [12], sm: [12], md: [8, 12], lg: [6, 8, 12], xl: [6, 8] },
    permission: { OutletRestocks: 'Read' },
    title: 'Restocks per day',
    caption: 'Last 30 days',
    data: computed(() => ({
      points: d.perDay.value,
      empty: !d.perDay.value.some((p) => p.y > 0),
      loading: d.loading.value
    }))
  }
}
