/**
 * OutletRestocks › cancellation — Layer 2, the rules for withdrawing a restock request.
 *
 * "What happens to the stock when a restock is cancelled?" is a state-transition question
 * (UI_RESOURCE_DOMAIN_LOGIC.md §3), and it must have ONE answer whichever UI asks it: the
 * cancellation review screen and `CancelRestock/PageAction.js` both read the predicates
 * below, so the batch can never settle rows the review did not display.
 *
 * ── WHY CANCELLATION IS NOT REJECTION ──
 * `buildRestockRejectNodes` already reverses allocated stock, but it drives the
 * whole request to `REJECTED` and deactivates every line. That is an approver's verdict on
 * a request still awaiting approval. A CANCELLATION happens later and to a request that may
 * be part-fulfilled, so two things differ and both matter:
 *
 *   1. DELIVERED LINES ARE UNTOUCHABLE. Those units are physically at the outlet. They are
 *      left exactly as they are — not deactivated, not reversed — because deactivating them
 *      would erase the outlet-side arrival that put them on the shelf.
 *   2. THE PARENT SETTLES ON WHAT ACTUALLY HAPPENED. Nothing delivered → the request never
 *      happened, so `CANCELLED`. Something delivered → the request DID happen, just not in
 *      full, so it settles as `DELIVERED` rather than pretending it was never raised.
 *
 * ── THE STOCK RULE ──
 * Only `ALLOCATED` lines hold warehouse stock: approval wrote a NEGATIVE `StockMovements`
 * row when the units were committed out of the warehouse. Cancelling writes the POSITIVE
 * mirror, putting them back on the same warehouse and the same storage they were taken
 * from. `PENDING` lines never took stock out, so cancelling one moves nothing.
 *
 * Named PURE exports + a `useRestockCancellation()` wrapper (§5). Nothing here injects,
 * holds reactive state, renders, or touches a store.
 */

import {
  CANCELLED,
  DELIVERED,
  ITEM_ALLOCATED,
  ITEM_CANCELLED,
  ITEM_PENDING,
  TERMINAL_STATES,
  progressOf
} from './useRestockProgress'

import { stampFields } from 'src/utils/workflowStamp'

import { INTO_WAREHOUSE, STOCK_REFERENCE, stockMovementRow, buildStockMovementNodes } from 'src/_resource/Operation/StockMovements/composables/useStockMovementPayload'
const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
// `useRecord().items` can carry `null` for a row with no Code, so every row read is
// normalized before any predicate touches it (see `useRestockDelivery.js`).
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const asList = (value) => (Array.isArray(value) ? value : [])
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'
const itemProgressOf = (value) => text(asRow(value).Progress) || ITEM_PENDING

/** The control-field key the cancellation reason is stored under. */
export const CANCEL_REASON = 'CancelReason'

/** The item states a cancellation may still act on — nothing has been received yet. */
export const CANCELLABLE_ITEM_PROGRESS = [ITEM_PENDING, ITEM_ALLOCATED]

/**
 * Whether this request can be cancelled at all.
 *
 * Everything that has not come to rest can be. A `DELIVERED`, `REJECTED` or already
 * `CANCELLED` request cannot — there is nothing left to withdraw, and its stock has either
 * arrived or already gone back.
 */
export function isCancellable (record) {
  const progress = progressOf(record)
  return !!progress && !TERMINAL_STATES.includes(progress)
}

/** The stated reason a request cannot be cancelled, for a UI that must explain itself. */
export function cancellability (record) {
  const progress = progressOf(record)
  if (!progress) return { allowed: false, reason: 'This restock request could not be loaded.' }
  if (progress === DELIVERED) return { allowed: false, reason: 'It has already been fully delivered.' }
  if (progress === CANCELLED) return { allowed: false, reason: 'It has already been cancelled.' }
  if (TERMINAL_STATES.includes(progress)) return { allowed: false, reason: 'It has already been closed.' }
  return { allowed: true, reason: '' }
}

/** The active child rows of one request, in a shape every predicate below can read. */
export function activeItemsOf (rows = [], restockCode = '') {
  const parentCode = text(restockCode)
  return asList(rows)
    .map(asRow)
    .filter((entry) => text(entry.Code) && isActive(entry))
    .filter((entry) => !parentCode || text(entry.OutletRestockCode) === parentCode)
}

/** The lines this cancellation will settle — PENDING and ALLOCATED. */
export function cancellableItems (rows = [], restockCode = '') {
  return activeItemsOf(rows, restockCode)
    .filter((entry) => CANCELLABLE_ITEM_PROGRESS.includes(itemProgressOf(entry)))
}

