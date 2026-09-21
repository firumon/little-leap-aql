/**
 * Distribution of active outlets across audit cadence tiers based on days since last consumption count.
 *
 * Answers: How well are outlet stock counts keeping to their required visit cadence?
 *
 * Uses:
 *   - useConsumptionData: countCadence, activeOutletsCount, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import useConsumptionData from '../Data/useConsumptionData'

export default (props) => {
  const d = useConsumptionData()

  return {
    widget: 'StockStatusStrip',
    size: { xs: [12], sm: [12], md: [8, 12], lg: [6, 8, 12], xl: [6, 8] },
    permission: {
      OutletConsumptions: 'Read',
      Outlets: true,
      OutletOperatingRules: true
    },
    title: 'Count cadence',
    caption: 'Active outlets by stock count schedule',
    data: computed(() => ({
      items: d.countCadence.value,
      empty: d.activeOutletsCount.value === 0,
      loading: d.loading.value
    }))
  }
}
