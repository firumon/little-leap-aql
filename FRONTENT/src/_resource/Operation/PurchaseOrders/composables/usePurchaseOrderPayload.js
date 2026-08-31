import { textOrRef } from 'src/utils/appHelpers'
import { buildQuotationAcceptNode } from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationPayload'
import { allowsPartialPo, isPoEligible, isDeclined, isRejected } from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationProgress'
import { buildRFQCloseNode, buildRFQReopenNode, buildSupplierCancelledNodes } from 'src/_resource/Operation/RFQs/composables/useRFQPayload'
import { buildProcurementProgressNode, buildProcurementRollbackNode } from 'src/_resource/Operation/Procurements/composables/useProcurementPayload'
import { PO_ISSUED, QUOTATIONS_RECEIVED } from 'src/_resource/Operation/Procurements/composables/useProcurementProgress'
import { CANCELLED, canCancel, consumesQuotationQuantity } from './usePurchaseOrderProgress'
import {
  normalizeNumber,
  stringifyCharges,
  itemSubtotal,
  extraChargesTotal,
  orderedQtyByQuotationItem,
  remainingQtyOf,
  hasLivePurchaseOrder,
  coversAllRemaining
} from './usePurchaseOrderTotals'

import { stampFields } from 'src/utils/workflowStamp'
const RESOURCE_NAME = 'PurchaseOrders'
const ITEMS_RESOURCE = 'PurchaseOrderItems'
const REFRESH_RESOURCES = ['PurchaseOrders', 'PurchaseOrderItems', 'SupplierQuotations', 'RFQs', 'RFQSuppliers', 'Procurements']

export const CANCEL_ACTION = { action: 'Cancel', column: 'Progress', columnValue: CANCELLED }
export const RFQ_CLOSE_COMMENT = 'Complete purchase order created, hence closing RFQ'

export { RESOURCE_NAME, ITEMS_RESOURCE }

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})


