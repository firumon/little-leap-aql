
/**
 * OutletPayments › Add › PageAction — JS modifier (tier CP: resource + page).
 *
 * Drives the 3-step collection recorder from the sticky form-actions bar, so the step cards
 * stay pure inputs with no navigation of their own:
 *
 *   step 1  outlet + invoices   →  [ Cancel ] [ Continue ]
 *   step 2  amount + split      →  [ Back   ] [ Continue ]
 *   step 3  review              →  [ Back   ] [ Record Payment ]
 *
 * `actions` is a GETTER, not a plain array: `useActionResolver` calls this factory once per
 * resolve and caches the result, but merges it into `finalProps` inside a `computed` — so a
 * getter is re-read on every recompute and its reads of `pageState.meta.currentStep` are
 * tracked. A literal array would latch the step-1 button set forever (UI_ACTION_SYSTEM.md §1.3).
 *
 * Only `next` is intercepted; `back` is left to the dispatcher's built-in decrement. `next`
 * vetoes by returning `{ valid: false, message }` and on success returns nothing, so the
 * built-in increment performs the move (§4).
 *
 * ── A THIN ADAPTER, NOTHING MORE (UI_RESOURCE_DOMAIN_LOGIC.md §9.1) ──
 * `submit` collects the wizard's answers and hands them to
 * `buildOutletPaymentCreationNodes`. It performs NO arithmetic and builds NO rows: how many
 * payment rows one collection becomes, which invoice transitions to `PAID` versus
 * `PARTIALLY_PAID`, whether a residual is small enough to waive and what audit sentence that
 * writes are all decided in Layer 2 — identically whether a payment is recorded here or
 * chained off an invoice (Zero UI Schema Invention).
 *
 * It re-reads the control fields rather than importing the page context, because a
 * `PageAction.js` runs OUTSIDE any component `setup()` and cannot call the `inject()` the
 * context composable owns. It receives `pageState` as a parameter instead, which is the
 * documented exemption (§6).
 */

const NODE = 'OutletPayments'

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default (props, { pageState, resourceConfig }) => {
  /**
   * Register the page's form node.
   *
   * This wizard writes no record through `pageState` — every answer is a CONTROL FIELD and the
   * requests are built in Layer 2 — but the node still has to EXIST, because the sticky bar
   * mounts against it and renders nothing without one. Step 1's `initNode` normally gets there
   * first; this call is the guard for the case where the bar resolves ahead of the card.
   */
  pageState.useNode(NODE)

  const field = (header, fallback = '') => {
    const value = pageState.getControls(header, null, NODE)
    return value === undefined || value === null ? fallback : value
  }

  // Defaulted to 1, never read bare. Before the first step move `currentStep` may not be set,
  // and an undefined step would fall past the step-1 branch into the amount check — vetoing
  // `next` on a wizard that has not asked for an amount yet, stranding the user on step 1.
  const step = () => pageState.meta?.currentStep || 1
  const outlet = () => text(field('OutletCode'))
  // The receipt rows the batch actually carries - not a second copy of the answer.
  const receiptRows = () => pageState.getRecordRows(NODE)
  const invoiceCodes = () => receiptRows().map((row) => text(row.OutletConsumptionInvoiceCode)).filter(Boolean)
  const amount = () => num(field('Amount', 0))

  return {
    get actions () {
      if (step() === 2) return ['back', 'next']
      if (step() === 3) return ['back', 'submit']
      return ['cancel', 'next']
    },

    submitLabel: 'Record Payment',

    // Leaving the wizard abandons an unrecorded collection, so go to the list rather than
    // `goBack()` — the user may have arrived from an invoice queue row. Returning false stops
    // the built-in goBack() popping a second history entry.
    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    next: () => {
      if (step() === 1) {
        if (!outlet()) return { valid: false, message: 'Select the outlet making the payment.' }
        if (!invoiceCodes().length) return { valid: false, message: 'Select at least one invoice to settle.' }
        return undefined
      }

      // Step 2 → 3. Both checks are restated by the builder at submit time; they are repeated
      // here so the user is stopped at the step that can still fix it, rather than on a review
      // card that would show a receipt it cannot write.
      const collected = amount()
      if (collected <= 0) {
        return { valid: false, message: 'Enter the amount collected.' }
      }

      const allocated = receiptRows().reduce((sum, row) => sum + num(row.Amount), 0)
      if (Math.abs(allocated - collected) > 0.01) {
        return {
          valid: false,
          message: `The split (${allocated.toFixed(2)}) does not add up to the amount collected (${collected.toFixed(2)}).`
        }
      }

      return undefined
    },

    // Validation only. `useOutletPaymentAddContext` hands the wizard's answers to
    // `buildOutletPaymentCreationNodes` on every change, so the receipt rows are already
    // in the batch (UI_PAGE_STATE.md §5B).
    submit: () => {
      if (!outlet()) return { valid: false, message: 'Select an outlet to record payment.' }
      if (!invoiceCodes().length) return { valid: false, message: 'Select at least one invoice to settle.' }
      if (amount() <= 0) return { valid: false, message: 'Enter the amount collected.' }

      // A ticked invoice that got no share is a receipt row of zero. It is kept all the way
      // through the wizard because the rows ARE the tick list, so dropping it earlier would
      // wipe the selection and break Back. Here there is no way back, so it goes.
      const rows = receiptRows()
      for (let i = rows.length - 1; i >= 0; i--) {
        if (num(rows[i].Amount) <= 0) pageState.removeRecord(i, NODE)
      }

      return { successMsg: 'Payment recorded.' }
    }
  }
}
