import { textOrRef } from 'src/utils/appHelpers'
import {
  buildGoodsReceiptCompositeNode,
  buildGoodsReceiptInvalidateNodes
} from 'src/_resource/Operation/GoodsReceipts/composables/useGoodsReceiptPayload'
import { buildProcurementProgressNode, buildProcurementRollbackNode } from 'src/_resource/Operation/Procurements/composables/useProcurementPayload'
import { GOODS_RECEIVING, GRN_GENERATED as PROC_GRN_GENERATED, PO_ISSUED } from 'src/_resource/Operation/Procurements/composables/useProcurementProgress'
import {
  DRAFT,
  CONFIRMED,
  GRN_GENERATED,
  CANCELLED,
  canConfirm,
  canGenerateGrn,
  canCancel,
  isEditable
} from './usePOReceivingProgress'
import { normalizeNumber, validateInspection, acceptedItems } from './usePOReceivingInspection'

import { stampFields } from 'src/utils/workflowStamp'
const RESOURCE_NAME = 'POReceivings'
const ITEMS_RESOURCE = 'POReceivingItems'
const REFRESH_RESOURCES = [
  'PurchaseOrders',
  'PurchaseOrderItems',
  'POReceivings',
  'POReceivingItems',
  'GoodsReceipts',
  'GoodsReceiptItems',
  'Procurements'
]

export const CONFIRM_ACTION = { action: 'Confirm', column: 'Progress', columnValue: CONFIRMED }
export const GENERATE_GRN_ACTION = { action: 'GenerateGRN', column: 'Progress', columnValue: GRN_GENERATED }
export const CANCEL_ACTION = { action: 'Cancel', column: 'Progress', columnValue: CANCELLED }

export { RESOURCE_NAME, ITEMS_RESOURCE, REFRESH_RESOURCES }

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})


