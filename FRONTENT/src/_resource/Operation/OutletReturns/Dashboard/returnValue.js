/**
 * Total monetary value of returns this month compared to last month.
 * Lower value represents better business performance.
 *
 * Answers: Money returned this month vs last month (lower is better)
 *
 * Uses:
 *   - useReturnVolumeData: thisMonthValue, lastMonthValue, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import { useCurrency } from 'src/composables/useCurrency'
import useReturnVolumeData from '../Data/useReturnVolumeData'

export default (props) => {
  const d = useReturnVolumeData()
  const { _C } = useCurrency()

  return {
    widget: 'MetricDeltaInverse',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletReturns: 'Read' },
    title: 'Returned value',
    caption: 'vs last month',
    widgetProps: {
      valueFormat: (v) => _C(v, true)
    },
    data: computed(() => ({
      value: d.thisMonthValue.value,
      compare: d.lastMonthValue.value,
      empty: d.thisMonthValue.value === 0 && d.lastMonthValue.value === 0,
      loading: d.loading.value
    }))
  }
}
