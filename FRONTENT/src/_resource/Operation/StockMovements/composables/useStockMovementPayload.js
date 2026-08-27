import { textOrRef } from 'src/utils/appHelpers'
import { toDateTime24 } from 'src/utils/dateHelpers'
import { bulkNode, createNode } from 'src/composables/resources/nodePayloads'

// The WAREHOUSE ledger. Every module that moves warehouse stock writes through here, so
// the sign rule and the ReferenceType vocabulary have one home.

export const RESOURCE_NAME = 'StockMovements'
export const WAREHOUSE_STORAGES = 'WarehouseStorages'
export const DEFAULT_STORAGE = '_default'

// Why a balance moved. A reconciliation reads this to tell a commitment apart from a
// return, so the strings are a contract, not labels.
export const STOCK_REFERENCE = {
  RESTOCK: 'OutletRestock',
  RETURN: 'OutletReturn'
}

// The whole sign contract, named rather than passed as -1/+1 at 5 call sites.
export const OUT_OF_WAREHOUSE = -1
export const INTO_WAREHOUSE = 1

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
// LOCAL date, not UTC. A ledger is reconciled by trading day, and a movement posted
// after midnight UTC-offset would otherwise land on the wrong one.
const today = () => toDateTime24(new Date()).slice(0, 10)

// Magnitude is ALWAYS absolute and `direction` alone decides the sign, so a row carrying
// an accidentally negative quantity cannot credit the warehouse for a deduction.
export function stockMovementRow ({
  warehouseCode = '',
  storageName = '',
  sku = '',
  qty = 0,
  direction = OUT_OF_WAREHOUSE,
  referenceType = STOCK_REFERENCE.RESTOCK,
  referenceCode = '',
  referenceItemCode = '',
  movementDate = ''
} = {}) {
  return {
    WarehouseCode: text(warehouseCode),
    StorageName: text(storageName) || DEFAULT_STORAGE,
    SKU: text(sku),
    QtyChange: Math.abs(num(qty)) * (direction < 0 ? -1 : 1),
    ReferenceType: text(referenceType),
    ReferenceCode: textOrRef(referenceCode),
    ...(text(referenceItemCode) ? { ReferenceItemCode: text(referenceItemCode) } : {}),
    MovementDate: text(movementDate) || today(),
    Status: 'Active'
  }
}

export function stockMovementPermissions () {
  return { [RESOURCE_NAME]: 'create' }
}

// An empty list yields NO node. A bulk with no records is not "no movement" - it is a
// round trip asking GAS to recalculate every warehouse balance on the strength of nothing.
export function buildStockMovementNodes (rows = []) {
  const records = (Array.isArray(rows) ? rows : []).filter(Boolean)
  if (!records.length) return { valid: true, nodes: [], permissions: {} }
  return {
    valid: true,
    nodes: [bulkNode(RESOURCE_NAME, records, [WAREHOUSE_STORAGES])],
    permissions: stockMovementPermissions()
  }
}

// One row, for a caller that genuinely writes a single movement.
export function buildStockMovementNode (row) {
  return row ? createNode(RESOURCE_NAME, row, [WAREHOUSE_STORAGES]) : null
}

export function useStockMovementPayload () {
  return {
    RESOURCE_NAME,
    STOCK_REFERENCE,
    OUT_OF_WAREHOUSE,
    INTO_WAREHOUSE,
    DEFAULT_STORAGE,
    stockMovementRow,
    stockMovementPermissions,
    buildStockMovementNodes,
    buildStockMovementNode
  }
}
