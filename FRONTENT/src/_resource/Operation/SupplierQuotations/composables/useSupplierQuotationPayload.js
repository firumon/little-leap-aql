import { textOrRef } from 'src/utils/appHelpers'
import { toDateTime24 } from 'src/utils/dateHelpers'
import { buildSupplierRespondedNodes } from 'src/_resource/Operation/RFQs/composables/useRFQPayload'
import { buildProcurementProgressNode } from 'src/_resource/Operation/Procurements/composables/useProcurementPayload'
import { QUOTATIONS_RECEIVED } from 'src/_resource/Operation/Procurements/composables/useProcurementProgress'
import {
  RECEIVED,
  ACCEPTED,
  REJECTED,
  DECLINED,
  QUOTED,
  responseTypeOf,
  canReject
} from './useSupplierQuotationProgress'
import {
  normalizeNumber,
  stringifyCharges,
  isQuotedItem,
  itemSubtotal,
  extraChargesTotal
} from './useSupplierQuotationTotals'

import { stampFields } from 'src/utils/workflowStamp'
const RESOURCE_NAME = 'SupplierQuotations'
const ITEMS_RESOURCE = 'SupplierQuotationItems'
const REFRESH_RESOURCES = ['SupplierQuotations', 'SupplierQuotationItems', 'RFQSuppliers', 'Procurements']

export const REJECT_ACTION = { action: 'Reject', column: 'Progress', columnValue: REJECTED }

export { RESOURCE_NAME, ITEMS_RESOURCE }

const text = (value) => String(value ?? '').trim()
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
  base.setDate(base.getDate() + normalizeNumber(days))
  return toDateInputValue(base)
}


function flagValue (value) { return value ? 'Yes' : 'No' }
function trueFalseValue (value) { return value ? 'TRUE' : 'FALSE' }

export function normalizeFlag (value) {
  if (typeof value === 'boolean') return value
  return ['yes', 'true', '1'].includes(text(value).toLowerCase())
}

// A requisition line may carry its estimate under several names; take the first real one.
export function resolveSourceUnitPrice (sourceItem = {}) {
  const row = asRow(sourceItem)
  const candidates = [row.UnitPrice, row.EstimatedUnitPrice, row.EstimatedRate, row.LastPurchasePrice, row.TargetUnitPrice, row.Price, row.Cost, row.Rate]
  for (const value of candidates) {
    const parsed = normalizeNumber(value)
    if (parsed > 0) return parsed
  }
  return 0
}

export function buildQuotationHeaderRecord (form = {}, extras = {}) {
  const input = asRow(form)
  const responseType = text(input.ResponseType).toUpperCase()
  return {
    ProcurementCode: text(input.ProcurementCode),
    RFQCode: text(input.RFQCode),
    SupplierCode: text(input.SupplierCode),
    ResponseType: responseType,
    ResponseDate: text(input.ResponseDate) || toDateInputValue(),
    DeclineReason: responseType === DECLINED ? text(input.DeclineReason) : '',
    SupplierQuotationReference: text(input.SupplierQuotationReference),
    LeadTimeDays: normalizeNumber(input.LeadTimeDays),
    LeadTimeType: text(input.LeadTimeType),
    DeliveryMode: text(input.DeliveryMode),
    AllowPartialPO: trueFalseValue(normalizeFlag(input.AllowPartialPO)),
    AllowPartialDelivery: flagValue(normalizeFlag(input.AllowPartialDelivery)),
    AllowSplitShipment: flagValue(normalizeFlag(input.AllowSplitShipment)),
    ShippingTerm: text(input.ShippingTerm),
    PaymentTerm: text(input.PaymentTerm),
    PaymentTermDetail: text(input.PaymentTermDetail),
    QuotationValidityDays: normalizeNumber(input.QuotationValidityDays),
    ValidUntilDate: text(input.ValidUntilDate),
    Currency: text(input.Currency),
    TotalAmount: normalizeNumber(input.TotalAmount),
    ExtraChargesBreakup: stringifyCharges(input.ExtraChargesBreakup),
    Remarks: text(input.Remarks),
    Progress: text(input.Progress).toUpperCase() || RECEIVED,
    Status: text(input.Status) || 'Active',
    ...extras
  }
}

