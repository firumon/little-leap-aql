import { textOrRef } from 'src/utils/appHelpers'
import { toDateTime24 } from 'src/utils/dateHelpers'
import { executeActionRequest, resourceBulkRequest, resourceGetRequest, resourceUpdateRequest } from 'src/composables/resources/resourceRequests'

/**
 * OutletRestocks — the batch payloads the restock workflow writes. Layer 2.
 *
 * Payload/request builders are domain logic (UI_RESOURCE_DOMAIN_LOGIC.md §3): the
 * sign conventions below ARE the business rule for what a restock does to stock. This
 * module owns every request the approve/allocate/cancel/reject/deliver outcomes send.
 *
 * Its only dependencies are the generic request builders in `resourceRequests.js` and
 * the stateless `$ref`/date helpers in `src/utils/` — all Layer 1 infrastructure, none
 * tied to a resource, none of them a store or a service. `resourceRequests` rather than
 * `usePageState` specifically so this file's module graph stays store-free (§2.1);
 * `usePageState` re-exports the same functions for Layer 1 and Layer 3 callers.
 *
 * Pure functions throughout: no refs, no injects, no stores, nothing rendered. They take
 * plain rows and return canonical request envelopes, so they are callable from a JS
 * action modifier that runs outside a setup context (§5).
 *
 * > NOTE: `src/composables/operation/outlets/outletRestockPayload.js` still holds
 * > the equivalents used by the LEGACY `useOutletRestocks` / `ViewPage.vue` path.
 * > These are deliberately a separate copy for the custom-UI approval flow; the
 * > stock-movement sign conventions and the `Progress` vocabulary are shared
 * > domain rules, so a change to one is a prompt to check the other.
 */

// ── Local primitives ─────────────────────────────────────────────────────────
// Re-stated here rather than imported so the module has no resource-specific
// dependency. `text` is null-safe by construction, which is what makes every
// row read below safe against the `null` entries `useRecord().items` can carry
// (see `useRestockApproval.js`).
const DEFAULT_STORAGE = '_default'
const REFERENCE_TYPE = 'OutletRestock'
// Outlet-side movements carry their own reference type. A warehouse movement and
// an outlet movement written for the same request describe two different legs of
// the same journey, and the ledgers must stay tellable apart when reconciling.
const DELIVERY_REFERENCE_TYPE = 'RestockDelivery'
const CANCEL_ITEM_ACTION = { action: 'Cancel', column: 'Progress', columnValue: 'CANCELLED' }

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
// Every row read goes through this, so a `null`/non-object entry degrades to an
// empty row rather than throwing on the first property access.
const row = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(row(value).Status || 'Active') === 'Active'
const storageName = (value) => text(value) || DEFAULT_STORAGE

function formatTimeOnly (date = new Date()) {
  const hours = date.getHours()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  return `${h}:${String(date.getMinutes()).padStart(2, '0')} ${ampm}`
}

/**
 * One workflow stamp — the At/By/Comment triple for a `Progress<State>` prefix.
 *
 * The SINGLE writer of a stamp in this module, so no outcome can record two of the
 * three columns and leave the third blank. A stamp with no `By` reads as a stage
 * that never happened (`useRestockProgress`'s `workflowStamps` drops it), which is
 * exactly what an approval missing its actor used to look like on the timeline.
 *
 * `toDateTime24` rather than an ISO string: GAS stamps `Progress<State>At` with
 * `formatDateTime24()` whenever an `executeAction` writes one, and these columns
 * are surfaced verbatim in sheet views and printed reports. Two formats in one
 * column would sort and read inconsistently depending on which path wrote the row.
 *
 * Written under the hood, never exposed as form fields, so they cannot be
 * back-dated by the user.
 */
function stampFields (prefix, actorName = '', comment = '') {
  return {
    [`${prefix}At`]: toDateTime24(new Date()),
    [`${prefix}By`]: text(actorName),
    [`${prefix}Comment`]: text(comment)
  }
}

/**
 * A warehouse stock movement for one allocated line.
 *
 * `sign` is the whole contract: -1 when units are committed OUT of the warehouse
 * to an outlet, +1 when a rejection puts them back. The magnitude is always
 * absolute, so a row carrying an accidentally negative quantity cannot flip the
 * direction of the movement.
 */
function stockMovement (source = {}, referenceCode = '', sign = -1) {
  const entry = row(source)
  return {
    WarehouseCode: text(entry.WarehouseCode),
    StorageName: storageName(entry.StorageName),
    SKU: text(entry.SKU),
    QtyChange: Math.abs(num(entry.Quantity)) * (sign < 0 ? -1 : 1),
    ReferenceType: REFERENCE_TYPE,
    ReferenceCode: textOrRef(referenceCode || entry.Code),
    Status: 'Active'
  }
}

