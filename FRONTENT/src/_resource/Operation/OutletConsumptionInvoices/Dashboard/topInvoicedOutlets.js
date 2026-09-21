/**
 * Top 8 outlets by total invoiced money inside the chosen range.
 *
 * Answers: Which outlets were billed the most money in the chosen period?
 *
 * Uses:
 *   - useInvoiceData: topInvoicedOutlets, nonCancelledCount, range, loading, controls
 *
 * Controls: range
 */

import { computed } from 'vue'
import { useCurrency } from 'src/composables/useCurrency'
import { useDataContext } from 'src/composables/data/useDataContext'
import useInvoiceData from '../Data/useInvoiceData'

export default (props) => {
  const d = useInvoiceData()
  const { _C } = useCurrency()
  const { rangeLabel } = useDataContext()

  return {
    widget: 'HorizontalRankBar',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { OutletConsumptionInvoices: 'Read', Outlets: true },
    title: 'Top invoiced outlets',
    controls: d.controls.filter((c) => ['range'].includes(c.name)),
    widgetProps: {
      valueFormat: (v) => _C(v, true)
    },
    data: computed(() => ({
      items: d.topInvoicedOutlets.value,
      caption: `Invoiced value in ${rangeLabel(d.range.value)}`,
      empty: d.nonCancelledCount.value === 0,
      loading: d.loading.value
    }))
  }
}
