
import { batchRef, textOrRef } from 'src/utils/appHelpers'
import { toDateTime24 } from 'src/utils/dateHelpers'
import { actionNode, bulkNode, createNode, updateNode } from 'src/composables/resources/nodePayloads'
import {
  SUBMITTED,
  COMPLETED,
  CANCELLED,
  STOCKED,
  DISPOSED,
  isFlagged,
  isReturnCompleted,
  isCancelled,
  isEditable,
  invoiceAdjustmentRequired,
  warehouseActionRequired,
  warehouseActionCompleted
} from './useReturnProgress'

import { INTO_WAREHOUSE, STOCK_REFERENCE, stockMovementRow, buildStockMovementNodes } from 'src/_resource/Operation/StockMovements/composables/useStockMovementPayload'
import { OFF_THE_SHELF, ONTO_THE_SHELF, OUTLET_REFERENCE, outletMovementRow } from 'src/_resource/Operation/OutletMovements/composables/useOutletMovementPayload'
const RESOURCE_NAME = 'OutletReturns' // this module IS OutletReturns — always

const OUTLET_MOVEMENTS = 'OutletMovements'
const STOCK_MOVEMENTS = 'StockMovements'

const REF_RETURN = 'OutletReturn'

/** The batch path a movement created alongside a brand-new return chains its code off. */
export const RETURN_REF_PATH = `${RESOURCE_NAME}.latest.code`

const DEFAULT_STORAGE = '_default'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const asList = (value) => (Array.isArray(value) ? value : [])
const toNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}
const todayISO = () => new Date().toISOString().slice(0, 10)

/** The `'TRUE'`/`'FALSE'` strings the sheet stores — never a native boolean. */
const flag = (value) => (isFlagged(value) ? 'TRUE' : 'FALSE')

export function returnQtyChange (qty, { invoiceRequired = false, warehouseRequired = false } = {}) {
  const quantity = Math.abs(toNumber(qty))
  if (invoiceRequired && !warehouseRequired) return quantity
  if (!invoiceRequired && warehouseRequired) return -quantity
  return 0
}

/** The same table read off a STORED row, for the cancellation reversal. */
export function storedQtyChange (record) {
  const row = asRow(record)
  return returnQtyChange(row.Qty, {
    invoiceRequired: invoiceAdjustmentRequired(row),
    warehouseRequired: warehouseActionRequired(row)
  })
}

// The outlet ledger's own row builder. `qtyChange` already carries its sign from
// `returnQtyChange` - the matrix below is what decides the direction, not the caller.
function outletMovement ({ outletCode, storageName, sku, qtyChange, referenceCode, movementDate }) {
  return outletMovementRow({
    outletCode,
    storageName,
    sku,
    qty: qtyChange,
    direction: toNumber(qtyChange) < 0 ? OFF_THE_SHELF : ONTO_THE_SHELF,
    referenceType: OUTLET_REFERENCE.RETURN,
    referenceCode,
    movementDate
  })
}

