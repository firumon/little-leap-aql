import { todayISO, text, OUTLET_REFERENCE_TYPES } from './outletOperationsMeta.js'
import { toNumber } from './outletStockLogic.js'
import { compositeSaveRequest, executeActionRequest, OUTLET_ACTIONS, resourceBulkRequest, resourceCreateRequest, textOrRef } from './outletOperationsBatch.js'

export function soldRows(rows = []) {
  return rows.filter((row) => toNumber(row.SoldQty) > 0).map((row) => ({ SKU: text(row.SKU), Qty: toNumber(row.SoldQty) }))
}

export function restockRows(rows = []) {
  return rows.filter((row) => toNumber(row.Quantity) > 0).map((row) => ({ SKU: text(row.SKU), Quantity: toNumber(row.Quantity) }))
}

export function buildConsumptionCompositePayload(form = {}, countRows = [], checklist = {}) {
  const sold = soldRows(countRows)
  return {
    resource: 'OutletConsumptions',
    code: form.Code,
    data: {
      OutletCode: text(form.OutletCode),
      Date: text(form.Date) || todayISO(),
      Username: text(form.Username),
      OutletVisitCode: text(form.OutletVisitCode),
      Progress: 'PENDING_INVOICE_GENERATION',
      ProgressPendingInvoiceGenerationComment: checklist.generateInvoice ? 'Consumption saved before invoice generation.' : 'Consumption saved without invoice generation.',
      Status: 'Active',
      AccessRegion: text(form.AccessRegion)
    },
    children: [{
      resource: 'OutletConsumptionItems',
      records: sold.map((row) => ({ _action: 'create', data: { SKU: row.SKU, Qty: row.Qty, Status: 'Active' } }))
    }]
  }
}

export function buildConsumptionMovementRequest(consumptionCode, outletCode, rows = [], form = {}) {
  return resourceBulkRequest('OutletMovements', soldRows(rows).map((row) => ({
    OutletCode: text(outletCode),
    SKU: row.SKU,
    QtyChange: -Math.abs(toNumber(row.Qty)),
    ReferenceType: OUTLET_REFERENCE_TYPES.consumption,
    ReferenceCode: textOrRef(consumptionCode),
    MovementDate: text(form.Date) || todayISO(),
    Status: 'Active',
    AccessRegion: text(form.AccessRegion)
  })), ['OutletStorages'])
}

export function buildConsumptionInvoiceRequest(consumptionCode, form = {}, { priceListCode = '', subtotal = 0 } = {}) {
  return resourceCreateRequest('OutletConsumptionInvoices', {
    OutletConsumptionCode: textOrRef(consumptionCode),
    Date: text(form.Date) || todayISO(),
    OutletCode: text(form.OutletCode),
    Username: text(form.Username),
    PriceListCode: text(priceListCode),
    Subtotal: toNumber(subtotal),
    Discount: 0,
    Tax: 0,
    Progress: 'PENDING_PAYMENT',
    ProgressPendingPaymentComment: text(form.InvoiceComment) || 'Invoice generated from outlet consumption.',
    Status: 'Active',
    AccessRegion: text(form.AccessRegion)
  })
}

export function buildConsumptionInvoiceItemsRequest(invoiceCodeOrRef, items = []) {
  return resourceBulkRequest('OutletConsumptionInvoiceItems', items.map((row) => ({
    OutletConsumptionInvoiceCode: textOrRef(invoiceCodeOrRef),
    SKU: text(row.SKU),
    Qty: toNumber(row.Qty),
    Price: toNumber(row.Price),
    Status: 'Active'
  })))
}

export function buildInvoiceGeneratedRequest(consumptionCode, comment = 'Invoice generated from pending outlet consumption.') {
  return executeActionRequest('OutletConsumptions', consumptionCode, OUTLET_ACTIONS.invoiceGenerated, {
    ProgressInvoiceGeneratedComment: text(comment)
  })
}

export function buildVisitCompleteRequest(form = {}) {
  return executeActionRequest('OutletVisits', form.OutletVisitCode, OUTLET_ACTIONS.completeVisit, { ProgressCompletedComment: 'Completed from outlet consumption submit.' })
}

export function formatCommentDate(value) {
  const date = new Date(text(value) || todayISO())
  if (Number.isNaN(date.getTime())) return text(value)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function buildNextVisitRequest(form = {}, frequencyDays = 14, consumptionCode = '') {
  const base = new Date(text(form.Date) || todayISO())
  base.setDate(base.getDate() + Math.max(1, toNumber(frequencyDays) || 14))
  const nextDate = base.toISOString().slice(0, 10)
  const comment = `Auto planned after outlet consumption by ${text(form.Username) || 'Unknown User'} on ${formatCommentDate(form.Date)}`
  return resourceCreateRequest('OutletVisits', { OutletCode: text(form.OutletCode), Date: nextDate, Progress: 'PLANNED', ProgressPlannedComment: comment, Status: 'Active' })
}

export function buildRestockCompositeRequest(form = {}, rows = []) {
  const cleaned = restockRows(rows)
  const payload = {
    resource: 'OutletRestocks',
    data: {
      Date: text(form.Date) || todayISO(),
      OutletCode: text(form.OutletCode),
      RequestedUser: text(form.Username),
      Progress: 'DRAFT',
      Status: 'Active',
      AccessRegion: text(form.AccessRegion)
    },
    children: [{ resource: 'OutletRestockItems', records: cleaned.map((row) => ({ _action: 'create', data: { SKU: row.SKU, Quantity: row.Quantity, WarehouseCode: '', StorageName: '', Progress: 'PENDING', Status: 'Active' } })) }]
  }
  return compositeSaveRequest(payload)
}

export function buildRestockSubmitRequest(restockCode) {
  return executeActionRequest('OutletRestocks', restockCode, OUTLET_ACTIONS.submitRestock, { Comment: 'Submitted from outlet consumption submit.' })
}
