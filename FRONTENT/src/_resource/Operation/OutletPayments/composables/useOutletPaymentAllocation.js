/**
 * OutletPayments › allocation and distribution — Layer 2.
 *
 * NO ARITHMETIC OF ITS OWN. Every invoice figure is read from
 * `OutletConsumptionInvoices/composables/useInvoiceCalculation.js`, which is the one
 * pricing engine (UI_RESOURCE_DOMAIN_LOGIC.md §8.3). A second formula here is what let
 * `TotalTaxAmount` fall out of the payable.
 */

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

/** The tax-inclusive, currency-rounded payable of an invoice. */
export function netInvoiceTotalOf (invoice = {}) {
  return grandTotalOf(asRow(invoice))
}

/**
 * Group payment rows by the invoice they credit, in ONE pass.
 *
 * Pass the result straight back into `autoDistribute` when the caller already holds an
 * index — a flat array is regrouped here rather than rescanned per invoice (§6).
 */
export function indexPaymentsByInvoice (payments = []) {
  if (payments instanceof Map) return payments
  const map = new Map()
  for (const payment of (Array.isArray(payments) ? payments : [])) {
    const row = asRow(payment)
    if (!countsAsPayment(row)) continue
    const code = text(row.OutletConsumptionInvoiceCode)
    if (!code) continue
    const bucket = map.get(code)
    if (bucket) bucket.push(row)
    else map.set(code, [row])
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

/** Largest residue a collector may waive off: 10x the rounding interval, at least 10.00. */
export function residualThreshold (priceListCode = '') {
  const { getCurrency, defaultCurrencyCode } = useCurrencyResource()
  const currency = getCurrency(invoiceCurrencyOf(priceListCode) || text(defaultCurrencyCode?.value))
  const interval = num(currency?.roundingInterval) || 0.01
  return Math.max(10, Number((interval * 10).toFixed(2)))
}

export function isWaiverEligible (balance = 0, priceListCode = '') {
  const b = num(balance)
  return b > 0 && b <= residualThreshold(priceListCode)
}

export function waiverCommentOf (totalPaid, pendingTotal, invoiceCount, reason) {
  return `Total paid ${totalPaid} of pending ${pendingTotal} selecting ${invoiceCount}, and balance dropped due to ${reason}`
}

export { grandTotalOf, countsAsPayment, paidTotalOf, balanceDueOf, invoiceCurrencyOf }

export function useOutletPaymentAllocation () {
  return {
    netInvoiceTotalOf,
    grandTotalOf,
    countsAsPayment,
    paidTotalOf,
    balanceDueOf,
    indexPaymentsByInvoice,
    autoDistribute,
    invoiceCurrencyOf,
    residualThreshold,
    isWaiverEligible,
    waiverCommentOf
  }
}
