import { EXTRA_CHARGE_KEYS } from './supplierQuotationMeta'

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

export function normalizeNumber(value) {
  if (value === '' || value == null) return 0
  const next = Number(value)
  return Number.isFinite(next) ? next : 0
}

export function resolveSourceUnitPrice(sourceItem = {}) {
  if (!sourceItem || typeof sourceItem !== 'object') return 0
  const candidates = [
    sourceItem.UnitPrice,
    sourceItem.EstimatedUnitPrice,
    sourceItem.EstimatedRate,
    sourceItem.LastPurchasePrice,
    sourceItem.TargetUnitPrice,
    sourceItem.Price,
    sourceItem.Cost,
    sourceItem.Rate
  ]
  for (const val of candidates) {
    const num = normalizeNumber(val)
    if (num > 0) return num
  }
  return 0
}

export function normalizeFlag(value) {
  if (typeof value === 'boolean') return value
  return ['yes', 'true', '1'].includes((value || '').toString().trim().toLowerCase())
}

export function flagValue(value) {
  return value ? 'Yes' : 'No'
}

export function blankCharges() {
  return Object.fromEntries(EXTRA_CHARGE_KEYS.map((key) => [key, 0]))
}

export function parseCharges(value) {
  if (!value) return blankCharges()
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return Object.fromEntries(EXTRA_CHARGE_KEYS.map((key) => [key, normalizeNumber(parsed?.[key])]))
  } catch {
    return blankCharges()
  }
}

export function stringifyCharges(charges = {}) {
  return JSON.stringify(Object.fromEntries(EXTRA_CHARGE_KEYS.map((key) => [key, normalizeNumber(charges[key])])))
}

export function defaultHeaderForm(seed = {}) {
  const responseDate = seed.ResponseDate || toDateInputValue()
  return {
    Code: seed.Code || '',
    ProcurementCode: seed.ProcurementCode || '',
    RFQCode: seed.RFQCode || '',
    SupplierCode: seed.SupplierCode || '',
    ResponseType: seed.ResponseType || 'QUOTED',
    ResponseDate: responseDate,
    DeclineReason: seed.DeclineReason || '',
    LeadTimeDays: normalizeNumber(seed.LeadTimeDays),
    LeadTimeType: seed.LeadTimeType || 'FLEXIBLE',
    DeliveryMode: seed.DeliveryMode || 'ANY',
    AllowPartialDelivery: normalizeFlag(seed.AllowPartialDelivery),
    AllowSplitShipment: normalizeFlag(seed.AllowSplitShipment),
    ShippingTerm: seed.ShippingTerm || '',
    PaymentTerm: seed.PaymentTerm || '',
    PaymentTermDetail: seed.PaymentTermDetail || '',
    QuotationValidityDays: normalizeNumber(seed.QuotationValidityDays || 7),
    ValidUntilDate: seed.ValidUntilDate || addDays(responseDate, normalizeNumber(seed.QuotationValidityDays || 7)),
    Currency: seed.Currency || 'AED',
    TotalAmount: normalizeNumber(seed.TotalAmount),
    ExtraChargesBreakup: parseCharges(seed.ExtraChargesBreakup),
    Remarks: seed.Remarks || '',
    Progress: seed.Progress || 'RECEIVED',
    ProgressRejectedComment: seed.ProgressRejectedComment || '',
    ResponseRecordedAt: seed.ResponseRecordedAt || '',
    ResponseRecordedBy: seed.ResponseRecordedBy || '',
    Status: seed.Status || 'Active'
  }
}

export function defaultItemForm(context = {}, seed = {}) {
  const hasSavedQty = seed.Quantity !== '' && seed.Quantity != null
  const hasSavedPrice = seed.UnitPrice !== '' && seed.UnitPrice != null

  const quantity = hasSavedQty ? normalizeNumber(seed.Quantity) : normalizeNumber(context.Quantity)
  const unitPrice = hasSavedPrice ? normalizeNumber(seed.UnitPrice) : resolveSourceUnitPrice(context)

  const totalPrice = seed.TotalPrice !== '' && seed.TotalPrice != null
    ? normalizeNumber(seed.TotalPrice)
    : quantity * unitPrice

  return {
    Code: seed.Code || '',
    SupplierQuotationCode: seed.SupplierQuotationCode || '',
    PurchaseRequisitionItemCode: seed.PurchaseRequisitionItemCode || context.Code || '',
    SKU: seed.SKU || context.SKU || '',
    Description: seed.Description || context.Description || context.Name || '',
    RequestedQuantity: context.Quantity || '',
    UOM: context.UOM || '',
    Quantity: quantity,
    UnitPrice: unitPrice,
    TotalPrice: totalPrice,
    LeadTimeDays: seed.LeadTimeDays === '' || seed.LeadTimeDays == null ? '' : normalizeNumber(seed.LeadTimeDays),
    DeliveryDate: seed.DeliveryDate || '',
    Remarks: seed.Remarks || '',
    Status: seed.Status || 'Active'
  }
}

