import {
  EXTRA_CHARGE_KEYS,
  consumesQuotationQuantity,
  LINE_PENDING,
  LINE_PARTIAL,
  LINE_FULFILLED,
  LINE_EXCESS
} from './usePurchaseOrderProgress'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function normalizeNumber (value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function blankCharges () {
  return Object.fromEntries(EXTRA_CHARGE_KEYS.map((key) => [key, 0]))
}

export function parseCharges (value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...blankCharges(), ...value }
  }
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object') return { ...blankCharges(), ...parsed }
  } catch {
    // A blank or malformed cell means no charges were recorded.
  }
  return blankCharges()
}

export function stringifyCharges (charges = {}) {
  return JSON.stringify(Object.fromEntries(EXTRA_CHARGE_KEYS.map((key) => [key, normalizeNumber(charges[key])])))
}

export function chargeBreakdown (value) {
  const charges = parseCharges(value)
  return EXTRA_CHARGE_KEYS
    .map((key) => ({ key, amount: normalizeNumber(charges[key]) }))
    .filter((entry) => entry.amount !== 0)
}

export function extraChargesTotal (value) {
  const charges = parseCharges(value)
  return EXTRA_CHARGE_KEYS.reduce((sum, key) => sum + normalizeNumber(charges[key]), 0)
}

export function lineTotal (item = {}) {
  const row = asRow(item)
  return normalizeNumber(row.OrderedQuantity) * normalizeNumber(row.UnitPrice)
}

export function itemSubtotal (items = [], { selectedOnly = false } = {}) {
  return (Array.isArray(items) ? items : [])
    .map(asRow)
    .filter((row) => !selectedOnly || row.Selected)
    .reduce((sum, row) => sum + lineTotal(row), 0)
}

export function purchaseOrderTotals (purchaseOrder = {}, items = [], { selectedOnly = false } = {}) {
  const subtotal = itemSubtotal(items, { selectedOnly })
  const charges = extraChargesTotal(asRow(purchaseOrder).ExtraChargesBreakup)
  return {
    subtotal,
    charges,
    total: subtotal + charges,
    breakdown: chargeBreakdown(asRow(purchaseOrder).ExtraChargesBreakup),
    lineCount: (Array.isArray(items) ? items : []).filter((row) => !selectedOnly || asRow(row).Selected).length
  }
}

// How much of each quoted line is still unordered. Cancelled POs give their share back.
export function orderedQtyByQuotationItem (purchaseOrders = [], purchaseOrderItems = [], quotationCode = '') {
  const code = text(quotationCode)
  const liveCodes = new Set(
    (Array.isArray(purchaseOrders) ? purchaseOrders : [])
      .map(asRow)
      .filter((row) => (!code || text(row.SupplierQuotationCode) === code) && consumesQuotationQuantity(row))
      .map((row) => text(row.Code))
      .filter(Boolean)
  )

  const totals = new Map()
  for (const entry of (Array.isArray(purchaseOrderItems) ? purchaseOrderItems : []).map(asRow)) {
    if (!liveCodes.has(text(entry.PurchaseOrderCode))) continue
    const key = text(entry.SupplierQuotationItemCode)
    if (!key) continue
    totals.set(key, (totals.get(key) || 0) + normalizeNumber(entry.OrderedQuantity))
  }
  return totals
}

export function remainingQtyOf (quotationItem = {}, orderedIndex = new Map()) {
  const row = asRow(quotationItem)
  const quoted = normalizeNumber(row.Quantity)
  const ordered = orderedIndex.get(text(row.Code)) || 0
  return Math.max(0, quoted - ordered)
}

export function hasLivePurchaseOrder (purchaseOrders = [], quotationCode = '') {
  const code = text(quotationCode)
  if (!code) return false
  return (Array.isArray(purchaseOrders) ? purchaseOrders : [])
    .map(asRow)
    .some((row) => text(row.SupplierQuotationCode) === code && consumesQuotationQuantity(row))
}

// Whether ordering these lines covers every RFQ quantity, which is what makes closing
// the source RFQ a sensible offer.
export function coversAllRemaining (quotationItems = [], selectedItems = [], orderedIndex = new Map()) {
  const selectedByCode = new Map(
    (Array.isArray(selectedItems) ? selectedItems : [])
      .map(asRow)
      .map((row) => [text(row.SupplierQuotationItemCode), normalizeNumber(row.OrderedQuantity)])
  )
  const rows = (Array.isArray(quotationItems) ? quotationItems : []).map(asRow)
  if (!rows.length) return false
  return rows.every((row) => {
    const remaining = remainingQtyOf(row, orderedIndex)
    return remaining <= (selectedByCode.get(text(row.Code)) || 0)
  })
}

// A PO line's own fulfilment state, from what receiving has accepted against it.
export function lineFulfilmentState (item = {}, receivedQty = 0) {
  const ordered = normalizeNumber(asRow(item).OrderedQuantity)
  const received = normalizeNumber(receivedQty)
  if (received <= 0) return LINE_PENDING
  if (received > ordered) return LINE_EXCESS
  if (received < ordered) return LINE_PARTIAL
  return LINE_FULFILLED
}

export function receivedQtyByPurchaseOrderItem (receivingItems = [], acceptedOf = null) {
  const totals = new Map()
  for (const entry of (Array.isArray(receivingItems) ? receivingItems : []).map(asRow)) {
    const key = text(entry.PurchaseOrderItemCode)
    if (!key) continue
    const qty = typeof acceptedOf === 'function' ? normalizeNumber(acceptedOf(entry)) : normalizeNumber(entry.ReceivedQty)
    totals.set(key, (totals.get(key) || 0) + qty)
  }
  return totals
}

export function usePurchaseOrderTotals () {
  return {
    normalizeNumber,
    blankCharges,
    parseCharges,
    stringifyCharges,
    chargeBreakdown,
    extraChargesTotal,
    lineTotal,
    itemSubtotal,
    purchaseOrderTotals,
    orderedQtyByQuotationItem,
    remainingQtyOf,
    hasLivePurchaseOrder,
    coversAllRemaining,
    lineFulfilmentState,
    receivedQtyByPurchaseOrderItem
  }
}
