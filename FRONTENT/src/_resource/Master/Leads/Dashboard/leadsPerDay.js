/**
 * Daily trend of new lead creations over the last 30 days.
 *
 * Answers: Is lead intake rising, falling or spiky?
 *
 * Uses:
 *   - useLeadIntakeData: leadsPerDay, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useLeadIntakeData from '../Data/useLeadIntakeData'

export default (props) => {
  const d = useLeadIntakeData()

  return {
    widget: 'DailySalesLine',
    size: { xs: [12], sm: [12], md: [8, 12], lg: [6, 8, 12], xl: [6, 8] },
    permission: { Leads: 'Read' },
    title: 'Leads per day',
    caption: 'New leads over last 30 days',
    data: computed(() => ({
      points: d.leadsPerDay.value,
      empty: !d.leadsPerDay.value.some((p) => p.y > 0),
      loading: d.loading.value
    }))
  }
}
