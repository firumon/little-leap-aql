/**
 * Top 8 mother companies by total family outstanding debt balance.
 *
 * Answers: Which parent outlet groups owe the most unpaid money across all their branches?
 *
 * Uses:
 *   - useOutletFamilyData: topMotherCompaniesOutstanding, loading
 *
 * Controls: none (live debt balance across all unpaid invoices)
 */

import { computed } from 'vue'
import { useCurrency } from 'src/composables/useCurrency'
import useOutletFamilyData from '../Data/useOutletFamilyData'

export default (props) => {
  const d = useOutletFamilyData()
  const { _C } = useCurrency()

  return {
    widget: 'HorizontalRankBar',
    size: { xs: [12], sm: [12], md: [6, 8, 12], lg: [4, 6, 8], xl: [4, 6] },
    permission: { Outlets: 'Read', OutletConsumptionInvoices: 'Read', OutletPayments: 'Read' },
    title: 'Top mother companies by balance',
    controls: [],
    widgetProps: {
      valueFormat: (v) => _C(v, true)
    },
    data: computed(() => ({
      items: d.topMotherCompaniesOutstanding.value,
      caption: 'Total unpaid balance across all group branches',
      empty: d.topMotherCompaniesOutstanding.value.length === 0,
      loading: d.loading.value
    }))
  }
}
