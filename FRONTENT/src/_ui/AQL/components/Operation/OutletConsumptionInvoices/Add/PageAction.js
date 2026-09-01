// The wizard keeps the whole submission live in pageState, so this bar only gates the steps.
// `actions` must stay a getter, or the step read is not tracked (UI_ACTION_SYSTEM.md §1.3).
import { INVOICE_GENERATED_MESSAGE } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'

const NODE = 'OutletConsumptionInvoices'
const ITEMS = 'OutletConsumptionInvoiceItems'
const BUILD_ERROR = 'BuildError'

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default (props, { pageState }) => {
  const node = pageState.useNode(NODE)

  // Defaults to 1: an unset step would fall past the step-1 branch into the item check.
  const step = () => pageState.meta?.currentStep || 1
  const outlet = () => text(node.record.value?.OutletCode)
  const lines = () => pageState.getChildRows(ITEMS, NODE).filter((row) => num(row.Qty) > 0)
  // What the last Layer 2 rebuild refused, in its own words. The domain decides the message.
  const buildError = () => text(pageState.getControls(BUILD_ERROR, null, NODE))

  return {
    get actions () {
      if (step() === 2) return ['back', 'next']
      if (step() === 3) return ['back', 'submit']
      return ['cancel', 'next']
    },

    submitLabel: 'Generate Invoice',

    // The user may have come from an Invoiceable Outlets row, so go to the list, not back.
    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    next: () => {
      if (step() === 1) {
        if (!outlet()) return { valid: false, message: 'Select an outlet to continue.' }
        return undefined
      }
      if (!lines().length) {
        return { valid: false, message: 'Add at least one item with a quantity before continuing.' }
      }
      return undefined
    },

    submit: () => {
      if (!outlet()) return { valid: false, message: 'Select an outlet to continue.' }
      if (!lines().length) {
        return { valid: false, message: 'Add at least one item with a quantity before continuing.' }
      }
      const refused = buildError()
      if (refused) return { valid: false, message: refused }

      return { successMsg: INVOICE_GENERATED_MESSAGE }
    }
  }
}