// The source item Code a row descends from, whichever tag the caller used.
function sourceCodeOf (value = {}) {
  const entry = row(value)
  return text(entry._pendingSourceCode || entry.Code || entry._approvalSourceKey).replace(/^pending:/, '')
}

/**
 * INITIAL APPROVAL — allocate stock and move the request to APPROVED.
 *
 * Writes the item rows (ALLOCATED bins plus any PENDING remainder), one NEGATIVE
 * stock movement per allocated bin, and the parent's approval stamp.
 */
export function buildRestockAllocationBatchRequests (restock = {}, rows = [], actorName = '', comment = '', options = {}) {
  const parent = row(restock)
  const activeRows = (Array.isArray(rows) ? rows : []).map(row).filter(isActive)
  const allocationComment = text(comment) || `Allocated by ${text(actorName) || 'Unknown'} on ${formatTimeOnly()}`

  let itemRecords = activeRows.map((entry) => {
    const progress = text(entry.Progress) || 'PENDING'
    const code = text(entry.Code) || (progress === 'PENDING' ? sourceCodeOf(entry) : '')
    return {
      ...(code ? { Code: code } : {}),
      OutletRestockCode: text(parent.Code),
      SKU: text(entry.SKU),
      WarehouseCode: text(entry.WarehouseCode),
      StorageName: text(entry.StorageName),
      Quantity: num(entry.Quantity),
      Progress: progress,
      ...(progress === 'ALLOCATED' ? stampFields('ProgressAllocated', actorName, allocationComment) : {}),
      Status: 'Active'
    }
  })

  // Safety net, not the mechanism. `splitApprovalRows` already guarantees one
  // Code per batch, but a Code appearing on both an ALLOCATED and a
  // non-ALLOCATED record would otherwise double-write the same row (UPDATE +
  // UPDATE). Stripping it from the ALLOCATED side makes that a CREATE instead,
  // so the original row stays the carrier of the remainder.
  const codeCount = {}
  itemRecords.forEach((record) => { if (record.Code) codeCount[record.Code] = (codeCount[record.Code] || 0) + 1 })
  if (Object.values(codeCount).some((count) => count > 1)) {
    itemRecords = itemRecords.map((record) => {
      if (record.Code && codeCount[record.Code] > 1 && record.Progress === 'ALLOCATED') {
        const { Code, ...rest } = record
        return rest
      }
      return record
    })
  }

  const allocated = itemRecords.filter((record) => record.Progress === 'ALLOCATED')
  const movementRefs = Array.isArray(options.movementReferences) ? options.movementReferences : []
  const movements = allocated.map((record, index) =>
    stockMovement(record, movementRefs[index] || record.Code || parent.Code, -1))

  const requests = [
    resourceBulkRequest('OutletRestockItems', itemRecords, ['OutletRestockItems']),
    resourceBulkRequest('StockMovements', movements, ['WarehouseStorages'])
  ]
  if (options.updateRestock !== false) {
    // The full stamp, not just the comment. Approval is reached through this
    // builder rather than through a generic `executeAction`, so GAS never gets to
    // auto-fill `Progress<State>At/By` (resourceApi.gs › handleExecuteAction) —
    // writing only the comment left the approval with no actor and no time, and
    // the View timeline drops a stamp with no actor.
    requests.push(resourceUpdateRequest('OutletRestocks', parent.Code, {
      Progress: 'APPROVED',
      ApprovedUser: text(actorName),
      ...stampFields('ProgressApproved', actorName, comment)
    }, ['OutletRestocks']))
  }
  return requests
}

/**
 * LATER ALLOCATION — fill leftover PENDING lines on an already-approved request.
 *
 * Grouped by the SOURCE item Code, because what happens to that original row
 * depends on how much of it is being covered now:
 *   fully, from ONE bin      → the source row itself becomes the allocated row
 *   fully, across SEVERAL    → the source row is deactivated, every bin is new
 *   partially                → the source row shrinks to the remainder
 * The parent is deliberately NOT touched: allocating leftovers does not change
 * a request that is already APPROVED.
 */
