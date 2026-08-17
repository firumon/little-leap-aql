import { useOutletPaymentIndex } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentIndex'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'

/**
 * OutletPayments › Index › MetricCards — JS modifier (tier CP: resource + page).
 *
 * Provides two urgent operational numbers:
 * 1. Overdue Invoices: total money past due terms and count of overdue invoices.
 * 2. Today's Collections: total collected today and number of payments logged.
 */
export default function () {
  return {
    items: () => {
      const { overdueMetrics, todayCollectionsMetrics } = useOutletPaymentIndex()
      const { _C } = useCurrencyResource()

      const overdue = overdueMetrics.value
      const today = todayCollectionsMetrics.value

      return [
        {
          label: overdue.count > 0 ? `Overdue Invoices (${overdue.count})` : 'Overdue Invoices',
          number: _C(overdue.amount, true),
          unit: overdue.count ? `${overdue.count} inv` : '',
          color: overdue.count > 0 ? 'negative' : 'positive'
        },
        {
          label: 'Collected Today',
          number: _C(today.amount, true),
          unit: today.count ? `${today.count} pymt${today.count > 1 ? 's' : ''}` : '',
          color: 'teal-7'
        }
      ]
    }
  }
}