export function todayDashed () {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function rfqCloseComment (actorName = '') {
  return `${text(actorName) || 'system'}: "${RFQ_CLOSE_COMMENT}"`
}

export function buildPurchaseOrderHeaderRecord (form = {}) {
  const input = asRow(form)
  return {
    ProcurementCode: text(input.ProcurementCode),
    SupplierQuotationCode: text(input.SupplierQuotationCode),
    SupplierCode: text(input.SupplierCode),
    PODate: text(input.PODate) || todayDashed(),
    ShipToWarehouseCode: text(input.ShipToWarehouseCode),
    Currency: text(input.Currency),
    SubtotalAmount: normalizeNumber(input.SubtotalAmount),
    ExtraChargesBreakup: stringifyCharges(input.ExtraChargesBreakup),
    TotalAmount: normalizeNumber(input.TotalAmount),
    Remarks: text(input.Remarks),
    Status: 'Active'
  }
}

export function buildPurchaseOrderItemRecord (item = {}) {
  const row = asRow(item)
  return {
    SupplierQuotationItemCode: text(row.SupplierQuotationItemCode),
    SKU: text(row.SKU),
    Description: text(row.Description),
    UOM: text(row.UOM),
    QuotedQuantity: normalizeNumber(row.QuotedQuantity),
    OrderedQuantity: normalizeNumber(row.OrderedQuantity),
    UnitPrice: normalizeNumber(row.UnitPrice),
    SupplierItemCode: text(row.SupplierItemCode),
    Remarks: text(row.Remarks),
    Status: 'Active'
  }
}

export function validatePurchaseOrder ({
  form = {},
  items = [],
  quotation = null,
  quotationItems = [],
  purchaseOrders = [],
  purchaseOrderItems = []
} = {}) {
  const input = asRow(form)
  const source = asRow(quotation)
  const errors = []

  if (!text(source.Code)) {
    return { valid: false, errors: ['Select a supplier quotation.'], selectedItems: [] }
  }
  if (isDeclined(source)) errors.push('A declined quotation cannot become a purchase order.')
  if (isRejected(source)) errors.push('A rejected quotation cannot become a purchase order.')
  if (!isPoEligible(source)) errors.push('This quotation is not available for ordering.')
  if (!text(input.ShipToWarehouseCode)) errors.push('Select a ship-to warehouse.')

  const rows = (Array.isArray(items) ? items : []).map(asRow)
  const selectedItems = rows.filter((row) => row.Selected)
  if (!selectedItems.length) errors.push('Select at least one item.')

  const partialAllowed = allowsPartialPo(source)
  const orderedIndex = orderedQtyByQuotationItem(purchaseOrders, purchaseOrderItems, source.Code)

  if (!partialAllowed) {
    if (hasLivePurchaseOrder(purchaseOrders, source.Code)) {
      errors.push('A purchase order already exists for this quotation.')
    }
    for (const [index, row] of rows.entries()) {
      const remaining = normalizeNumber(row.RemainingQuantity)
      if (!row.Selected && remaining > 0) {
        errors.push(`Row ${index + 1}: a full purchase order must include every remaining item.`)
      }
    }
  }

  for (const [index, row] of selectedItems.entries()) {
    const ordered = normalizeNumber(row.OrderedQuantity)
    if (ordered <= 0) {
      errors.push(`Row ${index + 1} (${text(row.SKU)}) needs an ordered quantity above zero.`)
      continue
    }
    const quotedRow = (Array.isArray(quotationItems) ? quotationItems : [])
      .map(asRow)
      .find((entry) => text(entry.Code) === text(row.SupplierQuotationItemCode))
    const remaining = quotedRow ? remainingQtyOf(quotedRow, orderedIndex) : normalizeNumber(row.RemainingQuantity)
    if (partialAllowed && ordered > remaining) {
      errors.push(`Row ${index + 1} (${text(row.SKU)}) cannot exceed the remaining quantity of ${remaining}.`)
    }
  }

  return { valid: errors.length === 0, errors, selectedItems, orderedIndex }
}

// Issuing a PO accepts its quotation, can close the source RFQ, and advances the
// procurement. Every side-effect is built by the owning resource's own builder.
export function buildPurchaseOrderCreateChainNodes ({
  form = {},
  items = [],
  quotation = null,
  quotationItems = [],
  purchaseOrders = [],
  purchaseOrderItems = [],
  rfq = null,
  procurement = null,
  closeRfq = false,
  actorName = ''
} = {}) {
  const validation = validatePurchaseOrder({ form, items, quotation, quotationItems, purchaseOrders, purchaseOrderItems })
  if (!validation.valid) {
    return [{ valid: false, message: validation.errors[0] }]
  }

  const selected = validation.selectedItems
  const subtotal = itemSubtotal(selected)
  const charges = extraChargesTotal(asRow(form).ExtraChargesBreakup)

  const nodes = [{
    resource: RESOURCE_NAME,
    data: buildPurchaseOrderHeaderRecord({ ...asRow(form), SubtotalAmount: subtotal, TotalAmount: subtotal + charges }),
    children: [{
      resource: ITEMS_RESOURCE,
      records: selected.map((row) => ({ _action: 'create', data: buildPurchaseOrderItemRecord(row) }))
    }]
  }]

  const accept = buildQuotationAcceptNode(quotation)
  if (accept) {
    nodes.push(accept)
  }

  if (closeRfq) {
    const close = buildRFQCloseNode(rfq, actorName, rfqCloseComment(actorName))
    if (close) {
      nodes.push(close)
    }
  }

  const advance = buildProcurementProgressNode(procurement, PO_ISSUED)
  if (advance) {
    nodes.push(advance)
  }

  nodes.push({ resource: '$batch', reload: REFRESH_RESOURCES , successMsg: 'Purchase order created.'})

  return nodes
}

// Whether closing the source RFQ is worth offering — every quoted line is now covered.
export function shouldOfferRfqClose ({ quotationItems = [], selectedItems = [], purchaseOrders = [], purchaseOrderItems = [], quotationCode = '', rfq = null } = {}) {
  if (!asRow(rfq).Code) return false
  const orderedIndex = orderedQtyByQuotationItem(purchaseOrders, purchaseOrderItems, quotationCode)
  return coversAllRemaining(quotationItems, selectedItems, orderedIndex)
}

// Cancelling gives the quantity back: supplier rows go CANCELLED, a closed RFQ reopens,
// and a procurement with no other live PO returns to QUOTATIONS_RECEIVED.
export function buildPurchaseOrderCancelChainNodes ({
  purchaseOrder = null,
  comment = '',
  actorName = '',
  purchaseOrders = [],
  rfq = null,
  rfqSupplierRows = [],
  procurement = null
} = {}) {
  const record = asRow(purchaseOrder)
  const code = text(record.Code)
  if (!code) {
    return [{ valid: false, message: 'No purchase order loaded.' }]
  }
  if (!canCancel(record)) {
    return [{ valid: false, message: 'This purchase order can no longer be cancelled.' }]
  }
  if (!text(comment)) {
    return [{ valid: false, message: 'A cancellation comment is required.' }]
  }

  const nodes = [{ resource: RESOURCE_NAME, actions: [{ ...CANCEL_ACTION, code: textOrRef(code), data: { fields: stampFields('ProgressCancelled', actorName, comment) } }] , permissions: { cancel: 'You are not allowed to cancel this purchase order.' }, successMsg: 'Purchase order cancelled.'}]

  const supplierRequests = buildSupplierCancelledNodes(asRow(rfq).Code, record.SupplierCode, rfqSupplierRows)
  if (supplierRequests.length) {
    nodes.push(...supplierRequests)
  }

  const reopen = buildRFQReopenNode(rfq)
  if (reopen) {
    nodes.push(reopen)
  }

  const others = (Array.isArray(purchaseOrders) ? purchaseOrders : [])
    .map(asRow)
    .filter((row) => text(row.Code) !== code &&
      text(row.ProcurementCode) === text(record.ProcurementCode) &&
      consumesQuotationQuantity(row))

  if (!others.length) {
    const rollback = buildProcurementRollbackNode(procurement, QUOTATIONS_RECEIVED)
    if (rollback) {
      nodes.push(rollback)
    }
  }

  nodes.push({ resource: '$batch', reload: REFRESH_RESOURCES })

  return nodes
}

export function usePurchaseOrderPayload () {
  return {
    buildPurchaseOrderHeaderRecord,
    buildPurchaseOrderItemRecord,
    validatePurchaseOrder,
    buildPurchaseOrderCreateChainNodes,
    buildPurchaseOrderCancelChainNodes,
    shouldOfferRfqClose,
    rfqCloseComment,
    todayDashed
  }
}