export function buildQuotationItemRecord (item = {}) {
  const row = asRow(item)
  const quantity = normalizeNumber(row.Quantity)
  const unitPrice = normalizeNumber(row.UnitPrice)
  return {
    PurchaseRequisitionItemCode: text(row.PurchaseRequisitionItemCode),
    SKU: text(row.SKU),
    Description: text(row.Description),
    Quantity: quantity,
    UnitPrice: unitPrice,
    TotalPrice: quantity * unitPrice,
    LeadTimeDays: row.LeadTimeDays === '' || row.LeadTimeDays == null ? '' : normalizeNumber(row.LeadTimeDays),
    DeliveryDate: text(row.DeliveryDate),
    Remarks: text(row.Remarks),
    Status: text(row.Status) || 'Active'
  }
}

export function validateQuotation ({ form = {}, items = [], rfqItemCount = 0 } = {}) {
  const input = asRow(form)
  const errors = []
  if (!text(input.RFQCode)) errors.push('Select an RFQ.')
  if (!text(input.SupplierCode)) errors.push('Select a supplier.')
  if (!text(input.ResponseType)) errors.push('Select a response type.')
  if (responseTypeOf(input) === DECLINED && !text(input.DeclineReason)) {
    errors.push('A decline reason is required.')
  }

  const quotedItems = (Array.isArray(items) ? items : []).map(asRow).filter(isQuotedItem)
  if (responseTypeOf(input) === QUOTED && quotedItems.length < normalizeNumber(rfqItemCount)) {
    errors.push('A full quotation needs quote data for every RFQ item.')
  }
  for (const row of quotedItems) {
    if (normalizeNumber(row.Quantity) < 0 || normalizeNumber(row.UnitPrice) < 0) {
      errors.push(`Item ${text(row.SKU) || text(row.PurchaseRequisitionItemCode)} has a negative value.`)
    }
  }
  for (const [key, value] of Object.entries(asRow(input.ExtraChargesBreakup))) {
    if (normalizeNumber(value) < 0) errors.push(`The ${key} charge cannot be negative.`)
  }

  return { valid: errors.length === 0, errors, quotedItems }
}

// Capture a supplier's response. The first save also walks the RFQ supplier row to
// RESPONDED and moves the procurement to QUOTATIONS_RECEIVED.
export function buildQuotationCaptureChainNodes ({
  form = {},
  items = [],
  rfqItemCount = 0,
  supplierRow = null,
  procurement = null,
  actorName = ''
} = {}) {
  const validation = validateQuotation({ form, items, rfqItemCount })
  if (!validation.valid) {
    return [{ valid: false, message: validation.errors[0] }]
  }

  const input = asRow(form)
  const declined = responseTypeOf(input) === DECLINED
  const lines = declined ? [] : validation.quotedItems
  const total = declined ? 0 : itemSubtotal(lines) + extraChargesTotal(input.ExtraChargesBreakup)

  const header = buildQuotationHeaderRecord({ ...input, TotalAmount: total }, {
    ResponseRecordedAt: toDateTime24(new Date()),
    ResponseRecordedBy: text(actorName)
  })

  const nodes = [{
    resource: RESOURCE_NAME,
    data: header,
    children: lines.length
      ? [{ resource: ITEMS_RESOURCE, records: lines.map((row) => ({ _action: 'create', data: buildQuotationItemRecord(row) })) , permissions: { create: 'You are not allowed to create this supplier quotation item.' }, successMsg: 'Supplier quotation saved.'}]
      : []
  , successMsg: 'Supplier quotation updated.'}]

  const responded = buildSupplierRespondedNodes({ supplierRow, procurement })
  nodes.push(...responded)

  const advance = buildProcurementProgressNode(procurement, QUOTATIONS_RECEIVED)
  if (advance) {
    nodes.push(advance)
  }

  nodes.push({ resource: '$batch', reload: REFRESH_RESOURCES })

  return nodes
}