export function buildReturnCreateNodes ({ form = {}, resolvedPrice = 0, actorName = '' } = {}) {
  const entry = asRow(form)
  const outletCode = text(entry.OutletCode)
  const sku = text(entry.SKU)
  const qty = Math.abs(toNumber(entry.Qty))

  if (!outletCode) return { valid: false, message: 'Outlet is required.' }
  if (!sku) return { valid: false, message: 'SKU is required.' }
  if (qty <= 0) return { valid: false, message: 'Returned quantity must be greater than 0.' }

  const invoiceRequired = isFlagged(entry.InvoiceAdjustmentRequired)
  const warehouseRequired = isFlagged(entry.WarehouseActionRequired)

  if (warehouseRequired && !text(entry.WarehouseCode)) {
    return { valid: false, message: 'Target warehouse is required when stock is leaving the outlet.' }
  }

  const record = {
    OutletCode: outletCode,
    Date: text(entry.Date) || todayISO(),
    Username: text(entry.Username) || text(actorName),
    SKU: sku,
    Qty: qty,
    Price: Math.round(toNumber(resolvedPrice) * 100) / 100,
    Reason: text(entry.Reason) || 'DAMAGE',
    ReasonComment: text(entry.ReasonComment),
    InvoiceAdjustmentRequired: flag(invoiceRequired),
    InvoiceAdjustmentDone: 'FALSE',
    // Only ever populated by the invoice chain, never at creation: a return carries a
    // SETTLEMENT invoice code once an invoice has actually credited it.
    ConsumptionInvoiceCode: '',
    SourceInvoiceCode: text(entry.SourceInvoiceCode),
    WarehouseActionRequired: flag(warehouseRequired),
    WarehouseActionCompleted: 'FALSE',
    WarehouseCode: warehouseRequired ? text(entry.WarehouseCode) : '',
    WarehouseAction: '',
    WarehouseActionDisposedReason: '',
    Status: 'Active'
  }

  // The completion question asked of the row as it will be STORED — not of the form.
  record.Progress = isReturnCompleted(record) ? COMPLETED : SUBMITTED

  const nodes = [createNode(RESOURCE_NAME, record, [RESOURCE_NAME])]

  const qtyChange = returnQtyChange(qty, { invoiceRequired, warehouseRequired })
  if (qtyChange !== 0) {
    nodes.push(createNode(OUTLET_MOVEMENTS, outletMovement({
      outletCode,
      storageName: entry.StorageName,
      sku,
      qtyChange,
      // The return does not exist yet; GAS resolves this to its generated code (§9.4).
      referenceCode: batchRef(RETURN_REF_PATH),
      movementDate: record.Date
    }), ['OutletStorages']))
  }

  return {
    valid: true,
    nodes,
    permissions: {
      outletReturn: 'create',
      ...(qtyChange !== 0 ? { outletMovement: 'create' } : {})
    },
    successMsg: 'Return logged.'
  }
}

export function buildReturnUpdateNodes ({ record = {}, form = {}, resolvedPrice = 0 } = {}) {
  const stored = asRow(record)
  const entry = asRow(form)
  const code = text(stored.Code)

  if (!code) return { valid: false, message: 'Return code is missing.' }
  if (!isEditable(stored)) {
    return { valid: false, message: 'This return can no longer be edited. Cancel and re-log it instead.' }
  }

  const sku = text(entry.SKU)
  const qty = Math.abs(toNumber(entry.Qty))

  if (!sku) return { valid: false, message: 'SKU is required.' }
  if (qty <= 0) return { valid: false, message: 'Returned quantity must be greater than 0.' }

  const invoiceRequired = isFlagged(entry.InvoiceAdjustmentRequired)
  const warehouseRequired = isFlagged(entry.WarehouseActionRequired)

  if (!invoiceRequired && !warehouseRequired) {
    return { valid: false, message: 'A return must either be credited on an invoice or move stock off the shelf.' }
  }

  if (warehouseRequired && !text(entry.WarehouseCode)) {
    return { valid: false, message: 'Target warehouse is required when stock is leaving the outlet.' }
  }

  const changes = {
    SKU: sku,
    Qty: qty,
    Price: Math.round(toNumber(resolvedPrice) * 100) / 100,
    Reason: text(entry.Reason) || 'DAMAGE',
    ReasonComment: text(entry.ReasonComment),
    InvoiceAdjustmentRequired: flag(invoiceRequired),
    WarehouseActionRequired: flag(warehouseRequired),
    WarehouseCode: warehouseRequired ? text(entry.WarehouseCode) : '',
    SourceInvoiceCode: text(entry.SourceInvoiceCode)
  }

  // The completion question asked of the row as it will BE once this lands, never of the
  // row as it was — turning a track off can complete a return that was waiting on it.
  const merged = { ...stored, ...changes }
  changes.Progress = isReturnCompleted(merged) ? COMPLETED : (text(stored.Progress) || SUBMITTED)

  const nodes = [updateNode(RESOURCE_NAME, code, changes, [RESOURCE_NAME, 'OutletStorages'])]

  const delta = returnQtyChange(qty, { invoiceRequired, warehouseRequired }) - storedQtyChange(stored)
  if (delta !== 0) {
    nodes.push(createNode(OUTLET_MOVEMENTS, outletMovement({
      outletCode: stored.OutletCode,
      storageName: stored.StorageName,
      // The correction follows the CORRECTED item: an edit that changed the SKU has to move
      // the units back onto the shelf they never left and off the one they did.
      sku,
      qtyChange: delta,
      referenceCode: code,
      movementDate: todayISO()
    }), ['OutletStorages']))
  }

  return {
    valid: true,
    nodes,
    permissions: {
      outletReturn: 'update',
      ...(delta !== 0 ? { outletMovement: 'create' } : {})
    },
    successMsg: `Return ${code} updated.`
  }
}