export function buildPendingRestockAllocationBatchRequests (restock = {}, rows = [], actorName = '', comment = '') {
  const parent = row(restock)
  const activeRows = (Array.isArray(rows) ? rows : []).map(row).filter(isActive)
  const allocationComment = text(comment) || `Allocated by ${text(actorName) || 'Unknown'} on ${formatTimeOnly()}`

  const sourceCodes = Array.from(new Set(activeRows.map(sourceCodeOf).filter(Boolean)))
  const itemRecords = []
  const movements = []

  sourceCodes.forEach((sourceCode) => {
    const source = activeRows.find((entry) => text(entry.Code) === sourceCode) ||
      activeRows.find((entry) => sourceCodeOf(entry) === sourceCode)
    if (!source) return

    const requestedQty = num(source._approvalRequestedQty || source.Quantity)
    const allocatedRows = activeRows.filter((entry) =>
      sourceCodeOf(entry) === sourceCode && text(entry.Progress) === 'ALLOCATED')
    const allocatedQty = allocatedRows.reduce((total, entry) => total + num(entry.Quantity), 0)
    const remainingQty = Math.max(requestedQty - allocatedQty, 0)

    // Fully covered from a single bin: reuse the source row in place rather than
    // deactivating it and creating a near-identical replacement.
    if (remainingQty === 0 && allocatedRows.length === 1) {
      const entry = allocatedRows[0]
      const record = {
        Code: sourceCode,
        OutletRestockCode: text(parent.Code),
        SKU: text(entry.SKU),
        WarehouseCode: text(entry.WarehouseCode),
        StorageName: text(entry.StorageName),
        Quantity: num(entry.Quantity),
        Progress: 'ALLOCATED',
        ...stampFields('ProgressAllocated', actorName, allocationComment),
        Status: 'Active'
      }
      itemRecords.push(record)
      movements.push(stockMovement(record, sourceCode, -1))
      return
    }

    if (remainingQty > 0) {
      itemRecords.push({
        Code: sourceCode,
        OutletRestockCode: text(parent.Code),
        SKU: text(source.SKU),
        WarehouseCode: '',
        StorageName: '',
        Quantity: remainingQty,
        Progress: 'PENDING',
        Status: 'Active'
      })
    } else {
      // Fully covered, but split across bins — the source row has no quantity
      // left to represent, so it is retired instead of left as a zero line.
      itemRecords.push({ Code: sourceCode, Status: 'Inactive' })
    }

    allocatedRows.forEach((entry) => {
      const record = {
        OutletRestockCode: text(parent.Code),
        SKU: text(entry.SKU),
        WarehouseCode: text(entry.WarehouseCode),
        StorageName: text(entry.StorageName),
        Quantity: num(entry.Quantity),
        Progress: 'ALLOCATED',
        ...stampFields('ProgressAllocated', actorName, allocationComment),
        Status: 'Active'
      }
      itemRecords.push(record)
      movements.push(stockMovement(record, sourceCode || parent.Code, -1))
    })
  })

  return [
    resourceBulkRequest('OutletRestockItems', itemRecords, ['OutletRestockItems']),
    resourceBulkRequest('StockMovements', movements, ['WarehouseStorages'])
  ]
}

/**
 * CANCEL an unfulfillable PENDING line.
 *
 * No stock movement, deliberately: the units were never taken out of the
 * warehouse, so there is nothing to reverse. Only the row's own status changes.
 */
export function buildRestockCancelItemsBatchRequests (restock = {}, rows = [], actorName = '', comment = '') {
  return (Array.isArray(rows) ? rows : [])
    .map(row)
    .filter((entry) => text(entry.Code) && text(entry.Progress) === 'PENDING')
    .map((entry) => executeActionRequest('OutletRestockItems', entry.Code, CANCEL_ITEM_ACTION, {
      ...stampFields('ProgressCancelled', actorName, comment)
    }, ['OutletRestockItems']))
}

/**
 * REJECT the whole request.
 *
 * Deactivates every line and reverses anything already allocated with POSITIVE
 * movements, so a partially-allocated request that is later rejected puts its
 * units back on the shelf instead of stranding them. Movements are emitted
 * FIRST, while the rows they describe are still readable.
 */
export function buildRestockRejectBatchRequests (restock = {}, rows = [], actorName = '', comment = '') {
  const parent = row(restock)
  const activeRows = (Array.isArray(rows) ? rows : []).map(row).filter(isActive)

  const movements = activeRows
    .filter((entry) => text(entry.Progress) === 'ALLOCATED')
    .map((entry) => stockMovement(entry, entry.Code || parent.Code, 1))

  const itemRecords = activeRows
    .filter((entry) => text(entry.Code))
    .map((entry) => ({ Code: text(entry.Code), Status: 'Inactive' }))

  return [
    resourceBulkRequest('StockMovements', movements, ['WarehouseStorages']),
    resourceBulkRequest('OutletRestockItems', itemRecords, ['OutletRestockItems']),
    resourceUpdateRequest('OutletRestocks', parent.Code, {
      Progress: 'REJECTED',
      ...stampFields('ProgressRejected', actorName, comment)
    }, ['OutletRestocks'])
  ]
}