export function todayDashed () {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function buildReceivingHeaderRecord (form = {}) {
  const input = asRow(form)
  return {
    ProcurementCode: text(input.ProcurementCode),
    PurchaseOrderCode: text(input.PurchaseOrderCode),
    InspectionDate: text(input.InspectionDate) || todayDashed(),
    InspectedUserName: text(input.InspectedUserName),
    Progress: text(input.Progress).toUpperCase() || DRAFT,
    Remarks: text(input.Remarks),
    Status: text(input.Status) || 'Active'
  }
}

export function buildReceivingItemRecord (item = {}) {
  const row = asRow(item)
  return {
    PurchaseOrderItemCode: text(row.PurchaseOrderItemCode),
    SKU: text(row.SKU),
    ExpectedQty: normalizeNumber(row.ExpectedQty),
    ReceivedQty: normalizeNumber(row.ReceivedQty),
    DamagedQty: normalizeNumber(row.DamagedQty),
    RejectedQty: normalizeNumber(row.RejectedQty),
    RejectedReason: text(row.RejectedReason),
    Remarks: text(row.Remarks),
    Status: text(row.Status) || 'Active'
  }
}

// One line per purchase order line, keyed on the PO item code so a resumed draft
// cannot seed a second copy of a line it already holds.
export function dedupeItemLines (items = []) {
  const byKey = new Map()
  for (const entry of (Array.isArray(items) ? items : []).map(asRow)) {
    const key = text(entry.PurchaseOrderItemCode) || text(entry.SKU)
    if (!key) continue
    const existing = byKey.get(key)
    const active = text(entry.Status || 'Active') === 'Active'
    if (!existing || (text(existing.Status || 'Active') !== 'Active' && active)) byKey.set(key, entry)
  }
  return Array.from(byKey.values())
}

export function buildReceivingCompositeNode (form = {}, items = []) {
  const input = asRow(form)
  return {
    resource: RESOURCE_NAME,
    ...(text(input.Code) ? { code: text(input.Code) } : {}),
    data: buildReceivingHeaderRecord(input),
    children: [{
      resource: ITEMS_RESOURCE,
      records: dedupeItemLines(items).map((row) => ({
        _action: text(row.Code) ? 'update' : 'create',
        ...(text(row.Code) ? { _originalCode: text(row.Code) } : {}),
        data: buildReceivingItemRecord(row)
      }))
    }]
  , permissions: { confirm: 'You are not allowed to confirm this poreceiving.' }}
}

// Saving a receiving draft is what starts the goods-receiving stage on the procurement.
export function buildReceivingSaveChainNodes ({ form = {}, items = [], receiving = null, procurement = null } = {}) {
  const input = asRow(form)
  const existing = asRow(receiving)

  if (text(existing.Code) && !isEditable(existing)) {
    return [{ valid: false, message: 'This receiving is no longer editable.' }]
  }

  const validation = validateInspection(input, items)
  if (!validation.valid) {
    return [{ valid: false, message: validation.errors[0] }]
  }

  const nodes = [buildReceivingCompositeNode(input, items)]

  const advance = buildProcurementProgressNode(procurement, GOODS_RECEIVING)
  if (advance) {
    nodes.push(advance)
  }

  nodes.push({ resource: '$batch', reload: REFRESH_RESOURCES , successMsg: 'Receiving saved.'})

  return nodes
}

export function buildReceivingConfirmChainNodes ({ receiving = null, items = [], comment = '', actorName = '' } = {}) {
  const record = asRow(receiving)
  const code = text(record.Code)
  if (!code) {
    return [{ valid: false, message: 'No receiving loaded.' }]
  }
  if (!canConfirm(record)) {
    return [{ valid: false, message: 'Only a draft receiving can be confirmed.' }]
  }
  const validation = validateInspection(record, items)
  if (!validation.valid) {
    return [{ valid: false, message: validation.errors[0] }]
  }

  return [
    { resource: RESOURCE_NAME, actions: [{ ...CONFIRM_ACTION, code: textOrRef(code), data: { fields: stampFields('ProgressConfirmed', actorName, comment) } }], successMsg: 'Inspection confirmed.' },
    { resource: '$batch', reload: REFRESH_RESOURCES }
  ]
}

// GRN generation writes the receipt through the GoodsReceipts domain builder, stamps
// this receiving, and advances the procurement.
export function buildGenerateGrnChainNodes ({
  receiving = null,
  items = [],
  purchaseOrder = null,
  procurement = null,
  comment = '',
  actorName = ''
} = {}) {
  const record = asRow(receiving)
  const code = text(record.Code)
  if (!code) {
    return [{ valid: false, message: 'No receiving loaded.' }]
  }
  if (!canGenerateGrn(record)) {
    return [{ valid: false, message: 'Only a confirmed receiving can generate a GRN.' }]
  }
  if (!acceptedItems(items).length) {
    return [{ valid: false, message: 'No accepted quantity to post — a GRN would be empty.' }]
  }

  const nodes = [
    buildGoodsReceiptCompositeNode({ receiving: record, items, purchaseOrder, procurement }),
    { resource: RESOURCE_NAME, actions: [{ ...GENERATE_GRN_ACTION, code: textOrRef(code), data: { fields: stampFields('ProgressGRNGenerated', actorName, comment) } }] , permissions: { generateGRN: 'You are not allowed to generate grn this poreceiving.' }, successMsg: 'Goods receipt generated.'}
  ]

  const advance = buildProcurementProgressNode(procurement, PROC_GRN_GENERATED)
  if (advance) {
    nodes.push(advance)
  }

  nodes.push({ resource: '$batch', reload: REFRESH_RESOURCES })

  return nodes
}

// Cancelling invalidates any GRN this receiving produced before it stamps itself,
// because the stock posting must not survive the record that justified it.
export function buildReceivingCancelChainNodes ({
  receiving = null,
  goodsReceipt = null,
  goodsReceiptItems = [],
  procurement = null,
  comment = '',
  actorName = ''
} = {}) {
  const record = asRow(receiving)
  const code = text(record.Code)
  if (!code) {
    return [{ valid: false, message: 'No receiving loaded.' }]
  }
  if (!canCancel(record)) {
    return [{ valid: false, message: 'This receiving is already cancelled.' }]
  }
  if (!text(comment)) {
    return [{ valid: false, message: 'A cancellation comment is required.' }]
  }

  const nodes = []

  if (asRow(goodsReceipt).Code) {
    const invalidation = buildGoodsReceiptInvalidateNodes({ goodsReceipt, goodsReceiptItems })
    nodes.push(...invalidation)
  }

  nodes.push({ resource: RESOURCE_NAME, actions: [{ ...CANCEL_ACTION, code: textOrRef(code), data: { fields: stampFields('ProgressCancelled', actorName, comment) } }] , permissions: { cancel: 'You are not allowed to cancel this poreceiving.' }, successMsg: 'Receiving cancelled.'})

  const rollback = buildProcurementRollbackNode(procurement, PO_ISSUED)
  if (rollback) {
    nodes.push(rollback)
  }

  nodes.push({ resource: '$batch', reload: REFRESH_RESOURCES })

  return nodes
}

// Re-exported so a caller assembling a cancellation needs one import, not two.
export { buildGoodsReceiptInvalidateNodes }

export function usePOReceivingPayload () {
  return {
    buildReceivingHeaderRecord,
    buildReceivingItemRecord,
    buildReceivingCompositeNode,
    buildReceivingSaveChainNodes,
    buildReceivingConfirmChainNodes,
    buildGenerateGrnChainNodes,
    buildReceivingCancelChainNodes,
    dedupeItemLines,
    todayDashed
  }
}
