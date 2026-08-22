
import { batchRef, textOrRef } from 'src/utils/appHelpers'
import { toDateTime24 } from 'src/utils/dateHelpers'
import {
  resourceBulkRequest,
  resourceCreateRequest,
  resourceUpdateRequest,
  resourceGetRequest,
  executeActionRequest
} from 'src/composables/resources/resourceRequests'
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

function outletMovement ({ outletCode, storageName, sku, qtyChange, referenceCode, movementDate }) {
  return {
    OutletCode: text(outletCode),
    StorageName: text(storageName) || DEFAULT_STORAGE,
    SKU: text(sku),
    QtyChange: qtyChange,
    ReferenceType: REF_RETURN,
    ReferenceCode: textOrRef(referenceCode),
    MovementDate: text(movementDate) || todayISO(),
    Status: 'Active'
  }
}

export function buildReturnCreateBatch ({ form = {}, resolvedPrice = 0, actorName = '' } = {}) {
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

  const requests = [resourceCreateRequest(RESOURCE_NAME, record, [RESOURCE_NAME])]

  const qtyChange = returnQtyChange(qty, { invoiceRequired, warehouseRequired })
  if (qtyChange !== 0) {
    requests.push(resourceCreateRequest(OUTLET_MOVEMENTS, outletMovement({
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
    requests,
    permissions: {
      outletReturn: 'create',
      ...(qtyChange !== 0 ? { outletMovement: 'create' } : {})
    },
    successMsg: 'Return logged.'
  }
}

export function buildReturnUpdateBatch ({ record = {}, form = {}, resolvedPrice = 0 } = {}) {
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

  const requests = [resourceUpdateRequest(RESOURCE_NAME, code, changes, [RESOURCE_NAME])]

  const delta = returnQtyChange(qty, { invoiceRequired, warehouseRequired }) - storedQtyChange(stored)
  if (delta !== 0) {
    requests.push(resourceCreateRequest(OUTLET_MOVEMENTS, outletMovement({
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

  requests.push(resourceGetRequest([RESOURCE_NAME, 'OutletStorages']))

  return {
    valid: true,
    requests,
    permissions: {
      outletReturn: 'update',
      ...(delta !== 0 ? { outletMovement: 'create' } : {})
    },
    successMsg: `Return ${code} updated.`
  }
}

export function buildReturnBulkCreateBatch ({ lines = [], actorName = '', movementDate = '' } = {}) {
  const entries = asList(lines).map(asRow).filter((line) => text(asRow(line.form).SKU))
  if (!entries.length) return { valid: true, requests: [], permissions: {} }

  const records = []
  const movements = []

  for (const line of entries) {
    const built = buildReturnCreateBatch({
      form: line.form,
      resolvedPrice: line.resolvedPrice,
      actorName
    })
    // Bubble the child's own message rather than restating it (§9.3).
    if (!built.valid) return built

    // Unwrap the per-line requests back into the two bulk collections. The builder is the
    // one that decided every column and every sign; this only regroups them.
    for (const request of built.requests) {
      if (request.resource === RESOURCE_NAME) records.push(request.payload.record)
      else movements.push({ ...request.payload.record, MovementDate: text(movementDate) || request.payload.record.MovementDate })
    }
  }

  const requests = [resourceBulkRequest(RESOURCE_NAME, records, [RESOURCE_NAME])]
  if (movements.length) requests.push(resourceBulkRequest(OUTLET_MOVEMENTS, movements, ['OutletStorages']))

  return {
    valid: true,
    requests,
    permissions: {
      outletReturn: 'create',
      ...(movements.length ? { outletMovement: 'create' } : {})
    },
    successMsg: `${records.length} return${records.length === 1 ? '' : 's'} logged.`
  }
}

export function buildReturnWarehouseActionBatch ({
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

  const requests = [resourceUpdateRequest(RESOURCE_NAME, code, update, [RESOURCE_NAME])]

  const stocksBackIn = !isDisposed && text(row.WarehouseCode)
  if (stocksBackIn) {
    requests.push(resourceCreateRequest(STOCK_MOVEMENTS, {
      WarehouseCode: text(row.WarehouseCode),
      StorageName: text(storageName) || DEFAULT_STORAGE,
      SKU: text(row.SKU),
      // Always positive: the warehouse is RECEIVING units, whatever sign the outlet ledger
      // took when they left the shelf.
      QtyChange: Math.abs(toNumber(row.Qty)),
      ReferenceType: REF_RETURN,
      ReferenceCode: code,
      MovementDate: todayISO(),
      Status: 'Active'
    }, ['WarehouseStorages']))
  }

  requests.push(resourceGetRequest([RESOURCE_NAME, 'WarehouseStorages']))

  return {
    valid: true,
    requests,
    permissions: {
      outletReturn: 'update',
      ...(stocksBackIn ? { stockMovement: 'create' } : {})
    },
    successMsg: isDisposed ? 'Return disposed.' : 'Return stocked into the warehouse.'
  }
}

export function buildReturnMarkInvoiceAdjustedBatch ({ record = {}, actorName = '', comment = '' } = {}) {
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
    requests: [
      resourceUpdateRequest(RESOURCE_NAME, code, update, [RESOURCE_NAME]),
      resourceGetRequest([RESOURCE_NAME])
    ],
    permissions: { outletReturn: 'update' },
    successMsg: 'Invoice adjustment settled.'
  }
}

export function buildReturnInvoiceAdjustmentLinkedBatch ({ returnRows = [], invoiceCode = null, actorName = '' } = {}) {
  const rows = asList(returnRows).map(asRow).filter((row) => text(row.Code))
  if (!rows.length) return { valid: true, requests: [], permissions: {} }

  const requests = rows.map((row) => {
    const update = {
      InvoiceAdjustmentDone: 'TRUE',
      ConsumptionInvoiceCode: textOrRef(invoiceCode)
    }
    // Per row, against that row's own warehouse track — never one verdict for the batch.
    if (isReturnCompleted({ ...row, ...update })) update.Progress = COMPLETED
    return resourceUpdateRequest(RESOURCE_NAME, text(row.Code), update, [RESOURCE_NAME])
  })

  return {
    valid: true,
    requests,
    permissions: { outletReturn: 'update' },
    successMsg: `${rows.length} return${rows.length === 1 ? '' : 's'} credited.`
  }
}

export function buildReturnInvoiceCreditReversalBatch ({ returnRows = [] } = {}) {
  const rows = asList(returnRows).map(asRow)
    .filter((row) => text(row.Code) && !isCancelled(row))
  if (!rows.length) return { valid: true, requests: [], permissions: {} }

  const requests = rows.map((row) => resourceUpdateRequest(RESOURCE_NAME, text(row.Code), {
    InvoiceAdjustmentDone: 'FALSE',
    ConsumptionInvoiceCode: '',
    Progress: SUBMITTED
  }, [RESOURCE_NAME]))

  return {
    valid: true,
    requests,
    permissions: { outletReturn: 'update' },
    successMsg: `${rows.length} return credit${rows.length === 1 ? '' : 's'} reversed.`
  }
}

export function buildReturnCancelBatch ({ record = {}, reason = '', actorName = '' } = {}) {
  const row = asRow(record)
  const code = text(row.Code)

  if (!code) return { valid: false, message: 'Return code is missing.' }
  if (isCancelled(row)) return { valid: false, message: 'This return is already cancelled.' }
  if (!text(reason)) return { valid: false, message: 'A cancellation reason is required.' }

  const requests = [
    executeActionRequest(RESOURCE_NAME, code, {
      action: 'Cancel',
      column: 'Progress',
      columnValue: CANCELLED
    }, {
      Comment: text(reason),
      ProgressCancelledComment: text(reason),
      ProgressCancelledBy: text(actorName)
    }, [RESOURCE_NAME])
  ]

  const reversal = -storedQtyChange(row)
  if (reversal !== 0) {
    requests.push(resourceCreateRequest(OUTLET_MOVEMENTS, outletMovement({
      outletCode: row.OutletCode,
      storageName: row.StorageName,
      sku: row.SKU,
      qtyChange: reversal,
      referenceCode: code,
      movementDate: todayISO()
    }), ['OutletStorages']))
  }

  requests.push(resourceGetRequest([RESOURCE_NAME, 'OutletStorages']))

  return {
    valid: true,
    requests,
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
    buildReturnCreateBatch,
    buildReturnUpdateBatch,
    buildReturnBulkCreateBatch,
    buildReturnWarehouseActionBatch,
    buildReturnMarkInvoiceAdjustedBatch,
    buildReturnInvoiceAdjustmentLinkedBatch,
    buildReturnInvoiceCreditReversalBatch,
    buildReturnCancelBatch
  }
}
