/**
 * OutletRestocks › cancellation — Layer 2, the rules for withdrawing a restock request.
 *
 * "What happens to the stock when a restock is cancelled?" is a state-transition question
 * (UI_RESOURCE_DOMAIN_LOGIC.md §3), and it must have ONE answer whichever UI asks it: the
 * cancellation review screen and `CancelRestock/PageAction.js` both read the predicates
 * below, so the batch can never settle rows the review did not display.
 *
 * ── WHY CANCELLATION IS NOT REJECTION ──
 * `buildRestockRejectBatchRequests` already reverses allocated stock, but it drives the
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

import { textOrRef } from 'src/utils/appHelpers'
import { toDateTime24 } from 'src/utils/dateHelpers'
import { resourceBulkRequest, resourceGetRequest, resourceUpdateRequest } from 'src/composables/resources/resourceRequests'
import {
  CANCELLED,
  DELIVERED,
  ITEM_ALLOCATED,
  ITEM_CANCELLED,
  ITEM_PENDING,
  TERMINAL_STATES,
  progressOf
} from './useRestockProgress'

const DEFAULT_STORAGE = '_default'
const REFERENCE_TYPE = 'OutletRestock'

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

/** One workflow stamp — the At/By/Comment triple for a `Progress<State>` prefix. */
function stampFields (prefix, actorName = '', comment = '') {
  return {
    [`${prefix}At`]: toDateTime24(new Date()),
    [`${prefix}By`]: text(actorName),
    [`${prefix}Comment`]: text(comment)
  }
}

/**
 * CANCEL the request — return committed stock, settle the open lines, stamp the parent.
 *
 * Order matters: the POSITIVE warehouse movements are emitted FIRST, while the rows they
 * describe are still readable, exactly as the reject builder does it.
 *
 * The item rows are marked `CANCELLED` rather than deactivated. A deactivated row vanishes
 * from every view, taking with it the record of how much was committed and returned; a
 * cancelled one stays on the request and states what happened to it.
 */
export function buildRestockCancellationBatchRequests (restock = {}, rows = [], actorName = '', comment = '') {
  const parent = asRow(restock)
  const parentCode = text(parent.Code)
  if (!parentCode) return []

  const returning = returnableItems(rows, parentCode)
  const cancelling = cancellableItems(rows, parentCode)

  const requests = []

  // 1. Put the committed units back on the warehouse shelf they came off.
  if (returning.length) {
    requests.push(resourceBulkRequest('StockMovements', returning.map((entry) => ({
      WarehouseCode: text(entry.WarehouseCode),
      StorageName: text(entry.StorageName) || DEFAULT_STORAGE,
      SKU: text(entry.SKU),
      // Always positive, for the same reason the allocation movement is always negative:
      // a row carrying a negative quantity must not flip the direction of the return.
      QtyChange: Math.abs(num(entry.Quantity)),
      ReferenceType: REFERENCE_TYPE,
      ReferenceCode: textOrRef(entry.Code || parentCode),
      Status: 'Active'
    })), ['WarehouseStorages']))
  }

  // 2. Settle every open line. Kept Active so the request still shows what was committed.
  if (cancelling.length) {
    requests.push(resourceBulkRequest('OutletRestockItems', cancelling.map((entry) => ({
      Code: text(entry.Code),
      Progress: ITEM_CANCELLED,
      ...stampFields('ProgressCancelled', actorName, comment),
      Status: 'Active'
    })), ['OutletRestockItems']))
  }

  // 3. The parent, settled on what actually happened.
  requests.push(resourceUpdateRequest('OutletRestocks', parentCode, {
    Progress: nextProgressAfterCancellation(rows, parentCode),
    ...stampFields('ProgressCancelled', actorName, comment)
  }, ['OutletRestocks']))

  // 4. The return just changed warehouse balances; pull them back in the same round trip
  //    rather than leaving the next page to read a stale shelf.
  requests.push(resourceGetRequest(['OutletRestocks', 'OutletRestockItems', 'WarehouseStorages']))
  return requests
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
    buildRestockCancellationBatchRequests
  }
}
