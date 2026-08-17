import { useOutletPaymentIndex } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentIndex'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'

/**
 * OutletPayments › Index › LinearProgress — JS modifier (tier CP: resource + page).
 *
 * Visualizes daily overdue collection progress:
 * Numerator: Today's collections from overdue invoices.
 * Denominator: Overdue invoice amount + Today's collections from overdue invoices.
 *
 * Collapses to empty when there is no overdue obligation.
 */
export default function () {
  return {
    items: () => {
      const { linearProgressData } = useOutletPaymentIndex()
      const { _C } = useCurrencyResource()
      const progress = linearProgressData.value

      if (!progress || progress.denominator <= 0) return []

      return [
        {
          label: 'Overdue Collection Recovery',
          value: _C(progress.numerator, true),
          max: _C(progress.denominator, true),
          color: progress.ratio >= 0.8 ? 'positive' : (progress.ratio >= 0.4 ? 'teal-7' : 'orange'),
          unit: ''
        }
      ]
    }
  }
}
