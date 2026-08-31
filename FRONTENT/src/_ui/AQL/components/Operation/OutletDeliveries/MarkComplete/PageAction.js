import { itemRowsForCodes } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryRows'
import {
  deliveryRatio,
  isInTransit,
  orsisForDelivery
} from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

/**
 * OutletDeliveries › MarkComplete › PageAction — JS modifier (tier 2: resource + page).
 *
 *   single step   confirmation + optional note   →   [ Cancel ] [ Complete Delivery ]
 *
 * The SAFETY NET route — see `CompleteConfirm.vue` for why it exists at all when delivery
 * auto-closes a finished run.
 *
 * ── THE SUBMIT VETOES FOR TWO REASONS ──
 *
 *   1. VALIDITY + STALENESS — both are `canComplete`, which the builder re-checks itself
 *      against the manifest's lines and reports with the outstanding COUNT in its message.
 *      Restating the check here would only risk phrasing it differently from the banner the
 *      user just read, so the builder's message is passed through unchanged (§8.5 step 3).
 *   2. PERMISSION — gated on what the builder declares. Closing a run writes one column and
 *      three stamps on one row; no line changes state and no stock moves, so it asks for
 *      `outletDelivery: 'update'` alone. This is exactly §8.4's "child-only routes isolate
 *      permissions" read from the other end: a route that touches only the parent must not
 *      demand the movement permission the delivery route needs.
 *
 * ── WHY THE ITEM ROWS ARE READ HERE ──
 * `canComplete` is a question about the manifest's LINES, which live on another resource;
 * the record loader brings none of them. They come from the Layer 2 accessor
 * (`useDeliveryRows`), which is safe outside a component setup where `useRecord` is not, and
 * they go straight to Layer 2 — no rule is decided here.
 */
const NODE = 'OutletDeliveries'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  const record = () => resourceRecord?.record?.value || {}

  /**
   * Only the rows this manifest carries.
   *
   * `canComplete` measures delivered-against-total over the manifest's own CSV, so handing
   * it the whole item sheet is harmless but wasteful; narrowing here keeps the builder's
   * indexing proportional to the run rather than to the tenant.
   */
  const manifestRows = () => itemRowsForCodes(orsisForDelivery(record()))

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Complete Delivery',

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const row = record()
      if (!text(row.Code)) return { valid: false, message: 'This delivery could not be loaded.' }

      // The same two questions the builder asks, so the veto the user reads here is the
      // one that would have stopped the batch.
      if (!isInTransit(row)) return { valid: false, message: 'Only a delivery in transit can be completed.' }
      const ratio = deliveryRatio(row, manifestRows())
      const outstanding = ratio.total - ratio.delivered
      if (!ratio.total || outstanding > 0) {
        return { valid: false, message: `${outstanding} item${outstanding === 1 ? ' is' : 's are'} still undelivered on this delivery.` }
      }

      return {
        successMsg: `Delivery ${text(row.Code)} completed.`,
        onSuccess: () => { pageState.reset() }
      }
    },

    successRoute: 'view'
  }
}
