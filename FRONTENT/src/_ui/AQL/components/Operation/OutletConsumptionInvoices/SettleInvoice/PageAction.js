// The cards keep the whole settlement live in pageState, so this bar assembles nothing: it
// checks the answers, re-checks the gate, and sends what is already standing.
import { settlementGate, SETTLEMENT_OTHER } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'
import { countsAsPayment } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import { NODE } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/SettleInvoice/useInvoiceSettleContext'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export default (props, { pageState, resourceRecord }) => {

  const record = () => asRow(resourceRecord?.record?.value)
  const field = (header) => text(pageState?.getRecord(header, NODE))
  const reason = () => field('SettlementReason')
  const comment = () => field('ProgressPaidComment')
  const commentRequired = () => reason() === SETTLEMENT_OTHER

  const paymentsFor = (code) => {
    const r = record()
    const childRows = r?.$OutletPayments || r?.$outletpayments || []
    return childRows
      .map(asRow)
      .filter((row) => text(row.OutletConsumptionInvoiceCode) === code && countsAsPayment(row))
  }

  const eligible = () => settlementGate(record(), paymentsFor(text(record().Code))).allowed

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Make PAID',

    // Function form, so the bar re-reads the gate on every keystroke.
    disabled: () => !eligible() || !reason() || (commentRequired() && !comment()),

    // Abandoning goes back to the record: the user may have arrived from the index.
    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: (name, { nav }) => {
      const code = text(record().Code)
      if (!code) return { valid: false, message: 'This invoice could not be loaded.' }
      // Re-checked here: a payment may have cleared the balance while this page was open.
      const gate = settlementGate(record(), paymentsFor(code))
      if (!gate.allowed) return { valid: false, message: gate.reason }
      if (!reason()) return { valid: false, message: 'Select a settlement reason.' }
      if (commentRequired() && !comment()) {
        return { valid: false, message: 'A comment is required when the settlement reason is "Other".' }
      }

      return {
        successMsg: 'Invoice settled.',
        // Lands back on the record so the settlement banner is the first thing seen.
        onSuccess: () => {
          pageState.reset()
          nav.goTo('view')
        }
      }
    }
  }
}
