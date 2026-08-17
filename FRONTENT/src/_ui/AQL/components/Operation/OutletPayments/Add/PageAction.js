import { useAuth } from 'src/composables/core/useAuth'
import { useOutletPaymentIndex } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentIndex'
import { buildOutletPaymentCreationRequests } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentPayload'

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
 * `buildOutletPaymentCreationRequests`. It performs NO arithmetic and builds NO rows: how many
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
const asArray = (value) => (Array.isArray(value) ? value : [])

export default (props, { pageState, resourceConfig }) => {
  // Safe outside setup: `useAuth` only reaches Pinia stores and calls no `inject()`. `user`
  // stays a computed, so reading it at submit time gives the live session user.
  const { user } = useAuth()

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
    const value = pageState.getControlField(NODE, header)
    return value === undefined || value === null ? fallback : value
  }

  // Defaulted to 1, never read bare. Before the first step move `currentStep` may not be set,
  // and an undefined step would fall past the step-1 branch into the amount check — vetoing
  // `next` on a wizard that has not asked for an amount yet, stranding the user on step 1.
  const step = () => pageState.meta?.currentStep || 1
  const outlet = () => text(field('OutletCode'))
  const invoiceCodes = () => asArray(field('InvoiceCodes', [])).map(text).filter(Boolean)
  const allocations = () => {
    const value = field('Allocations', {})
    return value && typeof value === 'object' ? value : {}
  }
  const amount = () => num(field('Amount', 0))

  /**
   * The chosen invoices, as the aggregate's own rows.
   *
   * Re-resolved from `useOutletPaymentIndex` rather than carried in a control field: the
   * builder needs each invoice's stored totals and its existing payments to decide the
   * transition, and a snapshot written at selection time would let a payment recorded from
   * another device in the meantime go unseen.
   */
  function selectedInvoices () {
    const { openInvoices } = useOutletPaymentIndex()
    const chosen = new Set(invoiceCodes())
    return openInvoices.value
      .filter((row) => chosen.has(text(row.code)))
      .map((row) => ({ ...row, Code: text(row.code) }))
  }

  const actorName = () => text(user.value?.name || user.value?.email) || 'Unknown'

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

      const allocated = Object.values(allocations()).reduce((sum, value) => sum + num(value), 0)
      if (Math.abs(allocated - collected) > 0.01) {
        return {
          valid: false,
          message: `The split (${allocated.toFixed(2)}) does not add up to the amount collected (${collected.toFixed(2)}).`
        }
      }

      return undefined
    },

    submit: () => {
      const { rawPayments } = useOutletPaymentIndex()
      const actor = actorName()

      const result = buildOutletPaymentCreationRequests({
        selectedOutletCode: outlet(),
        selectedInvoices: selectedInvoices(),
        allocations: allocations(),
        totalAmount: amount(),
        mode: text(field('Mode')) || 'Cash',
        reference: text(field('Reference')),
        // The logged-in collector and today's date are stamped onto every payment row by the
        // builder, from these two values — see `buildOutletPaymentCreationRequests`.
        username: actor,
        actorName: actor,
        existingPayments: rawPayments.value,
        waiveResidual: field('WaiveResidual', false) === true,
        waiverReason: text(field('WaiverReason')),
        waiverComment: text(field('WaiverComment'))
      })

      if (!result.valid) return { valid: false, message: result.message }
      if (resourceConfig?.allowed(result.permissions) !== true) {
        return { valid: false, message: 'You are not allowed to record this payment.' }
      }

      return { requests: result.requests, successMsg: result.successMsg }
    }
  }
}
