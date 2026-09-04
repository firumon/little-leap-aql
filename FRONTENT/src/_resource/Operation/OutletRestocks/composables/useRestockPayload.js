import { stampFields } from 'src/utils/workflowStamp'
import {
  OUT_OF_WAREHOUSE,
  INTO_WAREHOUSE,
  STOCK_REFERENCE,
  stockMovementRow,
  buildStockMovementNodes
} from 'src/_resource/Operation/StockMovements/composables/useStockMovementPayload'
import { ONTO_THE_SHELF, OUTLET_REFERENCE, outletMovementRow, buildOutletMovementNodes } from 'src/_resource/Operation/OutletMovements/composables/useOutletMovementPayload'
import { deriveParentRestockProgress } from './useRestockCreation'
// Every export returns Node Objects, never requests. See UI_PAGE_STATE.md §5.

const RESOURCE_NAME = 'OutletRestocks'
const RESTOCK_ITEMS = 'OutletRestockItems'

const CANCEL_ITEM_ACTION = { action: 'Cancel', column: 'Progress', columnValue: 'CANCELLED' }

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
// Rows can arrive null, so every read goes through this.
const row = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(row(value).Status || 'Active') === 'Active'

function formatTimeOnly (date = new Date()) {
  const hours = date.getHours()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  return `${h}:${String(date.getMinutes()).padStart(2, '0')} ${ampm}`
}

// The only writer of a stamp, so no outcome leaves one of the three columns blank.

// The warehouse ledger's own row builder decides the sign and the reference vocabulary.
function stockMovement (source = {}, referenceCode = '', direction = OUT_OF_WAREHOUSE) {
  const entry = row(source)
  return stockMovementRow({
    warehouseCode: entry.WarehouseCode,
    storageName: entry.StorageName,
    sku: entry.SKU,
    qty: entry.Quantity,
    direction,
    referenceType: STOCK_REFERENCE.RESTOCK,
    referenceCode: referenceCode || entry.Code
  })
}

// The source item Code a row descends from, whichever tag the caller used.
function sourceCodeOf (value = {}) {
  const entry = row(value)
  return text(entry._sourceCode || entry._pendingSourceCode || entry.Code || entry._approvalSourceKey).replace(/^pending:/, '')
}

// Frontend-only tags carried onto every emitted row. `build()` strips `_` keys, so they
// never reach GAS — they are what lets the live node be read back as a per-line plan.
function sourceTags (value = {}) {
  const entry = row(value)
  const code = sourceCodeOf(entry)
  return {
    ...(code ? { _sourceCode: code } : {}),
    ...(entry._requestedQty !== undefined ? { _requestedQty: num(entry._requestedQty) } : {}),
    ...(entry._cancelled === true ? { _cancelled: true } : {})
  }
}

const ITEM_WRITE = { create: 'You are not allowed to change restock items.' }

// Bulk write of restock lines. `many: true` because a batch of lines is one sheet write.
const itemsNode = (records) => ({
  resource: RESTOCK_ITEMS,
  many: true,
  records,
  permissions: ITEM_WRITE
})

// The parent header, updated in place. A role keeps a cascade over several requests apart:
// two roleless updates would collapse onto one address.
const parentNode = (code, record, permissions, role = '') => ({
  resource: RESOURCE_NAME,
  ...(role ? { role } : {}),
  code,
  record,
  permissions
})

// Initial approval: allocate stock, deduct the warehouse, move the parent to APPROVED.
export function buildRestockAllocationNodes (restock = {}, rows = [], actorName = '', comment = '', options = {}) {
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
      Status: 'Active',
      ...sourceTags(entry)
    }
  })

  // A Code on both an ALLOCATED and a non-ALLOCATED record would write the row twice.
  // Dropping it from the ALLOCATED side makes that one a create instead.
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
    stockMovement(record, movementRefs[index] || record.Code || parent.Code, OUT_OF_WAREHOUSE))

  const updatesParent = options.updateRestock !== false
  const nodes = [
    { ...itemsNode(itemRecords), successMsg: 'Restock request approved and stock allocated.' },
    ...buildStockMovementNodes(movements)
  ]
  if (updatesParent) {
    // GAS only auto-fills the stamp for an executeAction, and this is not one.
    nodes.push(parentNode(parent.Code, {
      Progress: 'APPROVED',
      ApprovedUser: text(actorName),
      ...stampFields('ProgressApproved', actorName, comment)
    }, { approve: 'You are not allowed to approve this restock request.' }))
  }

  return nodes
}