export function isQuotedItem(item = {}) {
  return normalizeNumber(item.Quantity) > 0 || normalizeNumber(item.UnitPrice) > 0
}

export function buildHeaderRecord(form = {}, extras = {}) {
  return {
    ProcurementCode: form.ProcurementCode || '',
    RFQCode: form.RFQCode || '',
    SupplierCode: form.SupplierCode || '',
    ResponseType: form.ResponseType || '',
    ResponseDate: form.ResponseDate || toDateInputValue(),
    DeclineReason: form.ResponseType === 'DECLINED' ? (form.DeclineReason || '') : '',
    LeadTimeDays: normalizeNumber(form.LeadTimeDays),
    LeadTimeType: form.LeadTimeType || '',
    DeliveryMode: form.DeliveryMode || '',
    AllowPartialDelivery: flagValue(form.AllowPartialDelivery),
    AllowSplitShipment: flagValue(form.AllowSplitShipment),
    ShippingTerm: form.ShippingTerm || '',
    PaymentTerm: form.PaymentTerm || '',
    PaymentTermDetail: form.PaymentTermDetail || '',
    QuotationValidityDays: normalizeNumber(form.QuotationValidityDays),
    ValidUntilDate: form.ValidUntilDate || '',
    Currency: form.Currency || 'AED',
    TotalAmount: normalizeNumber(form.TotalAmount),
    ExtraChargesBreakup: stringifyCharges(form.ExtraChargesBreakup),
    Remarks: form.Remarks || '',
    Progress: form.Progress || 'RECEIVED',
    Status: form.Status || 'Active',
    ...extras
  }
}

export function buildItemRecord(item = {}) {
  const quantity = normalizeNumber(item.Quantity)
  const unitPrice = normalizeNumber(item.UnitPrice)
  return {
    PurchaseRequisitionItemCode: item.PurchaseRequisitionItemCode || '',
    SKU: item.SKU || '',
    Description: item.Description || '',
    Quantity: quantity,
    UnitPrice: unitPrice,
    TotalPrice: quantity * unitPrice,
    LeadTimeDays: item.LeadTimeDays === '' || item.LeadTimeDays == null ? '' : normalizeNumber(item.LeadTimeDays),
    DeliveryDate: item.DeliveryDate || '',
    Remarks: item.Remarks || '',
    Status: item.Status || 'Active'
  }
}

export function validateQuotation({ form, items = [], rfqItemCount = 0 }) {
  const errors = []
  if (!form.RFQCode) errors.push('Select an RFQ.')
  if (!form.SupplierCode) errors.push('Select a supplier.')
  if (!form.ResponseType) errors.push('Select a response type.')
  if (form.ResponseType === 'DECLINED' && !String(form.DeclineReason || '').trim()) {
    errors.push('Decline reason is required.')
  }

  const quotedItems = items.filter(isQuotedItem)
  if (form.ResponseType === 'QUOTED' && quotedItems.length < rfqItemCount) {
    errors.push('Full quotations require quote data for every RFQ item.')
  }
  quotedItems.forEach((item) => {
    if (normalizeNumber(item.Quantity) < 0 || normalizeNumber(item.UnitPrice) < 0 || normalizeNumber(item.TotalPrice) < 0) {
      errors.push(`Item ${item.PurchaseRequisitionItemCode || item.SKU || ''} has a negative numeric value.`)
    }
  })
  Object.entries(form.ExtraChargesBreakup || {}).forEach(([key, value]) => {
    if (normalizeNumber(value) < 0) errors.push(`${key} charge cannot be negative.`)
  })

  return { success: errors.length === 0, errors, quotedItems }
}