/** The lines it will NOT touch, because their units are already at the outlet. */
export function deliveredItems (rows = [], restockCode = '') {
  return activeItemsOf(rows, restockCode)
    .filter((entry) => itemProgressOf(entry) === DELIVERED)
}

/** The lines whose stock actually goes back to the warehouse. */
export function returnableItems (rows = [], restockCode = '') {
  return cancellableItems(rows, restockCode)
    .filter((entry) => itemProgressOf(entry) === ITEM_ALLOCATED)
}

/**
 * The whole review, in one pass — what returns, what is untouched, and where the parent
 * lands. The review screen renders THIS and the builder writes from the same predicates,
 * so a user is never shown a return the batch does not perform.
 */
export function restockCancellationPreview (record = {}, rows = []) {
  const parent = asRow(record)
  const code = text(parent.Code)
  const returning = returnableItems(rows, code)
  const cancelling = cancellableItems(rows, code)
  const delivered = deliveredItems(rows, code)
  return {
    gate: cancellability(parent),
    returning,
    // PENDING lines are cancelled too, but nothing moves for them — stated separately so
    // the screen does not imply stock comes back for a line that never took any.
    releasing: cancelling.filter((entry) => itemProgressOf(entry) !== ITEM_ALLOCATED),
    delivered,
    returnedQty: returning.reduce((sum, entry) => sum + Math.abs(num(entry.Quantity)), 0),
    nextProgress: nextProgressAfterCancellation(rows, code)
  }
}

/**
 * Where the PARENT lands once every open line is cancelled.
 *
 * `DELIVERED` when anything already arrived at the outlet — the request happened, it simply
 * will not be completed — and `CANCELLED` when nothing did. Derived from the FULL active
 * child set rather than the cancelled slice, for the same reason `nextRestockProgress` is:
 * the answer is a question about the rows that are NOT being cancelled.
 */
export function nextProgressAfterCancellation (rows = [], restockCode = '') {
  return deliveredItems(rows, restockCode).length ? DELIVERED : CANCELLED
}


// Cancel: return committed stock, settle the open lines, stamp the parent. Lines are
// marked CANCELLED, not deactivated, so the request still shows what was committed.
export function buildRestockCancellationNodes (restock = {}, rows = [], actorName = '', comment = '') {
  const parent = asRow(restock)
  const parentCode = text(parent.Code)
  if (!parentCode) return [{ valid: false, message: 'This restock request could not be loaded.' }]

  const returning = returnableItems(rows, parentCode)
  const cancelling = cancellableItems(rows, parentCode)

  const nodes = []

  // 1. Put the committed units back on the warehouse shelf they came off.
  if (returning.length) {
    nodes.push(...buildStockMovementNodes(returning.map((entry) => stockMovementRow({
      warehouseCode: entry.WarehouseCode,
      storageName: entry.StorageName,
      sku: entry.SKU,
      qty: entry.Quantity,
      direction: INTO_WAREHOUSE,
      referenceType: STOCK_REFERENCE.RESTOCK,
      referenceCode: entry.Code || parentCode
    }))))
  }

  // 2. Settle every open line. Kept Active so the request still shows what was committed.
  if (cancelling.length) {
    nodes.push({
      resource: 'OutletRestockItems',
      many: true,
      records: cancelling.map((entry) => ({
        Code: text(entry.Code),
        Progress: ITEM_CANCELLED,
        ...stampFields('ProgressCancelled', actorName, comment),
        Status: 'Active'
      })),
      permissions: { update: 'You are not allowed to change restock items.' }
    })
  }

  // 3. The parent, settled on what actually happened.
  nodes.push({
    resource: 'OutletRestocks',
    code: parentCode,
    record: {
      Progress: nextProgressAfterCancellation(rows, parentCode),
      ...stampFields('ProgressCancelled', actorName, comment)
    },
    permissions: { cancel: 'You are not allowed to cancel this restock request.' },
    successMsg: returning.length ? 'Restock cancelled and warehouse stock returned.' : 'Restock cancelled.'
  })

  return nodes
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useRestockCancellation () {
  return {
    CANCEL_REASON,
    CANCELLABLE_ITEM_PROGRESS,
    isCancellable,
    cancellability,
    activeItemsOf,
    cancellableItems,
    deliveredItems,
    returnableItems,
    restockCancellationPreview,
    nextProgressAfterCancellation,
    buildRestockCancellationNodes
  }
}
