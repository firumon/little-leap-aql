function pad(value) {
  return value.toString().padStart(2, '0')
}

export function toDateInputValue(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(value.getTime())) return ''
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

export function addDays(dateValue, days = 0) {
  const base = dateValue ? new Date(dateValue) : new Date()
  if (Number.isNaN(base.getTime())) return ''
  base.setDate(base.getDate() + Number(days || 0))
  return toDateInputValue(base)
}

export function daysUntil(dateValue, fromDate = new Date()) {
  if (!dateValue) return 0
  const target = new Date(dateValue)
  if (Number.isNaN(target.getTime())) return 0
  const start = new Date(fromDate)
  start.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.max(0, Math.ceil((target.getTime() - start.getTime()) / 86400000))
}

export function buildPrItemCodeCsv(items = []) {
  return (items || [])
    .map((item) => (item?.Code || '').toString().trim())
    .filter(Boolean)
    .join(',')
}

export function parsePrItemCodeCsv(value = '') {
  return (value || '')
    .toString()
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function buildRFQRecord({ pr = {}, items = [], form = {}, procurementCode = '' } = {}) {
  return {
    ProcurementCode: procurementCode || pr.ProcurementCode || '',
    PurchaseRequisitionCode: pr.Code || '',
    PurchaseRequisitionItemsCode: buildPrItemCodeCsv(items),
    RFQDate: form.RFQDate || toDateInputValue(),
    LeadTimeDays: Number(form.LeadTimeDays) || 0,
    LeadTimeType: form.LeadTimeType || 'FLEXIBLE',
    ShippingTermMode: form.ShippingTermMode || 'ANY',
    ShippingTerm: form.ShippingTermMode === 'ANY' ? '' : (form.ShippingTerm || ''),
    PaymentTermMode: form.PaymentTermMode || 'ANY',
    PaymentTerm: form.PaymentTermMode === 'ANY' ? '' : (form.PaymentTerm || ''),
    PaymentTermDetail: form.PaymentTermDetail || '',
    QuotationValidityDays: Number(form.QuotationValidityDays) || 0,
    QuotationValidityMode: form.QuotationValidityMode || 'MIN_REQUIRED',
    DeliveryMode: form.DeliveryMode || 'ANY',
    AllowPartialDelivery: form.AllowPartialDelivery ? 'Yes' : 'No',
    AllowSplitShipment: form.AllowSplitShipment ? 'Yes' : 'No',
    SubmissionDeadline: form.SubmissionDeadline || addDays(form.RFQDate || new Date(), 7),
    Progress: 'DRAFT',
    Status: 'Active'
  }
}

