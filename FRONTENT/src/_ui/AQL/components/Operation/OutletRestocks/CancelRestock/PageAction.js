import { useAuth } from 'src/composables/core/useAuth'
import {
  CANCEL_REASON,
  activeItemsOf,
  cancellability,
  cancellableItems,
  returnableItems,
  buildRestockCancellationBatchRequests
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockCancellation'

/**
 * OutletRestocks › CancelRestock › PageAction — JS modifier (tier 2: resource + page).
 *
 *   single step   stock review + reason   →   [ Cancel ] [ Cancel Request ]
 *
 * A single-step route, so `actions` is a plain array rather than a getter — there is no
 * `currentStep` for it to track (UI_ACTION_SYSTEM.md §11 rule 4).
 *
 * THE SUBMIT VETOES FOR THREE REASONS:
 *
 *   1. INVALIDITY — no reason typed. A cancelled request nobody can account for later is
 *      worse than no cancellation at all.
 *   2. STALENESS  — the same `cancellability` predicate that gates the FAB, re-checked here
 *      because time has passed: the request may have been fully delivered while this page
 *      was open, at which point there is nothing left to withdraw.
 *   3. PERMISSION — the batch writes warehouse movements, so it is gated on the ledger
 *      write it actually performs, not merely on updating the request.
 *
 * This modifier runs OUTSIDE a setup context, so it imports only the PURE domain exports
 * and reads its rows off the injected `resourceRecord` — the same rows `CancelReview.vue`
 * renders its preview from.
 */
const PARENT = 'OutletRestocks'
const CHILD = 'OutletRestockItems'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  // Safe outside setup: `useAuth` only reaches Pinia stores and calls no `inject()`.
  const { user } = useAuth()

  const restock = () => resourceRecord?.record?.value || {}
  const actor = () => user.value?.name || user.value?.email || ''
  const reason = () => text(pageState.getControlField(PARENT, CANCEL_REASON))

  function childRows () {
    const rows = (resourceRecord?.childRecordsByResource?.value || {})[CHILD]
    return Array.isArray(rows) ? rows.map(asRow) : []
  }

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Cancel Request',
    // Destructive, so the button reads as such rather than as the page's neutral primary.
    submitColor: 'negative',

    // Abandoning goes back to the request, not `goBack()` — the driver may have arrived
    // from the index. Returning `false` stops the built-in `goBack()` popping a second
    // history entry.
    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const parent = restock()
      if (!text(parent.Code)) return { valid: false, message: 'This restock request could not be loaded.' }

      const why = reason()
      if (!why) return { valid: false, message: 'A cancellation reason is required.' }

      const gate = cancellability(parent)
      if (!gate.allowed) return { valid: false, message: gate.reason }

      const rows = activeItemsOf(childRows(), parent.Code)
      if (!cancellableItems(rows, parent.Code).length && rows.length) {
        return { valid: false, message: 'Every line on this request has already been settled.' }
      }

      /**
       * Gated on what the batch ACTUALLY writes. A request with nothing allocated moves no
       * warehouse stock, so it must not demand the movement permission it never uses —
       * failing closed on a permission the action does not need is as wrong as failing open
       * on one it does.
       */
      const permissions = { OutletRestocks: 'update', OutletRestockItems: 'update' }
      if (returnableItems(rows, parent.Code).length) permissions.StockMovements = 'create'
      if (resourceConfig?.allowed(permissions) !== true) {
        return { valid: false, message: 'You are not allowed to cancel this restock request.' }
      }

      return {
        requests: buildRestockCancellationBatchRequests(parent, rows, actor(), why),
        successMsg: returnableItems(rows, parent.Code).length
          ? 'Restock cancelled and warehouse stock returned.'
          : 'Restock cancelled.',
        // Land back on the record so the driver sees the settled state and its lines,
        // rather than being returned to a list. `pageState.reset()` first, or the typed
        // reason survives the navigation and re-seeds the next visit.
        onSuccess: () => {
          pageState.reset()
        }
      }
    },

    successRoute: 'view'
  }
}