// Later allocation: fill leftover PENDING lines. Grouped by source Code, because what
// happens to that row depends on how much of it is covered now. The parent is untouched.
export function buildPendingRestockAllocationNodes (restock = {}, rows = [], actorName = '', comment = '') {
  const parent = row(restock)
  const activeRows = (Array.isArray(rows) ? rows : []).map(row).filter(isActive)
  const allocationComment = text(comment) || `Allocated by ${text(actorName) || 'Unknown'} on ${formatTimeOnly()}`

  // One pass. The loop below asks three questions per code, so scanning would be O(n*m).
  const sourceCodes = []
  const byExactCode = new Map()
  const bySourceCode = new Map()
  activeRows.forEach((entry) => {
    const exact = text(entry.Code)
    if (exact && !byExactCode.has(exact)) byExactCode.set(exact, entry)
    const sourceCode = sourceCodeOf(entry)
    if (!sourceCode) return
    if (!bySourceCode.has(sourceCode)) {
      bySourceCode.set(sourceCode, [])
      sourceCodes.push(sourceCode)
    }
    bySourceCode.get(sourceCode).push(entry)
  })

  const itemRecords = []
  const movements = []

  sourceCodes.forEach((sourceCode) => {
    const descendants = bySourceCode.get(sourceCode) || []
    const source = byExactCode.get(sourceCode) || descendants[0]
    if (!source) return

    const requestedQty = num(source._approvalRequestedQty || source.Quantity)
    const allocatedRows = descendants.filter((entry) => text(entry.Progress) === 'ALLOCATED')
    const allocatedQty = allocatedRows.reduce((total, entry) => total + num(entry.Quantity), 0)
    const remainingQty = Math.max(requestedQty - allocatedQty, 0)

    // Covered from one bin: reuse the source row instead of replacing it.
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
        Status: 'Active',
        ...sourceTags(entry)
      }
      itemRecords.push(record)
      movements.push(stockMovement(record, sourceCode, OUT_OF_WAREHOUSE))
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
        Status: 'Active',
        ...sourceTags(source)
      })
    } else {
      // Split across bins, so the source row has nothing left to hold.
      itemRecords.push({ Code: sourceCode, Status: 'Inactive', ...sourceTags(source) })
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
        Status: 'Active',
        ...sourceTags(entry)
      }
      itemRecords.push(record)
      movements.push(stockMovement(record, sourceCode || parent.Code, OUT_OF_WAREHOUSE))
    })
  })

  return [
    { ...itemsNode(itemRecords), successMsg: 'Pending items allocated.' },
    ...buildStockMovementNodes(movements)
  ]
}

// Cancel a PENDING line. No stock moves — the units never left the warehouse. Each row
// gets its own action key, or pageState would dedupe the batch down to one stamp.
export function buildRestockCancelItemNodes (restock = {}, rows = [], actorName = '', comment = '') {
  return (Array.isArray(rows) ? rows : [])
    .map(row)
    .filter((entry) => text(entry.Code) && text(entry.Progress) === 'PENDING')
    .map((entry) => ({
      resource: RESTOCK_ITEMS,
      // `update`, not `cancel`: the sheet grants CRUD on the child rows and has no
      // per-outcome flag for them. Cancelling a line stamps a row that already exists.
      permissions: { update: 'You are not allowed to change restock items.' },
      actions: [{
        ...CANCEL_ITEM_ACTION,
        code: text(entry.Code),
        data: { fields: stampFields('ProgressCancelled', actorName, comment) }
      }]
    }))
}

// Reject: deactivate every line and put any allocated units back on the shelf.
export function buildRestockRejectNodes (restock = {}, rows = [], actorName = '', comment = '', options = {}) {
  const parent = row(restock)
  const activeRows = (Array.isArray(rows) ? rows : []).map(row).filter(isActive)

  const movements = activeRows
    .filter((entry) => text(entry.Progress) === 'ALLOCATED')
    .map((entry) => stockMovement(entry, entry.Code || parent.Code, INTO_WAREHOUSE))

  const itemRecords = activeRows
    .filter((entry) => text(entry.Code))
    .map((entry) => ({ Code: text(entry.Code), Status: 'Inactive' }))

  return [
    ...buildStockMovementNodes(movements),
    itemsNode(itemRecords),
    {
      ...parentNode(parent.Code, {
        Progress: 'REJECTED',
        ...stampFields('ProgressRejected', actorName, comment)
      }, { reject: 'You are not allowed to reject this restock request.' },
      text(options.role) || text(parent.Code)),
      successMsg: 'Restock request rejected.'
    }
  ]
}

