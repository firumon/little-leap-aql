import { actionNode, bulkNode, updateNode } from 'src/composables/resources/nodePayloads'

import { stampFields } from 'src/utils/workflowStamp'
import {
  OUT_OF_WAREHOUSE,
  INTO_WAREHOUSE,
  STOCK_REFERENCE,
  stockMovementRow,
  buildStockMovementNodes
} from 'src/_resource/Operation/StockMovements/composables/useStockMovementPayload'
import { ONTO_THE_SHELF, OUTLET_REFERENCE, outletMovementRow, buildOutletMovementNodes } from 'src/_resource/Operation/OutletMovements/composables/useOutletMovementPayload'
// Every export returns { valid, nodes, permissions, successMsg } — pageState node
// payloads, never requests. outlets/outletRestockPayload.js is a legacy copy of the signs.

const RESOURCE_NAME = 'OutletRestocks'
const RESTOCK_ITEMS = 'OutletRestockItems'
const STOCK_MOVEMENTS = 'StockMovements'
const OUTLET_MOVEMENTS = 'OutletMovements'

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
  return text(entry._pendingSourceCode || entry.Code || entry._approvalSourceKey).replace(/^pending:/, '')
}

function allocationPermissions (updatesParent) {
  return {
    [RESTOCK_ITEMS]: 'create',
    [STOCK_MOVEMENTS]: 'create',
    ...(updatesParent ? { [RESOURCE_NAME]: 'approve' } : {})
  }
}

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
      Status: 'Active'
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
    bulkNode(RESTOCK_ITEMS, itemRecords, [RESTOCK_ITEMS]),
    ...buildStockMovementNodes(movements).nodes
  ]
  if (updatesParent) {
    // GAS only auto-fills the stamp for an executeAction, and this is not one.
    nodes.push(updateNode(RESOURCE_NAME, parent.Code, {
      Progress: 'APPROVED',
      ApprovedUser: text(actorName),
      ...stampFields('ProgressApproved', actorName, comment)
    }, [RESOURCE_NAME]))
  }

  return {
    valid: true,
    nodes,
    permissions: allocationPermissions(updatesParent),
    successMsg: 'Restock request approved and stock allocated.'
  }
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
        Status: 'Active'
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
        Status: 'Active'
      })
    } else {
      // Split across bins, so the source row has nothing left to hold.
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
      movements.push(stockMovement(record, sourceCode || parent.Code, OUT_OF_WAREHOUSE))
    })
  })

  return {
    valid: true,
    nodes: [
      bulkNode(RESTOCK_ITEMS, itemRecords, [RESTOCK_ITEMS]),
      ...buildStockMovementNodes(movements).nodes
    ],
    permissions: allocationPermissions(false),
    successMsg: 'Pending items allocated.'
  }
}

// Cancel a PENDING line. No stock moves — the units never left the warehouse. Each row
// gets its own action key, or pageState would dedupe the batch down to one stamp.
export function buildRestockCancelItemNodes (restock = {}, rows = [], actorName = '', comment = '') {
  const nodes = (Array.isArray(rows) ? rows : [])
    .map(row)
    .filter((entry) => text(entry.Code) && text(entry.Progress) === 'PENDING')
    .map((entry) => actionNode(RESTOCK_ITEMS, text(entry.Code), CANCEL_ITEM_ACTION, {
      ...stampFields('ProgressCancelled', actorName, comment)
    }, { reload: [RESTOCK_ITEMS] }))

  return { valid: true, nodes, permissions: nodes.length ? { [RESTOCK_ITEMS]: 'cancel' } : {} }
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

  return {
    valid: true,
    nodes: [
      ...buildStockMovementNodes(movements).nodes,
      bulkNode(RESTOCK_ITEMS, itemRecords, [RESTOCK_ITEMS]),
      // A role, so a cascade rejecting several requests keeps them as separate nodes.
      updateNode(RESOURCE_NAME, parent.Code, {
        Progress: 'REJECTED',
        ...stampFields('ProgressRejected', actorName, comment)
      }, [RESOURCE_NAME], text(options.role) || text(parent.Code))
    ],
    permissions: { [RESOURCE_NAME]: 'reject', [RESTOCK_ITEMS]: 'create', [STOCK_MOVEMENTS]: 'create' },
    successMsg: 'Restock request rejected.'
  }
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

  return {
    valid: true,
    nodes: [
      bulkNode(RESTOCK_ITEMS, itemRecords, [RESTOCK_ITEMS]),
      ...buildOutletMovementNodes(movements).nodes,
      // A delivery run covers several requests, so the parent update takes a role — one
      // roleless node per request would collapse them onto a single address.
      updateNode(RESOURCE_NAME, parent.Code, {
        Progress: nextProgress,
        ...stampFields('ProgressDelivered', actorName, comment)
      }, [RESOURCE_NAME], text(options.role) || text(parent.Code))
    ],
    permissions: { [RESOURCE_NAME]: 'markDelivered', [RESTOCK_ITEMS]: 'create', [OUTLET_MOVEMENTS]: 'create' },
    successMsg: 'Delivery confirmed and outlet stock updated.'
  }
}

// Creation lives next door, split for file size. Re-exported so callers keep one import.
export {
  RESTOCK_REF_PATH,
  restockCreateFields,
  restockCreatePermissions,
  buildRestockCreateChainNodes,
  buildRestockNodes,
  buildRestockChainNodes
} from './useRestockCreation'

export function useRestockPayload () {
  return {
    buildRestockAllocationNodes,
    buildPendingRestockAllocationNodes,
    buildRestockCancelItemNodes,
    buildRestockRejectNodes,
    buildRestockDeliveryNodes,
    nextRestockProgress
  }
}
