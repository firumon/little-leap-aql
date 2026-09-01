// The wizard keeps the whole collection live in pageState, so this bar only gates the steps.
// `actions` must stay a getter, or the step read is not tracked (UI_ACTION_SYSTEM.md §1.3).
import { PAYMENT_RECORDED_MESSAGE } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentPayload'

const NODE = 'OutletPayments'
const BUILD_ERROR = 'BuildError'

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default (props, { pageState }) => {
  pageState.useNode(NODE)

  const control = (header, fallback = '') => {
    const value = pageState.getControls(header, null, NODE)
    return value === undefined || value === null ? fallback : value
  }

  // Defaults to 1: an unset step would fall past the step-1 branch into the amount check.
  const step = () => pageState.meta?.currentStep || 1
  const outlet = () => text(control('OutletCode'))
  // One receipt row per invoice this collection settles - the selection IS the rows.
  const rows = () => pageState.getRecordRows(NODE)
  const amount = () => num(control('Amount', 0))
  const allocated = () => rows().reduce((sum, row) => sum + num(row.Amount), 0)
  // What the last Layer 2 rebuild refused, in its own words. The domain decides the message.
  const buildError = () => text(pageState.getControls(BUILD_ERROR, null, NODE))

  // Restated at submit by the builder too; checked here so the user is stopped on the step
  // that can still fix it.
  function checkSplit () {
    const collected = amount()
    if (collected <= 0) return { valid: false, message: 'Enter the amount collected.' }
    const total = allocated()
    if (Math.abs(total - collected) > 0.01) {
      return {
        valid: false,
        message: `The split (${total.toFixed(2)}) does not add up to the amount collected (${collected.toFixed(2)}).`
      }
    }
    return undefined
  }

  return {
    get actions () {
      if (step() === 2) return ['back', 'next']
      if (step() === 3) return ['back', 'submit']
      return ['cancel', 'next']
    },

    submitLabel: 'Record Payment',

    // The user may have come from an invoice queue row, so go to the list, not back.
    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    next: () => {
      if (step() === 1) {
        if (!outlet()) return { valid: false, message: 'Select the outlet making the payment.' }
        if (!rows().length) return { valid: false, message: 'Select at least one invoice to settle.' }
        return undefined
      }
      return checkSplit()
    },

    submit: () => {
      if (!outlet()) return { valid: false, message: 'Select the outlet making the payment.' }
      if (!rows().length) return { valid: false, message: 'Select at least one invoice to settle.' }
      const split = checkSplit()
      if (split) return split
      const refused = buildError()
      if (refused) return { valid: false, message: refused }

      return { successMsg: PAYMENT_RECORDED_MESSAGE }
    }
  }
}
