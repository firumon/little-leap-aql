import { textOrRef } from 'src/utils/appHelpers'
import { toDateTime24 } from 'src/utils/dateHelpers'

// The OUTLET ledger. The mirror of StockMovements: units leave a warehouse there and
// arrive on an outlet's shelf here, and the two must stay tellable apart when reconciling.

export const RESOURCE_NAME = 'OutletMovements'
export const OUTLET_STORAGES = 'OutletStorages'
export const DEFAULT_STORAGE = '_default'

export const OUTLET_REFERENCE = {
  CONSUMPTION: 'Consumption',
  CONSUMPTION_CANCELLED: 'ConsumptionCancelled',
  RESTOCK_DELIVERY: 'RestockDelivery',
  RETURN: 'OutletReturn'
}

// One audit can write this ledger twice — units leaving on a sale and units arriving on a
// restock delivery. A node is addressed by resource AND role, so each leg names its own.
export const OUTLET_ROLE = { SALE: 'sale', DELIVERY: 'delivery' }

export const OFF_THE_SHELF = -1
export const ONTO_THE_SHELF = 1

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
// LOCAL date, not UTC. A ledger is reconciled by trading day, and a movement posted
// after midnight UTC-offset would otherwise land on the wrong one.
const today = () => toDateTime24(new Date()).slice(0, 10)

// Magnitude is ALWAYS absolute and `direction` alone decides the sign, so a row carrying
// an accidentally negative quantity cannot credit the outlet for a sale.
export function outletMovementRow ({
  outletCode = '',
  storageName = '',
  sku = '',
  qty = 0,
  direction = OFF_THE_SHELF,
  referenceType = OUTLET_REFERENCE.CONSUMPTION,
  referenceCode = '',
  referenceItemCode = '',
  movementDate = ''
} = {}) {
  return {
    OutletCode: text(outletCode),
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

export function outletMovementPermissions () {
  return { create: 'You are not allowed to move outlet stock.' }
}

// An empty list yields NO node - see the note on the warehouse ledger.
export function buildOutletMovementNodes (rows = []) {
  const records = (Array.isArray(rows) ? rows : []).filter(Boolean)
  if (!records.length) return []
  return [{
    resource: RESOURCE_NAME,
    many: true,
    records,
    permissions: outletMovementPermissions(),
    reload: [OUTLET_STORAGES]
  }]
}

// NODE builder: high-level items in, a complete self-contained node out. The mirror of
// stockMovementsNode — same contract, the outlet shelf instead of the warehouse.
export function outletMovementsNode (items = [], {
  outletCode = '',
  referenceCode = '',
  referenceType = OUTLET_REFERENCE.RESTOCK_DELIVERY,
  direction = ONTO_THE_SHELF,
  movementDate = '',
  role = ''
} = {}) {
  const records = (Array.isArray(items) ? items : []).map((row) => outletMovementRow({
    outletCode,
    storageName: row?.StorageName,
    sku: row?.SKU,
    qty: row?.Quantity ?? row?.Qty,
    direction,
    referenceType,
    referenceCode,
    movementDate
  })).filter(Boolean)

  if (!records.length) return null
  return {
    resource: RESOURCE_NAME,
    ...(text(role) ? { role: text(role) } : {}),
    many: true,
    records,
    reload: [OUTLET_STORAGES],
    permissions: outletMovementPermissions()
  }
}

export function buildOutletMovementNode (row) {
  if (!row) return null
  return {
    resource: RESOURCE_NAME,
    record: row,
    permissions: outletMovementPermissions(),
    reload: [OUTLET_STORAGES]
  }
}

export function useOutletMovementPayload () {
  return {
    RESOURCE_NAME,
    OUTLET_REFERENCE,
    OUTLET_ROLE,
    OFF_THE_SHELF,
    ONTO_THE_SHELF,
    DEFAULT_STORAGE,
    outletMovementRow,
    outletMovementsNode,
    outletMovementPermissions,
    buildOutletMovementNodes,
    buildOutletMovementNode
  }
}
