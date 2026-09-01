/**
 * OutletRestocks › delivery — Layer 2, the rules for what can be delivered.
 *
 * "Which of this request's lines is it legal to confirm as delivered?" is a
 * state-transition question (UI_RESOURCE_DOMAIN_LOGIC.md §3), and it must have one
 * answer whichever UI asks: `MarkDelivered`'s step-1 card, its step-2 review, and
 * `MarkDelivered/PageAction.js` at submit time all read the same predicate, so a submit
 * can never cover different rows than the review displayed.
 *
 * What stays in the UI half (`_ui/.../OutletRestocks/MarkDelivered/useRestockDelivery.js`)
 * is the `inject()`ed `pageState` the selection is stored on, the reactive projections
 * the two cards render, and the Product → SKU grouping, which is display shaping.
 *
 * Named PURE exports + a `useRestockDelivery()` wrapper (§5). Nothing here injects,
 * holds reactive state, renders, or touches a store.
 */

// The control key the delivery selection is stored under. The cards write it and
// `MarkDelivered/PageAction.js` reads it, so neither may guess it on its own.
export const SELECTION = 'DeliverySelection'

/**
 * Only ALLOCATED lines can be delivered. A PENDING line has no stock behind it,
 * and a DELIVERED/CANCELLED one is settled history.
 */
export const DELIVERABLE_PROGRESS = 'ALLOCATED'

const text = (value) => String(value ?? '').trim()

/**
 * Normalize anything out of a records array into a safe object.
 *
 * `useRecord().items` CAN CONTAIN `null` — it maps every store row through
 * `enrichRecord`, which returns `null` for a row with no `Code`, and the map is
 * 1:1 so that `null` lands in the array. Optional chaining alone does not survive
 * it: a guard written as `row?.Status || 'Active'` waves the null through the
 * active filter, and the NEXT predicate dereferences it. Every row read in this
 * file goes through `asRow` so a null degrades to an empty object and is then
 * dropped by the field checks (see `useRestockAllocation.js`).
 */
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

/** Codes normalized, blank-stripped and deduped — the shape everything else reads. */
export function normalizeSelection (value) {
  return Array.from(new Set((Array.isArray(value) ? value : []).map(text).filter(Boolean)))
}

/**
 * The ALLOCATED child rows of one request — the deliverable set.
 *
 * Pure so `MarkDelivered/PageAction.js` can derive the very same set at submit
 * time from the injected `resourceRecord`, rather than restating the filter and
 * risking a submit that covers different rows than step 2 displayed.
 */
export function deliverableRows (rows = [], restockCode = '') {
  const parentCode = text(restockCode)
  return (Array.isArray(rows) ? rows : [])
    .map(asRow)
    .filter((row) => text(row.Code) && isActive(row))
    .filter((row) => !parentCode || text(row.OutletRestockCode) === parentCode)
    .filter((row) => text(row.Progress) === DELIVERABLE_PROGRESS)
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useRestockDelivery () {
  return {
    SELECTION,
    DELIVERABLE_PROGRESS,
    normalizeSelection,
    deliverableRows
  }
}
