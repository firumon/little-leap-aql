import { useAuth } from 'src/composables/core/useAuth'
import { restockItemRows, restockRows } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryRows'
import { buildDeliveryMarkDeliveredNodes } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryPayload'
import { canDeliver } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

/**
 * OutletDeliveries › MarkDeliver › PageAction — JS modifier (tier 2: resource + page).
 *
 *   single step   tick what was handed over   →   [ Cancel ] [ Mark Delivered ]
 *
 * The one route in this module that moves stock. Confirming here writes, atomically: every
 * ticked line to DELIVERED, one positive `OutletMovements` row per line, the parent restock
 * requests' recomputed progress, and the manifest's own next state — all assembled by
 * Layer 2, which delegates the per-line half to the RESTOCK domain so a line delivered on a
 * run and the same line delivered directly land identically (§9.1).
 *
 * ── THE SUBMIT VETOES FOR THREE REASONS ──
 *
 *   1. STALENESS — the same `canDeliver` predicate that gates the FAB, re-checked because
 *      time has passed: the run may have been completed or cancelled while this page was
 *      open, and delivering against it then would write movements for a closed manifest.
 *   2. VALIDITY — nothing ticked, or every ticked line already delivered. Both are the
 *      BUILDER's rules and are reported through its own message rather than restated here
 *      (§8.5 step 3). The already-delivered filter matters: it is what makes a double-submit
 *      after a slow network a no-op rather than a doubled ledger.
 *   3. PERMISSION — gated on the four resources the builder declares it writes, not on the
 *      manifest alone (§8.4, "name every resource the batch writes"). A user who may edit a
 *      run but not move stock must not be able to complete this.
 *
 * ── WHY THE ROWS ARE READ HERE ──
 * The builder needs the full item and restock sets to group lines by parent, resolve each
 * line's outlet, and answer "is anything still outstanding on this request?" — a question
 * about rows NOT being delivered, which a builder handed only the selection cannot answer.
 * They come from the Layer 2 accessor (`useDeliveryRows`), NOT from `useRecord`: a modifier
 * runs outside any component setup and `useRecord` calls `useQuasar()`, which needs one. No
 * rule is decided locally; the rows are read and handed straight to Layer 2.
 */
const NODE = 'OutletDeliveries'
const SELECTION_FIELD = 'DeliverSelection'
const COMMENT_FIELD = 'DeliverComment'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  // Safe outside setup: neither reaches `inject()`.
  const { user } = useAuth()

  const record = () => resourceRecord?.record?.value || {}
  const actor = () => text(user.value?.name || user.value?.email || '')

  const selectedCodes = () => {
    const raw = pageState.getControls(SELECTION_FIELD, null, NODE)
    return Array.isArray(raw) ? raw.map(text).filter(Boolean) : []
  }

  return {
    actions: ['cancel', 'submit'],
    // Named for the count, so the driver confirms a number rather than a verb.
    submitLabel: () => {
      const count = selectedCodes().length
      return count ? `Mark ${count} Delivered` : 'Mark Delivered'
    },

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const row = record()
      if (!text(row.Code)) return { valid: false, message: 'This delivery could not be loaded.' }

      if (!canDeliver(row)) {
        return { valid: false, message: 'This delivery has come to rest and can no longer take deliveries.' }
      }

      const result = buildDeliveryMarkDeliveredNodes({
        deliveryRecord: row,
        deliveredOrsiCodes: selectedCodes(),
        allOrsiRows: restockItemRows(),
        allRestockRows: restockRows(),
        actorName: actor(),
        comment: text(pageState.getControls(COMMENT_FIELD, null, NODE))
      })



      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false
      return {
        successMsg: applied.successMsg,
        // The ticks and the note would otherwise survive the navigation and re-seed the next
        // run opened on this route.
        onSuccess: () => { pageState.reset() }
      }
    },

    // Back to the manifest, so the driver sees what is left on the run.
    successRoute: 'view'
  }
}