/**
 * The parent's Progress once `deliveredCodes` have been marked DELIVERED.
 *
 * Derived from the FULL set of active child rows rather than from the delivered
 * ones alone: "is anything still outstanding?" is a question about the rows that
 * were *not* selected, so a builder handed only the selection cannot answer it.
 * A row that is neither delivered-now nor already delivered — an ALLOCATED line
 * left for a later trip, or a PENDING remainder never allocated — keeps the
 * request PARTIALLY_DELIVERED. CANCELLED and REJECTED lines are settled history
 * and hold nothing open.
 *
 * Exported because both the builder and the review step state this outcome, and
 * they must not disagree about it.
 */
export function nextRestockProgress (allItems = [], deliveredCodes = []) {
  const delivered = new Set((Array.isArray(deliveredCodes) ? deliveredCodes : []).map(text).filter(Boolean))
  const outstanding = (Array.isArray(allItems) ? allItems : [])
    .map(row)
    .filter(isActive)
    .filter((entry) => text(entry.Code) && !delivered.has(text(entry.Code)))
    .some((entry) => ['ALLOCATED', 'PENDING'].includes(text(entry.Progress) || 'PENDING'))
  return outstanding ? 'PARTIALLY_DELIVERED' : 'DELIVERED'
}

/**
 * MARK AS DELIVERED — the units land at the outlet.
 *
 * The mirror of the approval's warehouse movement: approval wrote a NEGATIVE
 * `StockMovements` row when the units were committed out of the warehouse, and
 * this writes a POSITIVE `OutletMovements` row when they arrive. The two ledgers
 * are separate resources, so nothing here touches warehouse stock — those units
 * left it at approval time and must not be deducted twice.
 *
 * `options.allItems` carries the request's full active child set so the parent's
 * next Progress can be computed (see `nextRestockProgress`). It defaults to the
 * delivered rows, which yields `'DELIVERED'` — correct when the caller is
 * delivering everything, and the reason the documented four-argument signature
 * still works on its own.
 */
export function buildRestockDeliveryBatchRequests (restock = {}, deliveredOrsiRows = [], actorName = '', comment = '', options = {}) {
  const parent = row(restock)
  const deliveredRows = (Array.isArray(deliveredOrsiRows) ? deliveredOrsiRows : [])
    .map(row)
    .filter(isActive)
    .filter((entry) => text(entry.Code))

  // Date-only: an outlet ledger is reconciled against a day's deliveries, not a
  // wall-clock instant. The stamp fields below keep the precise time.
  const movementDate = new Date().toISOString().slice(0, 10)

  const itemRecords = deliveredRows.map((entry) => ({
    Code: text(entry.Code),
    Progress: 'DELIVERED',
    ...stampFields('ProgressDelivered', actorName, comment),
    Status: 'Active'
  }))

  const movements = deliveredRows.map((entry) => ({
    OutletCode: text(parent.OutletCode),
    SKU: text(entry.SKU),
    // Always positive, for the same reason `stockMovement` takes the absolute
    // value: a row carrying a negative quantity must not silently reverse the
    // direction of an arrival.
    QtyChange: Math.abs(num(entry.Quantity)),
    ReferenceType: DELIVERY_REFERENCE_TYPE,
    ReferenceCode: textOrRef(parent.Code),
    ReferenceItemCode: text(entry.Code),
    MovementDate: movementDate,
    Status: 'Active'
  }))

  const allItems = Array.isArray(options.allItems) && options.allItems.length ? options.allItems : deliveredRows
  const nextProgress = nextRestockProgress(allItems, deliveredRows.map((entry) => entry.Code))

  return [
    resourceBulkRequest('OutletRestockItems', itemRecords, ['OutletRestockItems']),
    resourceBulkRequest('OutletMovements', movements, ['OutletStorages']),
    resourceUpdateRequest('OutletRestocks', parent.Code, {
      Progress: nextProgress,
      ...stampFields('ProgressDelivered', actorName, comment)
    }, ['OutletRestocks']),
    // The arrival just changed the outlet's balance; pull the recalculated
    // ledger and storages back in the same round trip rather than on the next
    // page load.
    resourceGetRequest(['OutletMovements', 'OutletStorages'])
  ]
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useRestockPayload () {
  return {
    buildRestockAllocationBatchRequests,
    buildPendingRestockAllocationBatchRequests,
    buildRestockCancelItemsBatchRequests,
    buildRestockRejectBatchRequests,
    buildRestockDeliveryBatchRequests,
    nextRestockProgress
  }
}
