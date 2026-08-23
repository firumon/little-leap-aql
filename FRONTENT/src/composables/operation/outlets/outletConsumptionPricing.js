import { active, text } from './outletOperationsMeta.js'
import { toNumber } from './outletStockLogic.js'
import { grandTotalOf, balanceDueOf } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'

export function resolvePriceListCode(outletCode, rules = [], priceLists = []) {
  const rule = rules.find((row) => active(row) && text(row.OutletCode) === text(outletCode))
  if (rule && text(rule.PriceListCode)) {
    const ruleList = priceLists.find((row) => active(row) && text(row.Code) === text(rule.PriceListCode))
    if (ruleList) return text(ruleList.Code)
  }
  const defaultList = priceLists.find((row) => active(row) && text(row.IsDefault) === 'TRUE')
  if (defaultList) return text(defaultList.Code)
  return ''
}

export function resolvePriceListLookup(appConfigMap = {}) {
  const val = text(appConfigMap?.PriceListLookup || '')
  if (val === 'ITEMS') return 'ITEMS'
  return 'INLINE'
}

export function resolveSkuPrice(sku, priceList, priceListLookup, priceListItems = []) {
  if (priceListLookup === 'ITEMS') {
    const item = priceListItems.find((row) => active(row) && text(row.PriceListCode) === text(priceList.Code) && text(row.SKUCode) === text(sku))
    if (item) return toNumber(item.Price)
    return null
  }
  try {
    const skuPrices = JSON.parse(text(priceList.SKUPrices) || '{}')
    const price = toNumber(skuPrices[text(sku)])
    if (price > 0) return price
    return price === 0 ? 0 : null
  } catch (_) {
    return null
  }
}

export function resolvePricesForPriceList({ priceListCode, priceLists = [], priceListItems = [], appConfigMap = {}, consumptionItemRows = [] }) {
  const priceList = priceLists.find((row) => active(row) && text(row.Code) === text(priceListCode))
  if (!priceList) return { items: [], subtotal: 0, error: 'Price list not found' }
  const priceListLookup = resolvePriceListLookup(appConfigMap)
  const items = consumptionItemRows.map(row => {
    const sku = text(row.SKU)
    const qty = toNumber(row.Qty)
    const price = resolveSkuPrice(sku, priceList, priceListLookup, priceListItems)
    return { SKU: sku, Qty: qty, Price: price !== null ? price : 0 }
  }).filter(row => row.SKU && row.Qty > 0)
  const subtotal = items.reduce((sum, item) => sum + toNumber(item.Qty) * toNumber(item.Price), 0)
  return { priceListCode, items, subtotal, error: '' }
}

export function resolveInvoicePricing({ outletCode, rules = [], priceLists = [], priceListItems = [], appConfigMap = {}, consumptionItemRows = [] }) {
  const errors = []

  const priceListCode = resolvePriceListCode(outletCode, rules, priceLists)
  if (!priceListCode) {
    errors.push('No price list could be resolved for this outlet. Please configure an outlet operating rule with a price list or set a default price list.')
    return { priceListCode: '', items: [], subtotal: 0, error: errors.join(' ') }
  }

  const priceList = priceLists.find((row) => active(row) && text(row.Code) === priceListCode)
  if (!priceList) {
    errors.push(`Resolved price list ${priceListCode} not found or inactive.`)
    return { priceListCode, items: [], subtotal: 0, error: errors.join(' ') }
  }

  const priceListLookup = resolvePriceListLookup(appConfigMap)

  const items = []
  for (const row of consumptionItemRows) {
    const sku = text(row.SKU)
    const qty = toNumber(row.Qty)
    if (!sku || qty <= 0) continue

    const price = resolveSkuPrice(sku, priceList, priceListLookup, priceListItems)
    if (price === null) {
      errors.push(`No price found for SKU ${sku} in price list ${priceListCode}.`)
      continue
    }

    items.push({ SKU: sku, Qty: qty, Price: price })
  }

  if (errors.length) {
    return { priceListCode, items: [], subtotal: 0, error: errors.join(' ') }
  }

  const subtotal = items.reduce((sum, item) => sum + toNumber(item.Qty) * toNumber(item.Price), 0)

  return { priceListCode, items, subtotal, error: '' }
}

/** Tax-inclusive payable of an invoice, from the one pricing engine. */
export function getInvoiceTotal(inv = {}) {
  return grandTotalOf(inv || {})
}

// One index per payments array, reused across calls, so a loop over invoices does O(1)
// lookups instead of rescanning every payment per invoice.
const paymentIndexCache = new WeakMap()

function paymentsForInvoice(payments, invoiceCode) {
  if (!Array.isArray(payments)) return []
  let index = paymentIndexCache.get(payments)
  if (!index) {
    index = new Map()
    for (const p of payments) {
      if (!active(p) || text(p?.Progress) === 'CANCELLED') continue
      const code = text(p?.OutletConsumptionInvoiceCode)
      if (!code) continue
      const bucket = index.get(code)
      if (bucket) bucket.push(p)
      else index.set(code, [p])
    }
    paymentIndexCache.set(payments, index)
  }
  return index.get(invoiceCode) || []
}

/** Remaining unpaid balance, tax included. */
export function getInvoiceRemaining(inv = {}, payments = []) {
  return balanceDueOf(inv || {}, paymentsForInvoice(payments, text(inv?.Code)))
}

