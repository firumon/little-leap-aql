import { cancellationCommentError } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentPayload'

/**
 * OutletPayments › Cancel › PageAction — JS modifier (tier 2: resource + page).
 *
 *   single step   reason   →   [ Cancel ] [ Cancel Receipt ]
 *
 * IT BUILDS NOTHING. `CancelConfirm` put the receipt's reversal and the invoice's walk into
 * pageState when the page loaded, so this only checks the reason and sends what is mounted.
 */
const PAYMENTS = 'OutletPayments'

export default (props, { pageState }) => {
  const reason = () => pageState?.getActions('Cancel', 'fields.ProgressCancelledComment', PAYMENTS)

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Cancel Receipt',
    // Destructive, so the button reads as such rather than as the page's neutral primary.
    submitColor: 'negative',

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: (name, { nav }) => {
      const problem = cancellationCommentError(reason())
      if (problem) return { valid: false, message: problem }

      return {
        successMsg: 'Payment receipt cancelled.',
        onSuccess: () => {
          pageState.reset()
          nav.goTo('view')
        }
      }
    }
  }
}
