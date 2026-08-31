import { useDataStore } from 'src/stores/data'
import { settlementGate, validateSettlement } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'
import { countsAsPayment } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import { NODE } from 'src/_ui/AQL/composables/Operation/OutletConsumptionInvoices/MarkPaid/useInvoiceSettleContext'

/**
 * OutletConsumptionInvoices › MarkPaid › PageAction — JS modifier (tier 2: resource + page).
 *
 *   single step   reason + amount + note   →   [ Cancel ] [ Settle Invoice ]
 *
 * A single-step route, so `actions` is a plain array rather than a getter (§11 rule 4).
 *
 * IT ASSEMBLES NOTHING. The three answers go straight to `buildSettlementNodes`, which
 * validates them, derives the outstanding balance from the payment rows itself, and returns
 * the envelope — so this handler holds no rule that Layer 2 does not already own (§8.5).
 *
 * THE SUBMIT VETOES FOR TWO REASONS (§13.6):
 *
 *   1. STALENESS — the same `settlementGate` the card's lock banner reads, re-checked
 *      because time has passed: a payment may have cleared the balance while this page was
 *      open, and settling then would stamp a write-off against nothing.
 *   2. PERMISSION — gated on what the BUILDER declares rather than a literal map written
 *      here (§8.5 step 4).
 *
 * Invalidity is NOT checked here. `validateSettlement` behind the builder owns it, including
 * the rule GAS cannot express — that `Other` demands a comment — so the message the user
 * sees is the domain's own wording rather than a second copy of it.
 */
const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  // Safe outside setup: reaches Pinia stores and calls no `inject()`.
  const dataStore = useDataStore()

  const record = () => asRow(resourceRecord?.record?.value)
  const control = (key) => pageState?.getControls(key, undefined, NODE)

  /** This invoice's own payment rows — the join the builder derives the balance from. */
  const paymentsFor = (code) => (dataStore.getRecords('OutletPayments') || [])
    .map(asRow)
    .filter((row) => text(row.OutletConsumptionInvoiceCode) === code && countsAsPayment(row))

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Settle Invoice',

    // Abandoning goes back to the record, not `goBack()` — the user may have arrived from
    // the index. Returning `false` stops the built-in `goBack()` popping a second entry.
    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: (name, { nav }) => {
      const invoice = record()
      const code = text(invoice.Code)
      if (!code) return { valid: false, message: 'This invoice could not be loaded.' }

      const payments = paymentsFor(code)

      // Re-checked at submit, not merely at entry — see the docblock's reason 1.
      const gate = settlementGate(invoice, payments)
      if (!gate.allowed) return { valid: false, message: gate.reason }

      const check = validateSettlement({
        record: invoice,
        reason: control('SettlementReason'),
        comment: control('SettlementComment'),
        mismatchAmount: control('SettlementMismatchAmount'),
        balanceDue: gate.balance
      })
      if (!check.valid) return { valid: false, message: check.message }

      return {
        successMsg: 'Invoice settled.',
        // Lands back on the record so the settlement banner is the first thing seen.
        // `reset()` first, or the typed reason survives and re-seeds the next visit.
        onSuccess: () => {
          pageState.reset()
          nav.goTo('view')
        }
      }
    }
  }
}