// Needs the FULL child set: "is anything left open?" is about the rows NOT delivered.
// Exported so the review step and the builder cannot disagree about the outcome.
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
 * Recompute requests' own progress from their CURRENT lines, and write nothing else.
 *
 * The refresh a caller needs after it changed WHICH lines are in flight without delivering
 * any of them — a delivery run edited, or abandoned. It lives HERE because a request's
 * progress is the restock domain's arithmetic: a caller assembling this node itself would
 * be a second place deciding what a request's state is (§9.1). Callers merge the result.
 *
 * `deriveParentRestockProgress` is asked with a BLANK parent so it DERIVES rather than
 * echoing the stored value, over each request's full active child set. That is also why
 * this is not `nextRestockProgress`: that one answers "what does this delivery leave
 * behind?" and reads PARTIALLY_DELIVERED for a request with nothing delivered at all.
 *
 * ── THE FLOOR IS `APPROVED`, ALWAYS ──
 * A request only reaches this builder because at least one of its lines was ALLOCATED onto
 * a run, which cannot happen before approval. So approval is a FACT here, not something to
 * re-derive. The raw derivation does not know that: it reads a request whose stock was only
 * partly covered — some lines ALLOCATED, the rest still PENDING — as PENDING_APPROVAL, and
 * writing that would un-approve a request and re-offer "Approve & Allocate Stock" for work
 * already approved. Re-planning a van must never reopen an approval.
 */
function refreshedProgress (children) {
  const derived = deriveParentRestockProgress({}, children)
  return derived === 'PENDING_APPROVAL' ? 'APPROVED' : derived
}

export function buildRestockProgressRefreshNodes ({ restockCodes = [], allItemRows = [] } = {}) {
  const byRestock = new Map()
  for (const raw of (Array.isArray(allItemRows) ? allItemRows : [])) {
    const entry = row(raw)
    const parentCode = text(entry.OutletRestockCode)
    if (!parentCode) continue
    if (!byRestock.has(parentCode)) byRestock.set(parentCode, [])
    byRestock.get(parentCode).push(entry)
  }

  // A role per request code: nodes are addressed by resource plus role, so roleless
  // updates for several requests would collapse onto one address.
  return [...new Set((Array.isArray(restockCodes) ? restockCodes : []).map(text).filter(Boolean))]
    .map((code) => parentNode(
      code,
      { Progress: refreshedProgress(byRestock.get(code) || []) },
      { update: 'You are not allowed to update this outlet restock.' },
      code))
}

// Delivery is the other leg. Approval already took these units off the warehouse, so
// this only credits the outlet. referenceCode is the delivery run when one carried it.
export function buildRestockDeliveryNodes (restock = {}, deliveredOrsiRows = [], actorName = '', comment = '', options = {}) {
  const parent = row(restock)
  const deliveredRows = (Array.isArray(deliveredOrsiRows) ? deliveredOrsiRows : [])
    .map(row)
    .filter(isActive)
    .filter((entry) => text(entry.Code))

  const itemRecords = deliveredRows.map((entry) => ({
    Code: text(entry.Code),
    Progress: 'DELIVERED',
    ...stampFields('ProgressDelivered', actorName, comment),
    Status: 'Active'
  }))

  const movements = deliveredRows.map((entry) => outletMovementRow({
    outletCode: parent.OutletCode,
    storageName: entry.StorageName,
    sku: entry.SKU,
    qty: entry.Quantity,
    direction: ONTO_THE_SHELF,
    referenceType: OUTLET_REFERENCE.RESTOCK_DELIVERY,
    referenceCode: options.referenceCode || parent.Code,
    referenceItemCode: entry.Code
  }))

  const allItems = Array.isArray(options.allItems) && options.allItems.length ? options.allItems : deliveredRows
  const nextProgress = nextRestockProgress(allItems, deliveredRows.map((entry) => entry.Code))

  return [
    itemsNode(itemRecords),
    ...buildOutletMovementNodes(movements),
    {
      // `role` defaults to the request's own code so a delivery RUN can settle several
      // requests in one batch (§12.1). A page confirming ONE request passes `role: ''`
      // and gets the roleless address, so it does not end up holding two nodes for the
      // same record — one carrying the write and one empty.
      ...parentNode(parent.Code, {
        Progress: nextProgress,
        ...stampFields('ProgressDelivered', actorName, comment)
      }, { markDelivered: 'You are not allowed to confirm this delivery.' },
      options.role !== undefined ? text(options.role) : text(parent.Code)),
      successMsg: 'Delivery confirmed and outlet stock updated.'
    }
  ]
}

// Creation lives next door, split for file size. Re-exported so callers keep one import.
export {
  RESTOCK_REF_PATH,
  RESTOCK_CONTROL,
  buildRestockChainNodes,
  buildRestockMovementNodes,
  defaultSubmissionComment,
  deriveParentRestockProgress,
  restockDirectOptions,
  restockNode,
  restockNodeForConsumption,
  restockItemRow,
  restockFlags,
  restockItemProgress,
  restockProgressDerive,
  restockRoutingOf,
  restockSubmissionNodes,
  syncRestockInPageState,
  syncRestockLedgersInPageState,
  syncRestockProgressInPageState
} from './useRestockCreation'

export function useRestockPayload () {
  return {
    buildRestockAllocationNodes,
    buildPendingRestockAllocationNodes,
    buildRestockCancelItemNodes,
    buildRestockRejectNodes,
    buildRestockDeliveryNodes,
    buildRestockProgressRefreshNodes,
    nextRestockProgress
  }
}
