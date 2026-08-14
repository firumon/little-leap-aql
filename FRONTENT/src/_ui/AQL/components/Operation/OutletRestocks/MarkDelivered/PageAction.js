import { useAuth } from 'src/composables/core/useAuth'
import { buildRestockDeliveryBatchRequests } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import {
  deliverableRows,
  normalizeSelection,
  SELECTION
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockDelivery'

/**
 * OutletRestocks › MarkDelivered › PageAction — JS modifier (tier 2: resource + page).
 *
 * Drives the 2-step delivery confirmation entirely from the sticky bar, so the
 * cards stay pure inputs with no navigation or dispatch of their own:
 *
 *   step 1  pick the items that arrived  →  [ Cancel ] [ Continue         ]
 *   step 2  review + GRN note            →  [ Back   ] [ Confirm Delivery ]
 *
 * `actions` is a GETTER, not a literal array. `useActionResolver` calls this
 * factory once per resolve and caches the result, but merges it into `finalProps`
 * inside a `computed` — so a getter is re-read on every recompute and its reads of
 * `pageState.meta.currentStep` are tracked. A literal array would latch the step-1
 * button set forever (UI_ACTION_SYSTEM.md §1.3).
 *
 * This modifier runs OUTSIDE a setup context, so it cannot call
 * `useRestockDelivery()` (which injects and mounts). It does not need to: the
 * driver's decision is already fully materialized in the `DeliverySelection`
 * control field, and the item rows come off the injected `resourceRecord`. Only
 * the PURE exports of that composable are imported here — the same filter the
 * cards render from, so what is submitted is what step 2 displayed.
 */
const PARENT = 'OutletRestocks'
const CHILD = 'OutletRestockItems'
const COMMENT = 'DeliveryComment'

const text = (value) => String(value ?? '').trim()

// `childRecordsByResource` is built from the same `enrichRecord` mapping as
// `useRecord().items`, so it can carry `null` for a row whose Code has not landed
// yet. Normalizing to an object BEFORE any predicate is what stops a null from
// passing the Status guard and then being dereferenced by the next read — the
// failure mode `useRestockDelivery.js` documents on `asRow`.
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  // Safe outside setup: `useAuth` only reaches Pinia stores and statically
  // imported Quasar plugins — it calls no `inject()`. `user` stays a computed, so
  // reading it at submit time gives the live session user.
  const { user } = useAuth()

  const step = () => pageState.meta.currentStep
  const restock = () => resourceRecord?.record?.value || {}
  const comment = () => text(pageState.getControlField(PARENT, COMMENT))
  const actor = () => user.value?.name || user.value?.email || ''
  const selection = () => normalizeSelection(pageState.getControlField(PARENT, SELECTION))

  // Every active child row of this request. The parent's next Progress is a
  // question about the rows that were NOT selected — an allocated line left for a
  // later trip keeps it PARTIALLY_DELIVERED — so the whole set is passed to the
  // builder, not just the delivered slice.
  function childRows () {
    const rows = (resourceRecord?.childRecordsByResource?.value || {})[CHILD]
    if (!Array.isArray(rows)) return []
    return rows.map(asRow).filter((row) => text(row.Code) && isActive(row))
  }

  // The same pure filter the cards project through, so a row the UI never offered
  // can never be delivered — and a stale Code left in the selection by a row that
  // has since moved on is dropped rather than written.
  function selectedItems () {
    const chosen = new Set(selection())
    return deliverableRows(childRows(), restock().Code).filter((row) => chosen.has(text(row.Code)))
  }

  // Confirming a delivery writes the item rows AND an outlet stock movement, so
  // both permissions are required. Failing closed here is the rule; hiding the
  // entry point on the View page is only UX (UI_MODULE_DEVELOPER_GUIDE.md §11).
  function permitted () {
    return resourceConfig?.allowed({ OutletRestocks: 'update', OutletMovements: 'create' })
  }

  return {
    get actions () {
      if (step() === 2) return ['back', 'submit']
      return ['cancel', 'next']
    },

    // A getter for the same reason `actions` is one — it is re-read on every
    // recompute rather than latched at resolve time.
    get submitLabel () { return 'Confirm Delivery' },

    // Leaving abandons an unsaved selection, so return to the request itself
    // rather than `goBack()` — the driver may have arrived from the list.
    // Returning false stops the built-in goBack() popping a second history entry.
    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    // Step 1 → 2. Nothing to review until at least one line is confirmed as
    // arrived; a delivery of nothing is not a delivery.
    next: () => {
      if (!deliverableRows(childRows(), restock().Code).length) {
        return { valid: false, message: 'This request has no allocated items to deliver.' }
      }
      if (!selectedItems().length) {
        return { valid: false, message: 'Select at least one item to confirm as delivered.' }
      }
      return
    },

    /**
     * Confirm the delivery, as one batch.
     *
     * The mirror of approval's warehouse movement: those units already left the
     * warehouse when they were allocated, so nothing here touches warehouse
     * stock — the batch writes POSITIVE `OutletMovements` for their arrival and
     * moves the parent to DELIVERED or PARTIALLY_DELIVERED depending on what is
     * still outstanding.
     */
    submit: () => {
      const parent = restock()
      if (!text(parent.Code)) return { valid: false, message: 'This restock request could not be loaded.' }
      if (!permitted()) return { valid: false, message: 'You are not allowed to confirm delivery for this restock request.' }

      const delivered = selectedItems()
      if (!delivered.length) {
        return { valid: false, message: 'Select at least one item to confirm as delivered.' }
      }

      return {
        requests: buildRestockDeliveryBatchRequests(parent, delivered, actor(), comment(), {
          allItems: childRows()
        }),
        successMsg: 'Delivery confirmed and outlet stock updated.'
      }
    },

    successRoute: 'view'
  }
}
