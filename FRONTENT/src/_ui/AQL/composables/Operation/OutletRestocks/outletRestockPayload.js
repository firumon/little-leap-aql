import { textOrRef } from 'src/utils/appHelpers'
import { executeActionRequest, resourceBulkRequest, resourceUpdateRequest } from 'src/composables/resources/usePageState'

/**
 * OutletRestocks › Approve — the batch payloads the approval flow writes.
 *
 * Self-contained by design: this module owns every request the approve/allocate/
 * cancel/reject outcomes send, and imports nothing resource-specific. Its only
 * dependencies are the generic request builders re-exported by `usePageState`
 * (PAGE_STATE.md §8) and the stateless `$ref` helper in `appHelpers` — both
 * infrastructure, neither tied to a resource.
 *
 * Pure functions throughout: no refs, no injects, no stores. They take plain rows
 * and return canonical request envelopes, so they are callable from a JS action
 * modifier that runs outside a setup context.
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

// Workflow stamps are written under the hood, never exposed as form fields, so
// they cannot be back-dated by the user.
function stampFields (prefix, actorName = '', comment = '') {
  return {
    [`${prefix}At`]: new Date().toISOString(),
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
    requests.push(resourceUpdateRequest('OutletRestocks', parent.Code, {
      Progress: 'APPROVED',
      ApprovedUser: text(actorName),
      ProgressApprovedComment: text(comment)
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
      ProgressRejectedComment: text(comment),
      ProgressRejectedAt: new Date().toISOString(),
      ProgressRejectedBy: text(actorName)
    }, ['OutletRestocks'])
  ]
}
