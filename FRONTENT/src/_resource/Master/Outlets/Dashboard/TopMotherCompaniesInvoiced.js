/**
 * Top 8 mother companies by total family invoiced money inside the chosen range.
 *
 * Answers: Which parent outlet groups were billed the most money in the chosen period?
 *
 * Uses:
 *   - useOutletFamilyData: topMotherCompaniesInvoiced, range, loading, controls
 *
 * Controls: range
 */

import { computed } from 'vue'
import { useCurrency } from 'src/composables/useCurrency'
import { useDataContext } from 'src/composables/data/useDataContext'
import useOutletFamilyData from '../Data/useOutletFamilyData'

export default (props) => {
  const d = useOutletFamilyData()
  const { _C } = useCurrency()
  const { rangeLabel } = useDataContext()

  return {
    widget: 'HorizontalRankBar',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { Outlets: 'Read', OutletConsumptionInvoices: 'Read' },
    title: 'Top mother companies billed',
    controls: d.controls.filter((c) => ['range'].includes(c.name)),
    widgetProps: {
      valueFormat: (v) => _C(v, true)
    },
    data: computed(() => ({
      items: d.topMotherCompaniesInvoiced.value,
      caption: `Group billing in ${rangeLabel(d.range.value)}`,
      empty: d.topMotherCompaniesInvoiced.value.length === 0,
      loading: d.loading.value
    }))
  }
}
