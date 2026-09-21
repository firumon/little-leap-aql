/**
 * Lines of approved restocks split into short, kept aside and delivered.
 *
 * Answers: How much of the approved work is done?
 *
 * Uses:
 *   - useRestockLineData: lineMix, lineCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useRestockLineData from '../Data/useRestockLineData'

export default (props) => {
  const d = useRestockLineData()

  return {
    widget: 'StockStatusStrip',
    size: { xs: [6, 12], sm: [6, 12], md: [4, 6], lg: [3, 4, 6], xl: [3, 4] },
    permission: { OutletRestockItems: 'Read', OutletRestocks: true },
    title: 'Approved lines',
    caption: 'Short, kept aside, delivered',
    data: computed(() => ({
      items: d.lineMix.value,
      empty: d.lineCount.value === 0,
      loading: d.loading.value
    }))
  }
}
