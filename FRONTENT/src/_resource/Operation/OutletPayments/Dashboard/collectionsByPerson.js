/**
 * Field collection money grouped by collecting collector/user inside the chosen personRange.
 *
 * Answers: Who collected the most money in the chosen period?
 *
 * Uses:
 *   - usePaymentData: collectionsByPerson, countedPaymentsCount, personRange, loading, controls
 *
 * Controls: personRange
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
    permission: { OutletPayments: 'Read' },
    users: true,
    title: 'Collections by person',
    controls: d.controls.filter((c) => ['personRange'].includes(c.name)),
    widgetProps: {
      valueFormat: (v) => _C(v, true)
    },
    data: computed(() => ({
      items: d.collectionsByPerson.value,
      caption: `Collections in ${rangeLabel(d.personRange.value)}`,
      empty: d.countedPaymentsCount.value === 0,
      loading: d.loading.value
    }))
  }
}