export function buildReturnBulkCreateNodes ({ lines = [], actorName = '', movementDate = '' } = {}) {
  const entries = asList(lines).map(asRow).filter((line) => text(asRow(line.form).SKU))
  if (!entries.length) return { valid: true, nodes: [], permissions: {} }

  const records = []
  const movements = []

  for (const line of entries) {
    const built = buildReturnCreateNodes({
      form: line.form,
      resolvedPrice: line.resolvedPrice,
      actorName
    })
    // Bubble the child's own message rather than restating it (§9.3).
    if (!built.valid) return built

    // Unwrap the per-line requests back into the two bulk collections. The builder is the
    // one that decided every column and every sign; this only regroups them.
    for (const node of built.nodes) {
      if (node.resource === RESOURCE_NAME) records.push(node.record)
      else movements.push({ ...node.record, MovementDate: text(movementDate) || node.record.MovementDate })
    }
  }

  const nodes = [bulkNode(RESOURCE_NAME, records, [RESOURCE_NAME])]
  if (movements.length) nodes.push(bulkNode(OUTLET_MOVEMENTS, movements, ['OutletStorages']))

  return {
    valid: true,
    nodes,
    permissions: {
      outletReturn: 'create',
      ...(movements.length ? { outletMovement: 'create' } : {})
    },
    successMsg: `${records.length} return${records.length === 1 ? '' : 's'} logged.`
  }
}

export function buildReturnWarehouseActionNodes ({
  record = {},
  actionType = STOCKED,
  storageName = '',
  disposalReason = '',
  actorName = ''
} = {}) {
  const row = asRow(record)
  const code = text(row.Code)

  if (!code) return { valid: false, message: 'Return code is missing.' }
  if (isCancelled(row)) return { valid: false, message: 'A cancelled return cannot be actioned.' }
  if (!warehouseActionRequired(row)) return { valid: false, message: 'This return has no warehouse action to confirm.' }
  if (warehouseActionCompleted(row)) return { valid: false, message: 'The warehouse action is already confirmed.' }

  const isDisposed = text(actionType) === DISPOSED
  if (isDisposed && !text(disposalReason)) {
    return { valid: false, message: 'A disposal reason is required when writing stock off.' }
  }

  const now = toDateTime24(new Date())
  const actor = text(actorName)

  const update = {
    WarehouseActionCompleted: 'TRUE',
    WarehouseAction: isDisposed ? DISPOSED : STOCKED,
    ...(isDisposed
      ? {
          WarehouseActionDisposedReason: text(disposalReason),
          WarehouseActionDisposedAt: now,
          WarehouseActionDisposedBy: actor
        }
      : {
          WarehouseActionStockedAt: now,
          WarehouseActionStockedBy: actor
        })
  }

  // Would the row be complete once this update lands? Asked of the merged state, never of
  // the stored row — the physical track is about to become settled.
  if (isReturnCompleted({ ...row, ...update })) update.Progress = COMPLETED

  const nodes = [updateNode(RESOURCE_NAME, code, update, [RESOURCE_NAME, 'WarehouseStorages'])]

  const stocksBackIn = !isDisposed && text(row.WarehouseCode)
  if (stocksBackIn) {
    // The warehouse RECEIVES, whatever sign the outlet ledger took when they left.
    nodes.push(...buildStockMovementNodes([stockMovementRow({
      warehouseCode: row.WarehouseCode,
      storageName,
      sku: row.SKU,
      qty: row.Qty,
      direction: INTO_WAREHOUSE,
      referenceType: STOCK_REFERENCE.RETURN,
      referenceCode: code
    })]).nodes)
  }

  return {
    valid: true,
    nodes,
    permissions: {
      outletReturn: 'warehouseAction',
      ...(stocksBackIn ? { stockMovement: 'create' } : {})
    },
    successMsg: isDisposed ? 'Return disposed.' : 'Return stocked into the warehouse.'
  }
}

export function buildReturnMarkInvoiceAdjustedNodes ({ record = {}, actorName = '', comment = '' } = {}) {
  const row = asRow(record)
  const code = text(row.Code)

  if (!code) return { valid: false, message: 'Return code is missing.' }
  if (isCancelled(row)) return { valid: false, message: 'A cancelled return cannot be settled.' }
  if (!invoiceAdjustmentRequired(row)) return { valid: false, message: 'This return needs no invoice adjustment.' }
  if (isFlagged(row.InvoiceAdjustmentDone)) return { valid: false, message: 'The invoice adjustment is already settled.' }

  const update = { InvoiceAdjustmentDone: 'TRUE' }
  if (isReturnCompleted({ ...row, ...update })) update.Progress = COMPLETED

  return {
    valid: true,
    nodes: [updateNode(RESOURCE_NAME, code, update, [RESOURCE_NAME])],
    permissions: { outletReturn: 'markInvoiceAdjusted' },
    successMsg: 'Invoice adjustment settled.'
  }
}

