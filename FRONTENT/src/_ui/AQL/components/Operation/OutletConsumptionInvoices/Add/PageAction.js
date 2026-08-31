
/**
 * OutletConsumptionInvoices › Add › PageAction — JS modifier (tier CP: resource + page).
 *
 * Drives the 3-step invoice generator from the sticky form-actions bar, so the step cards
 * stay pure inputs with no navigation of their own:
 *
 *   step 1  outlet + counts   →  [ Cancel ] [ Continue ]
 *   step 2  lines + prices    →  [ Back   ] [ Continue ]
 *   step 3  terms + review    →  [ Back   ] [ Generate Invoice ]
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
 * THE BATCH IS LIVE. `useInvoiceAddContext` hands the wizard's answers to
 * `buildInvoiceGenerationNodes` on every change, so which columns the header carries, how
 * the lines are priced and taxed, which consumptions get walked to `INVOICE_GENERATED` and
 * which returns get marked adjusted are all decided in Layer 2 as the user works. `submit`
 * only validates (UI_PAGE_STATE.md §5B).
 *
 * It re-reads the control fields rather than importing the page context, because a
 * `PageAction.js` runs OUTSIDE any component `setup()` and cannot call the `inject()` the
 * context composable owns. It receives `pageState` as a parameter instead, which is the
 * documented exemption (§6).
 */

const NODE = 'OutletConsumptionInvoices'
const ITEMS = 'OutletConsumptionInvoiceItems'

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default (props, { pageState }) => {
  /**
   * Register the page's form node.
   *
   * This wizard writes no record through `pageState` — every answer is a CONTROL FIELD and
   * the requests are built in Layer 2 — but the node still has to EXIST, because the sticky
   * form-actions bar mounts against the page's node and renders nothing without one. Calling
   * `useNode` is what creates it; the returned handle is deliberately unused.
   */
  pageState.useNode(NODE)

  const step = () => pageState.meta?.currentStep || 1
  const outlet = () => text(pageState.getRecord('OutletCode', NODE))

  // The lines are the node's own children now, so there is nothing to re-derive here: the
  // bill this checks IS the bill the batch carries.
  const billableLines = () => pageState.getChildRows(ITEMS, NODE).filter((row) => num(row.Qty) > 0)

  return {
    get actions () {
      if (step() === 2) return ['back', 'next']
      if (step() === 3) return ['back', 'submit']
      return ['cancel', 'next']
    },

    submitLabel: 'Generate Invoice',

    // Leaving the wizard abandons an unsaved invoice, so go to the list rather than
    // `goBack()` — the user may have arrived from an Invoiceable Outlets row. Returning
    // false stops the built-in goBack() popping a second history entry.
    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    next: () => {
      if (step() === 1) {
        if (!outlet()) return { valid: false, message: 'Select an outlet to continue.' }
        return
      }
      if (!billableLines().length) {
        return { valid: false, message: 'Add at least one item with a quantity before continuing.' }
      }
      return undefined
    },

    submit: () => {
      if (!outlet()) return { valid: false, message: 'Select an outlet to invoice.' }
      if (!billableLines().length) return { valid: false, message: 'This invoice has no billable lines.' }

      return { successMsg: 'Invoice generated.' }
    }
  }
}

