import { canCancel } from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

/**
 * OutletReturns › Cancel › PageAction — JS modifier (tier 2: resource + page).
 *
 *   single step   reversal preview + reason   →   [ Cancel ] [ Cancel Return ]
 *
 * A single-step route, so `actions` is a plain array (UI_ACTION_SYSTEM.md §11 rule 4).
 *
 * ── THE SUBMIT VETOES FOR THREE REASONS ──
 *
 *   1. INVALIDITY — no reason typed. A cancelled return nobody can account for later is
 *      worse than no cancellation at all. (The reason does not yet PERSIST — see
 *      `CancelConfirm.vue` — but requiring it is still right, and the payload already
 *      carries it for the day the column exists.)
 *   2. STALENESS — the same `canCancel` predicate that gates the FAB, re-checked because
 *      time has passed: the return may have been completed by an invoice run or a warehouse
 *      confirmation while this page was open, at which point there is nothing to withdraw
 *      and the reversal would double-move stock.
 *   3. PERMISSION — gated on what the builder declares, which is a function of the record:
 *      a return whose flags wrote no ledger movement needs no movement permission, while
 *      one that did also writes the compensating row. A single literal map would either
 *      over-ask or under-ask (§8.4).
 *
 * The submit is destructive, so the button reads as such rather than as the page's neutral
 * primary.
 */
const NODE = 'OutletReturns'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  const record = () => resourceRecord?.record?.value || {}
  const reason = () => text(pageState.getControls('CancelReason', '', NODE))

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Cancel Return',
    submitColor: 'negative',

    // Abandoning goes back to the return, not `goBack()` — the reader may have arrived from
    // the index. Returning `false` stops the dispatcher's built-in `goBack()` popping a
    // second history entry on top of it.
    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const row = record()
      if (!text(row.Code)) return { valid: false, message: 'This return could not be loaded.' }

      if (!canCancel(row)) {
        return { valid: false, message: 'This return has already come to rest and can no longer be cancelled.' }
      }

      const why = reason()
      if (!why) return { valid: false, message: 'A cancellation reason is required.' }

      return {
        successMsg: `Return ${text(row.Code)} cancelled.`,
        // The typed reason would otherwise survive the navigation and re-seed the next
        // return opened on this route.
        onSuccess: () => { pageState.reset() }
      }
    },

    // Back to the ledger rather than to the cancelled record: there is nothing left to do
    // with it, and the reader's next action is almost always the next return.
    successRoute: 'index'
  }
}
