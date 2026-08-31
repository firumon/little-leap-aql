import { textOrRef } from 'src/utils/appHelpers'
import { buildProcurementProgressNode } from 'src/_resource/Operation/Procurements/composables/useProcurementPayload'
import {
  RFQ_GENERATED,
  RFQ_SENT_TO_SUPPLIERS
} from 'src/_resource/Operation/Procurements/composables/useProcurementProgress'
import { buildRequisitionRfqProcessedNode } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionPayload'
import {
  DRAFT,
  SENT,
  CLOSED,
  SUPPLIER_ASSIGNED,
  SUPPLIER_SENT,
  SUPPLIER_RESPONDED,
  SUPPLIER_CANCELLED,
  buildPrItemCodeCsv,
  supplierRowsOf,
  allSuppliersDispatched,
  canAssignSuppliers,
  canMarkSuppliersSent,
  canClose,
  isDraft
} from './useRFQProgress'

import { stampFields } from 'src/utils/workflowStamp'
const RESOURCE_NAME = 'RFQs'
const SUPPLIERS_RESOURCE = 'RFQSuppliers'
const REFRESH_RESOURCES = ['RFQs', 'RFQSuppliers', 'PurchaseRequisitions', 'Procurements']

export const CLOSE_ACTION = { action: 'Close', column: 'Progress', columnValue: CLOSED }
export const RFQ_REF_PATH = 'RFQs.latest.code'

export { RESOURCE_NAME, SUPPLIERS_RESOURCE }

const text = (value) => String(value ?? '').trim()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const asRow = (value) => (value && typeof value === 'object' ? value : {})

function pad (value) { return String(value).padStart(2, '0') }

export function toDateInputValue (date = new Date()) {
  const value = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(value.getTime())) return ''
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

export function addDays (dateValue, days = 0) {
  const base = dateValue ? new Date(dateValue) : new Date()
  if (Number.isNaN(base.getTime())) return ''
  base.setDate(base.getDate() + num(days))
  return toDateInputValue(base)
}


export function buildRFQRecord ({ requisition = {}, items = [], form = {}, procurementCode = '' } = {}) {
  const pr = asRow(requisition)
  const input = asRow(form)
  const rfqDate = text(input.RFQDate) || toDateInputValue()
  return {
    ProcurementCode: text(procurementCode) || text(pr.ProcurementCode),
    PurchaseRequisitionCode: text(pr.Code),
    PurchaseRequisitionItemsCode: buildPrItemCodeCsv(items),
    RFQDate: rfqDate,
    LeadTimeDays: num(input.LeadTimeDays),
    LeadTimeType: text(input.LeadTimeType) || 'FLEXIBLE',
    ShippingTermMode: text(input.ShippingTermMode) || 'ANY',
    ShippingTerm: text(input.ShippingTermMode) === 'ANY' ? '' : text(input.ShippingTerm),
    PaymentTermMode: text(input.PaymentTermMode) || 'ANY',
    PaymentTerm: text(input.PaymentTermMode) === 'ANY' ? '' : text(input.PaymentTerm),
    PaymentTermDetail: text(input.PaymentTermDetail),
    QuotationValidityDays: num(input.QuotationValidityDays),
    QuotationValidityMode: text(input.QuotationValidityMode) || 'MIN_REQUIRED',
    DeliveryMode: text(input.DeliveryMode) || 'ANY',
    AllowPartialDelivery: input.AllowPartialDelivery ? 'Yes' : 'No',
    AllowSplitShipment: input.AllowSplitShipment ? 'Yes' : 'No',
    SubmissionDeadline: text(input.SubmissionDeadline) || addDays(rfqDate, 7),
    Progress: DRAFT,
    Status: 'Active'
  }
}

export function buildSupplierRecord ({ rfqCode = '', procurementCode = '', supplierCode = '' } = {}) {
  return {
    ProcurementCode: text(procurementCode),
    RFQCode: rfqCode && typeof rfqCode === 'object' ? rfqCode : text(rfqCode),
    SupplierCode: text(supplierCode),
    SentDate: '',
    Progress: SUPPLIER_ASSIGNED,
    Status: 'Active'
  }
}

