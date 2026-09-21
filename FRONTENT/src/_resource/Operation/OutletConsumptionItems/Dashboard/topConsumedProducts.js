/**
 * Top 8 consumed SKUs by quantity across active, non-cancelled parent consumptions.
 *
 * Answers: Which products are consumed in the highest quantities at outlets?
 *
 * Uses:
 *   - useConsumptionLineData: topConsumedProducts, liveLineCount, range, loading, controls
 *
 * Controls: range
 */

import { computed } from 'vue'
import { useDataContext } from 'src/composables/data/useDataContext'
import useConsumptionLineData from '../Data/useConsumptionLineData'

export default (props) => {
  const d = useConsumptionLineData()
  const { rangeLabel } = useDataContext()

  return {
    widget: 'TopProductsList',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: {
      OutletConsumptionItems: 'Read',
      OutletConsumptions: true,
      SKUs: true,
      Products: true
    },
    title: 'Top consumed products',
    controls: d.controls.filter((c) => ['range'].includes(c.name)),
    data: computed(() => ({
      items: d.topConsumedProducts.value,
      caption: `Consumed products in ${rangeLabel(d.range.value)}`,
      empty: d.liveLineCount.value === 0,
      loading: d.loading.value
    }))
  }
}
