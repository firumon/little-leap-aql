/**
 * Top 8 outlets by total payment money collected inside the chosen outletRange.
 *
 * Answers: Which outlets contributed the most cash/collections in the chosen period?
 *
 * Uses:
 *   - usePaymentData: topPayingOutlets, countedPaymentsCount, outletRange, loading, controls
 *
 * Controls: outletRange
 */

import { computed } from 'vue'
import { useCurrency } from 'src/composables/useCurrency'
import { useDataContext } from 'src/composables/data/useDataContext'
import usePaymentData from '../Data/usePaymentData'

export default (props) => {
  const d = usePaymentData()
  const { _C } = useCurrency()
  const { rangeLabel } = useDataContext()

  return {
    widget: 'HorizontalRankBar',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { OutletPayments: 'Read', Outlets: true },
    title: 'Top paying outlets',
    controls: d.controls.filter((c) => ['outletRange'].includes(c.name)),
    widgetProps: {
      valueFormat: (v) => _C(v, true)
    },
    data: computed(() => ({
      items: d.topPayingOutlets.value,
      caption: `Collections in ${rangeLabel(d.outletRange.value)}`,
      empty: d.countedPaymentsCount.value === 0,
      loading: d.loading.value
    }))
  }
}
