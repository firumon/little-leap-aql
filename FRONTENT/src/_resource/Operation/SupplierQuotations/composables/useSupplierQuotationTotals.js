import { EXTRA_CHARGE_KEYS, DECLINED, responseTypeOf } from './useSupplierQuotationProgress'

const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function normalizeNumber (value) {
  if (value === '' || value == null) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function blankCharges () {
  return Object.fromEntries(EXTRA_CHARGE_KEYS.map((key) => [key, 0]))
}

export function parseCharges (value) {
  if (!value) return blankCharges()
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return Object.fromEntries(EXTRA_CHARGE_KEYS.map((key) => [key, normalizeNumber(parsed?.[key])]))
  } catch {
    return blankCharges()
  }
}

export function stringifyCharges (charges = {}) {
  return JSON.stringify(Object.fromEntries(EXTRA_CHARGE_KEYS.map((key) => [key, normalizeNumber(charges[key])])))
}

export function chargeBreakdown (value) {
  const charges = parseCharges(value)
  return EXTRA_CHARGE_KEYS
    .map((key) => ({ key, amount: charges[key] }))
    .filter((entry) => entry.amount !== 0)
}

export function extraChargesTotal (value) {
  const charges = parseCharges(value)
  return EXTRA_CHARGE_KEYS.reduce((sum, key) => sum + normalizeNumber(charges[key]), 0)
}

// A line counts as quoted once it carries a quantity or a price.
export function isQuotedItem (item = {}) {
  const row = asRow(item)
  return normalizeNumber(row.Quantity) > 0 || normalizeNumber(row.UnitPrice) > 0
}

export function lineTotal (item = {}) {
  const row = asRow(item)
  return normalizeNumber(row.Quantity) * normalizeNumber(row.UnitPrice)
}

export function itemSubtotal (items = []) {
  return (Array.isArray(items) ? items : [])
    .map(asRow)
    .filter(isQuotedItem)
    .reduce((sum, row) => sum + (normalizeNumber(row.TotalPrice) || lineTotal(row)), 0)
}

// A declined response carries no value however many lines were typed before declining.
export function quotationTotal (quotation = {}, items = []) {
  const row = asRow(quotation)
  if (responseTypeOf(row) === DECLINED) return 0
  return itemSubtotal(items) + extraChargesTotal(row.ExtraChargesBreakup)
}

export function quotationTotals (quotation = {}, items = []) {
  const subtotal = responseTypeOf(asRow(quotation)) === DECLINED ? 0 : itemSubtotal(items)
  const charges = responseTypeOf(asRow(quotation)) === DECLINED ? 0 : extraChargesTotal(asRow(quotation).ExtraChargesBreakup)
  return {
    subtotal,
    charges,
    total: subtotal + charges,
    breakdown: chargeBreakdown(asRow(quotation).ExtraChargesBreakup),
    quotedLines: (Array.isArray(items) ? items : []).map(asRow).filter(isQuotedItem).length
  }
}

export function useSupplierQuotationTotals () {
  return {
    normalizeNumber,
    blankCharges,
    parseCharges,
    stringifyCharges,
    chargeBreakdown,
    extraChargesTotal,
    isQuotedItem,
    lineTotal,
    itemSubtotal,
    quotationTotal,
    quotationTotals
  }
}