// A later edit re-states the quotation only. It never repeats the workflow hops the
// first save already performed.
export function buildQuotationUpdateChainNodes ({ quotation = null, form = {}, items = [], rfqItemCount = 0 } = {}) {
  const record = asRow(quotation)
  const code = text(record.Code)
  if (!code) {
    return [{ valid: false, message: 'No quotation loaded.' }]
  }

  const validation = validateQuotation({ form, items, rfqItemCount })
  if (!validation.valid) {
    return [{ valid: false, message: validation.errors[0] }]
  }

  const input = asRow(form)
  const declined = responseTypeOf(input) === DECLINED
  const lines = declined ? [] : validation.quotedItems
  const total = declined ? 0 : itemSubtotal(lines) + extraChargesTotal(input.ExtraChargesBreakup)

  const nodes = [{
    resource: RESOURCE_NAME,
    code,
    data: buildQuotationHeaderRecord({ ...input, TotalAmount: total }),
    children: lines.length
      ? [{
          resource: ITEMS_RESOURCE,
          records: lines.map((row) => ({
            _action: text(row.Code) ? 'update' : 'create',
            ...(text(row.Code) ? { _originalCode: text(row.Code) } : {}),
            data: buildQuotationItemRecord(row)
          }))
        , permissions: { update: 'You are not allowed to update this supplier quotation item.' }}]
      : []
  , permissions: { update: 'You are not allowed to update this supplier quotation.' }}, { resource: '$batch', reload: REFRESH_RESOURCES }]

  return nodes
}

// The view page allows only these two terms to change after capture.
export function buildQuotationTermsUpdateRequest (quotation, { allowPartialPO, supplierQuotationReference } = {}) {
  const code = text(asRow(quotation).Code)
  if (!code) return null
  const data = {}
  if (allowPartialPO !== undefined) data.AllowPartialPO = trueFalseValue(normalizeFlag(allowPartialPO))
  if (supplierQuotationReference !== undefined) data.SupplierQuotationReference = text(supplierQuotationReference)
  if (!Object.keys(data).length) return null
  return { resource: RESOURCE_NAME, code: textOrRef(code), record: data , permissions: { reject: 'You are not allowed to reject this supplier quotation.' }}
}

export function buildQuotationRejectChainNodes ({ quotation = null, comment = '', actorName = '' } = {}) {
  const record = asRow(quotation)
  const code = text(record.Code)
  if (!code) {
    return [{ valid: false, message: 'No quotation loaded.' }]
  }
  if (!canReject(record)) {
    return [{ valid: false, message: 'Only a received quotation can be rejected.' }]
  }
  if (!text(comment)) {
    return [{ valid: false, message: 'A rejection comment is required.' }]
  }

  return [
    { resource: RESOURCE_NAME, actions: [{ ...REJECT_ACTION, code: textOrRef(code), data: { fields: stampFields('ProgressRejected', actorName, comment) } }], successMsg: 'Quotation rejected.' },
    { resource: '$batch', reload: REFRESH_RESOURCES }
  ]
}

// Creating a purchase order accepts the quotation it came from.
export function buildQuotationAcceptNode (quotation) {
  const record = asRow(quotation)
  const code = text(record.Code)
  if (!code || text(record.Progress).toUpperCase() === ACCEPTED) return null
  return { resource: RESOURCE_NAME, code: textOrRef(code), record: { Progress: ACCEPTED } }
}

export function useSupplierQuotationPayload () {
  return {
    buildQuotationHeaderRecord,
    buildQuotationItemRecord,
    validateQuotation,
    buildQuotationCaptureChainNodes,
    buildQuotationUpdateChainNodes,
    buildQuotationTermsUpdateRequest,
    buildQuotationRejectChainNodes,
    buildQuotationAcceptNode,
    resolveSourceUnitPrice,
    normalizeFlag,
    toDateInputValue,
    addDays
  }
}
