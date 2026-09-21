/**
 * Open returns waiting for invoice credit adjustment.
 *
 * Answers: How many returns still wait for invoice credit?
 *
 * Uses:
 *   - useReturnWorkData: awaitingCreditCount, awaitingCreditTotal, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import { useCurrency } from 'src/composables/useCurrency'
import useReturnWorkData from '../Data/useReturnWorkData'

export default (props) => {
  const d = useReturnWorkData()
  const { _C } = useCurrency()

  return {
    widget: 'MetricPlain',
    size: { xs: [4, 6], sm: [4, 6], md: [3, 4, 6], lg: [2, 3, 4], xl: [2, 3] },
    permission: { OutletReturns: 'Read' },
    title: 'Awaiting credit',
    data: computed(() => ({
      value: d.awaitingCreditCount.value,
      caption: _C(d.awaitingCreditTotal.value, true),
      empty: d.awaitingCreditCount.value === 0,
      loading: d.loading.value
    }))
  }
}