// Generating an RFQ consumes its requisition and moves the procurement to RFQ_GENERATED.
export function buildRFQCreateChainNodes ({
  requisition = null,
  items = [],
  form = {},
  procurement = null,
  suppliers = []
} = {}) {
  const pr = asRow(requisition)
  if (!text(pr.Code)) {
    return [{ valid: false, message: 'Select an approved purchase requisition.' }]
  }
  const lines = (Array.isArray(items) ? items : []).map(asRow).filter((row) => text(row.Code))
  if (!lines.length) {
    return [{ valid: false, message: 'Select at least one requisition item.' }]
  }

  const procurementCode = text(asRow(procurement).Code) || text(pr.ProcurementCode)
  const nodes = [{ resource: RESOURCE_NAME, record: buildRFQRecord({
    requisition: pr,
    items: lines,
    form,
    procurementCode
  }) , permissions: { create: 'You are not allowed to create this rfq.' }, successMsg: 'RFQ generated.'}]

  const supplierCodes = Array.from(new Set((Array.isArray(suppliers) ? suppliers : []).map(text).filter(Boolean)))
  // One bulk: every supplier row shares the RFQSuppliers address, and a node is addressed
  // by resource, so separate create nodes would collapse onto each other.
  if (supplierCodes.length) {
    nodes.push({ resource: SUPPLIERS_RESOURCE, many: true, records: supplierCodes.map((supplierCode) => buildSupplierRecord({
      rfqCode: batchRef(RFQ_REF_PATH),
      procurementCode,
      supplierCode
    })) , permissions: { create: 'You are not allowed to create this rfqsupplier.' }})
  }

  const consumed = buildRequisitionRfqProcessedNode(pr.Code)
  if (consumed) nodes.push(consumed)

  const advance = buildProcurementProgressNode(procurement, RFQ_GENERATED)
  if (advance) {
    nodes.push(advance)
  }

  nodes.push({ resource: '$batch', reload: REFRESH_RESOURCES })

  return nodes
}

// Assign suppliers to an RFQ. A draft RFQ goes to SENT as soon as it has recipients.
export function buildAssignSuppliersChainNodes ({ rfq = null, supplierCodes = [], existingSupplierRows = [] } = {}) {
  const record = asRow(rfq)
  const code = text(record.Code)
  if (!code) {
    return [{ valid: false, message: 'No RFQ loaded.' }]
  }
  if (!canAssignSuppliers(record)) {
    return [{ valid: false, message: 'This RFQ is closed or cancelled.' }]
  }

  const already = new Set(supplierRowsOf(record, existingSupplierRows).map((row) => text(row.SupplierCode)))
  const selected = Array.from(new Set((Array.isArray(supplierCodes) ? supplierCodes : []).map(text).filter(Boolean)))
    .filter((supplierCode) => !already.has(supplierCode))

  if (!selected.length) {
    return [{ valid: false, message: 'Select at least one new supplier.' }]
  }

  const nodes = [{ resource: SUPPLIERS_RESOURCE, many: true, records: selected.map((supplierCode) => buildSupplierRecord({
    rfqCode: code,
    procurementCode: text(record.ProcurementCode),
    supplierCode
  })) , permissions: { create: 'You are not allowed to create this rfqsupplier.' }, successMsg: 'Suppliers assigned.'}]

  if (isDraft(record)) {
    nodes.push({ resource: RESOURCE_NAME, code: textOrRef(code), record: { Progress: SENT } , permissions: { update: 'You are not allowed to update this rfq.' }})
  }

  nodes.push({ resource: '$batch', reload: REFRESH_RESOURCES })

  return nodes
}

// Dispatch assigned supplier rows. The procurement moves on only once none are left.
export function buildMarkAsSentChainNodes ({ rfq = null, supplierRowCodes = [], supplierRows = [], procurement = null } = {}) {
  const record = asRow(rfq)
  if (!text(record.Code)) {
    return [{ valid: false, message: 'No RFQ loaded.' }]
  }
  if (!canMarkSuppliersSent(record)) {
    return [{ valid: false, message: 'This RFQ is not in a state where suppliers can be dispatched.' }]
  }

  const selected = new Set((Array.isArray(supplierRowCodes) ? supplierRowCodes : []).map(text).filter(Boolean))
  const active = supplierRowsOf(record, supplierRows)
  const rowsToSend = active.filter((row) =>
    selected.has(text(row.Code)) && text(row.Progress).toUpperCase() === SUPPLIER_ASSIGNED)

  if (!rowsToSend.length) {
    return [{ valid: false, message: 'Select at least one supplier that has not been sent yet.' }]
  }

  const today = toDateInputValue()
  // One bulk: every row shares the RFQSuppliers address.
  const nodes = [{ resource: SUPPLIERS_RESOURCE, many: true, records: rowsToSend.map((row) => ({
    Code: text(row.Code),
    Progress: SUPPLIER_SENT,
    SentDate: text(row.SentDate) || today
  })) , permissions: { update: 'You are not allowed to update this rfqsupplier.' }, successMsg: 'Suppliers marked as sent.'}]

  const sentCodes = new Set(rowsToSend.map((row) => text(row.Code)))
  const remaining = active.filter((row) =>
    !sentCodes.has(text(row.Code)) && text(row.Progress).toUpperCase() === SUPPLIER_ASSIGNED)

  if (!remaining.length) {
    const advance = buildProcurementProgressNode(procurement, RFQ_SENT_TO_SUPPLIERS)
    if (advance) {
      nodes.push(advance)
    }
  }

  nodes.push({ resource: '$batch', reload: REFRESH_RESOURCES })

  return nodes
}