export function buildReturnInvoiceAdjustmentLinkedNodes ({ returnRows = [], invoiceCode = null, actorName = '' } = {}) {
  const rows = asList(returnRows).map(asRow).filter((row) => text(row.Code))
  if (!rows.length) return { valid: true, nodes: [], permissions: {} }

  // One bulk, not one update per row: a node is addressed by resource, so several
  // single-record nodes for OutletReturns would collapse onto each other.
  const records = rows.map((row) => {
    const update = {
      Code: text(row.Code),
      InvoiceAdjustmentDone: 'TRUE',
      ConsumptionInvoiceCode: textOrRef(invoiceCode)
    }
    // Per row, against that row's own warehouse track — never one verdict for the batch.
    if (isReturnCompleted({ ...row, ...update })) update.Progress = COMPLETED
    return update
  })

  return {
    valid: true,
    nodes: [bulkNode(RESOURCE_NAME, records, [RESOURCE_NAME])],
    permissions: { outletReturn: 'update' },
    successMsg: `${rows.length} return${rows.length === 1 ? '' : 's'} credited.`
  }
}

export function buildReturnInvoiceCreditReversalNodes ({ returnRows = [] } = {}) {
  const rows = asList(returnRows).map(asRow)
    .filter((row) => text(row.Code) && !isCancelled(row))
  if (!rows.length) return { valid: true, nodes: [], permissions: {} }

  return {
    valid: true,
    nodes: [bulkNode(RESOURCE_NAME, rows.map((row) => ({
      Code: text(row.Code),
      InvoiceAdjustmentDone: 'FALSE',
      ConsumptionInvoiceCode: '',
      Progress: SUBMITTED
    })), [RESOURCE_NAME])],
    permissions: { outletReturn: 'update' },
    successMsg: `${rows.length} return credit${rows.length === 1 ? '' : 's'} reversed.`
  }
}

export function buildReturnCancelNodes ({ record = {}, reason = '', actorName = '' } = {}) {
  const row = asRow(record)
  const code = text(row.Code)

  if (!code) return { valid: false, message: 'Return code is missing.' }
  if (isCancelled(row)) return { valid: false, message: 'This return is already cancelled.' }
  if (!text(reason)) return { valid: false, message: 'A cancellation reason is required.' }

  const nodes = [
    actionNode(RESOURCE_NAME, code, {
      action: 'Cancel',
      column: 'Progress',
      columnValue: CANCELLED
    }, {
      Comment: text(reason),
      ProgressCancelledComment: text(reason),
      ProgressCancelledBy: text(actorName)
    }, { reload: [RESOURCE_NAME, 'OutletStorages'] })
  ]

  const reversal = -storedQtyChange(row)
  if (reversal !== 0) {
    nodes.push(createNode(OUTLET_MOVEMENTS, outletMovement({
      outletCode: row.OutletCode,
      storageName: row.StorageName,
      sku: row.SKU,
      qtyChange: reversal,
      referenceCode: code,
      movementDate: todayISO()
    }), ['OutletStorages']))
  }

  return {
    valid: true,
    nodes,
    permissions: {
      // An action permission resolves as `can<PascalCase(action)>`, so the value must be
      // the action's OWN name exactly as GAS declares it.
      outletReturn: 'Cancel',
      ...(reversal !== 0 ? { outletMovement: 'create' } : {})
    },
    successMsg: `Return ${code} cancelled.`
  }
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useReturnPayload () {
  return {
    RETURN_REF_PATH,
    returnQtyChange,
    storedQtyChange,
    buildReturnCreateNodes,
    buildReturnUpdateNodes,
    buildReturnBulkCreateNodes,
    buildReturnWarehouseActionNodes,
    buildReturnMarkInvoiceAdjustedNodes,
    buildReturnInvoiceAdjustmentLinkedNodes,
    buildReturnInvoiceCreditReversalNodes,
    buildReturnCancelNodes
  }
}
