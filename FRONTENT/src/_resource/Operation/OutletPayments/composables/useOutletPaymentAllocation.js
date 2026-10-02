/**
 * OutletPayments › allocation and distribution — Layer 2.
 *
 * NO ARITHMETIC OF ITS OWN. Every invoice figure is read from
 * `OutletConsumptionInvoices/composables/useInvoiceCalculation.js`, which is the one
 * pricing engine (UI_RESOURCE_DOMAIN_LOGIC.md §8.3). A second formula here is what let
 * `TotalTaxAmount` fall out of the payable.
 */

import { useRecord } from 'src/composables/resources/useRecord'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import {
  grandTotalOf,
  countsAsPayment,
  paidTotalOf,
  balanceDueOf,
  invoiceCurrencyOf
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const money = (value) => Number(num(value).toFixed(2))

export function netInvoiceTotalOf (invoice = {}) {
  return grandTotalOf(asRow(invoice))
}

export function parsePaymentAllocation (payment = {}) {
  const row = asRow(payment)
  const raw = text(row.Allocation)
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed
    } catch (e) {}
  }
  const codes = text(row.OutletConsumptionInvoiceCode).split(',').map(text).filter(Boolean)
  if (codes.length === 1) return { [codes[0]]: num(row.Amount) }
  return Object.fromEntries(codes.map((code) => [code, 0]))
}

export function paymentsForInvoice (invoiceCode, payments) {
  const targetCode = text(invoiceCode)
  if (!targetCode) return []
  const list = payments !== undefined ? payments : (useRecord().rows('OutletPayments') || [])
  return (Array.isArray(list) ? list : [])
    .filter((payment) => {
      const row = asRow(payment)
      if (!countsAsPayment(row)) return false
      const codes = text(row.OutletConsumptionInvoiceCode).split(',').map(text).filter(Boolean)
      return codes.includes(targetCode)
    })
    .map((payment) => {
      const row = asRow(payment)
      const allocation = parsePaymentAllocation(row)
      return Object.assign(row, { allocation })
    })
}

export function indexPaymentsByInvoice (payments = []) {
  if (payments instanceof Map) return payments
  const map = new Map()
  for (const payment of (Array.isArray(payments) ? payments : [])) {
    const row = asRow(payment)
    if (!countsAsPayment(row)) continue
    const allocation = parsePaymentAllocation(row)
    const entry = Object.assign(row, { allocation })
    const codes = text(row.OutletConsumptionInvoiceCode).split(',').map(text).filter(Boolean)
    for (const code of codes) {
      const bucket = map.get(code)
      if (bucket) bucket.push(entry)
      else map.set(code, [entry])
    }
  }
  return map
}

/** Sequential auto-distribution across selected invoices, oldest first. */
export function autoDistribute (totalVal, selectedInvoices = [], payments = []) {
  const invoices = Array.isArray(selectedInvoices) ? selectedInvoices : []
  const byInvoice = indexPaymentsByInvoice(payments)
  const sorted = [...invoices].sort((a, b) => new Date(asRow(a).Date || 0) - new Date(asRow(b).Date || 0))

  const allocations = {}
  let remainingAlloc = money(totalVal)

  for (const inv of sorted) {
    const invCode = text(asRow(inv).Code)
    const invBal = money(balanceDueOf(inv, byInvoice.get(invCode) || []))

    if (remainingAlloc >= invBal) {
      allocations[invCode] = invBal
      remainingAlloc = money(remainingAlloc - invBal)
    } else if (remainingAlloc > 0) {
      allocations[invCode] = remainingAlloc
      remainingAlloc = 0
    } else {
      allocations[invCode] = 0
    }
  }

  for (const inv of invoices) {
    const invCode = text(asRow(inv).Code)
    if (!(invCode in allocations)) allocations[invCode] = 0
  }

  return allocations
}

/**
 * Largest residue a collector may waive at the till: 5x the currency's rounding interval.
 *
 * Deliberately tiny. This is the rounding-artefact lane, not the write-off lane — a real
 * shortfall goes through the invoice's own audited `MarkPaid` settlement, where the reason
 * and the amount are stamped on the invoice row.
 */
export function residualThreshold (priceListCode = '') {
  const { getCurrency, defaultCurrencyCode } = useCurrencyResource()
  const currency = getCurrency(invoiceCurrencyOf(priceListCode) || text(defaultCurrencyCode?.value))
  const interval = num(currency?.roundingInterval) || 0.01
  return Number((interval * 5).toFixed(2))
}

export function isWaiverEligible (balance = 0, priceListCode = '') {
  const b = num(balance)
  return b > 0 && b <= residualThreshold(priceListCode)
}

export function waiverCommentOf (totalPaid, pendingTotal, invoiceCount, reason) {
  return `Total paid ${totalPaid} of pending ${pendingTotal} selecting ${invoiceCount}, and balance dropped due to ${reason}`
}

export { grandTotalOf, countsAsPayment, paidTotalOf, balanceDueOf, invoiceCurrencyOf }