// The RFQ supplier row moves ASSIGNED -> SENT -> RESPONDED. A quotation captured before
// manual dispatch performs the missing hop itself, which is why the caller gets both.
export function buildSupplierRespondedNodes ({ supplierRow = null, procurement = null } = {}) {
  const row = asRow(supplierRow)
  const code = text(row.Code)
  if (!code) return []

  const nodes = []
  const progress = text(row.Progress).toUpperCase()

  // One row, one write. The ASSIGNED -> SENT hop only records that dispatch happened, so
  // it is folded into the same record rather than sent as a second update of the same row.
  const supplierRecord = { Code: code }
  if (progress === SUPPLIER_ASSIGNED) {
    supplierRecord.SentDate = text(row.SentDate) || toDateInputValue()
    const advance = buildProcurementProgressNode(procurement, RFQ_SENT_TO_SUPPLIERS)
    if (advance) nodes.push(advance)
  }

  if (progress === SUPPLIER_ASSIGNED || progress === SUPPLIER_SENT) {
    supplierRecord.Progress = SUPPLIER_RESPONDED
    nodes.push({
      resource: SUPPLIERS_RESOURCE,
      many: true,
      records: [supplierRecord],
      permissions: { update: 'You are not allowed to update this rfq supplier.' }
    })
  }

  return nodes
}

export function buildSupplierCancelledNodes (rfqCode, supplierCode, supplierRows = []) {
  const rows = supplierRowsOf({ Code: rfqCode }, supplierRows)
    .filter((row) => text(row.SupplierCode) === text(supplierCode))
  if (!rows.length) return []
  return [{ resource: SUPPLIERS_RESOURCE, many: true, records: rows.map((row) => ({ Code: text(row.Code), Progress: SUPPLIER_CANCELLED })) }]
}

export function buildRFQCloseNode (rfq, actorName = '', comment = '') {
  const record = asRow(rfq)
  if (!text(record.Code) || !canClose(record)) return null
  return { resource: RESOURCE_NAME, actions: [{ ...CLOSE_ACTION, code: textOrRef(record.Code), data: {
    fields: stampFields('ProgressClosed', actorName, comment)
  } }] , permissions: { close: 'You are not allowed to close this rfq.' }}
}

export function buildRFQReopenNode (rfq) {
  const record = asRow(rfq)
  if (!text(record.Code) || text(record.Progress).toUpperCase() !== CLOSED) return null
  return { resource: RESOURCE_NAME, code: textOrRef(record.Code), record: {
    Progress: SENT,
    ProgressClosedComment: '',
    ProgressClosedAt: '',
    ProgressClosedBy: ''
  } }
}

export function buildRFQCloseChainNodes ({ rfq = null, actorName = '', comment = '' } = {}) {
  const request = buildRFQCloseNode(rfq, actorName, comment)
  if (!request) {
    return [{ valid: false, message: 'Only a sent RFQ can be closed.' }]
  }
  return [
    request,
    { resource: '$batch', reload: REFRESH_RESOURCES, successMsg: 'RFQ closed.' }
  ]
}

export function useRFQPayload () {
  return {
    buildRFQRecord,
    buildSupplierRecord,
    buildRFQCreateChainNodes,
    buildAssignSuppliersChainNodes,
    buildMarkAsSentChainNodes,
    buildSupplierRespondedNodes,
    buildSupplierCancelledNodes,
    buildRFQCloseNode,
    buildRFQReopenNode,
    buildRFQCloseChainNodes,
    allSuppliersDispatched,
    toDateInputValue,
    addDays
  }
}
