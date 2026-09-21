/**
 * Daily payment collections in monetary value over the past 30 days.
 *
 * Answers: What is the daily payment collection trend across the last 30 days?
 *
 * Uses:
 *   - usePaymentData: collectionsPerDay, loading
 *
 * Controls: none
 */

import { computed } from 'vue'
import { useCurrency } from 'src/composables/useCurrency'
import usePaymentData from '../Data/usePaymentData'

export default (props) => {
  const d = usePaymentData()
  const { _C } = useCurrency()

  return {
    widget: 'DailySalesLine',
    size: { xs: [12], sm: [12], md: [8, 12], lg: [6, 8, 12], xl: [6, 8] },
    permission: { OutletPayments: 'Read' },
    title: 'Collections per day',
    caption: 'Last 30 days',
    widgetProps: {
      valueFormat: (v) => _C(v, true)
    },
    data: computed(() => ({
      points: d.collectionsPerDay.value,
      empty: !d.collectionsPerDay.value.some((p) => p.y > 0),
      loading: d.loading.value
    }))
  }
}
