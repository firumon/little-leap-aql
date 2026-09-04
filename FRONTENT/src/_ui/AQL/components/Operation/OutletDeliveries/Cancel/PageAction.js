import { useAuth } from 'src/composables/core/useAuth'
import { itemRowsForCodes } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryRows'
import { buildDeliveryCancelNodes } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryPayload'
import { orsisForDelivery } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

/**
 * OutletDeliveries › Cancel › PageAction — JS modifier (tier 2: resource + page).
 *
 *   single step   reason   →   [ Cancel ] [ Cancel Delivery ]
 *
 * ── THE SUBMIT VETOES FOR THREE REASONS ──
 *
 *   1. INVALIDITY — no reason typed. Unlike `OutletReturns`, this sheet HAS a
 *      `CancelledComment` column, so the reason genuinely persists and shows on the View
 *      timeline afterwards — which is what makes requiring it worth doing.
 *   2. STALENESS — `canCancel` is DRAFT-only AND requires that nothing has been handed
 *      over. Re-checked by the builder against the manifest's lines, because a driver may
 *      have delivered the first stop while this page was open, at which point the run has
 *      physically happened and there is nothing to void.
 *   3. PERMISSION — gated on what the builder declares. Cancelling writes the manifest and
 *      re-evaluates its parent requests, so it asks for those two — and notably NOT for
 *      movement permissions, because cancelling a run moves no stock at all.
 *
 * Destructive, so the button reads as such rather than as the page's neutral primary.
 *
 * ── WHY THE ITEM ROWS ARE READ HERE ──
 * `canCancel`'s second half is a question about the manifest's LINES, which live on another
 * resource and are not brought by the record loader — and the predicate FAILS CLOSED without
 * them, so passing them is what makes a legitimate cancellation possible at all.
 */
const NODE = 'OutletDeliveries'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  // Safe outside setup: neither reaches `inject()`.
  const { user } = useAuth()

  const record = () => resourceRecord?.record?.value || {}
  const actor = () => text(user.value?.name || user.value?.email || '')
  // The reason is a COLUMN on this sheet, so it lives on the live node's record, not in
  // a control mirroring it (UI_PAGE_STATE_NODES.md §5A.1).
  const reason = () => text(pageState.getRecord('CancelledComment', NODE))

  /** Only the rows this manifest carries — see `MarkComplete/PageAction.js`. */
  const manifestRows = () => itemRowsForCodes(orsisForDelivery(record()))

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Cancel Delivery',
    submitColor: 'negative',

    // Abandoning goes back to the run, not `goBack()` — the reader may have arrived from the
    // index. Returning `false` stops the dispatcher's built-in `goBack()` popping a second
    // history entry on top of it.
    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const row = record()
      if (!text(row.Code)) return { valid: false, message: 'This delivery could not be loaded.' }

      const result = buildDeliveryCancelNodes({
        record: row,
        orsiRows: manifestRows(),
        actorName: actor(),
        reason: reason()
      })

      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false

      // No `onSuccess` of its own: `PageAction.vue` installs its default — reset pageState,
      // then follow `successRoute` — only when the submit supplies none. Overriding it to
      // call `reset()` silently drops the navigation and the success notice.
      return { successMsg: applied.successMsg }
    },

    // Back to the ledger rather than to the cancelled run: there is nothing left to do with
    // it, and the coordinator's next act is almost always planning the replacement.
    successRoute: 'index'
  }
}
