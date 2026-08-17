/**
 * OutletPayments › allocation mathematics, balance derivation, and auto-distribution — Layer 2.
 *
 * Pure financial calculations for invoice settling, payment sum reduction,
 * and sequential distribution across multiple selected invoices.
 */

import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const isActiveRow = (row) => {
  const status = text(asRow(row).Status)
  return !status || status.toUpperCase() === 'ACTIVE'
}

/**
 * Net total of an invoice before payments.
 * Net Total = Subtotal - Discount - ReturnDeductionTotal
 */
export function netInvoiceTotalOf (invoice = {}) {
  const row = asRow(invoice)
  const subtotal = num(row.Subtotal)
  const discount = num(row.Discount)
  const returnDeduction = num(row.ReturnDeductionTotal)
  return Math.max(0, subtotal - discount - returnDeduction)
}

/**
 * Filter predicate for valid active payments.
 */
export function countsAsPayment (payment = {}) {
  const row = asRow(payment)
  return isActiveRow(row) && text(row.Progress).toUpperCase() !== 'CANCELLED'
}

/**
 * Total collected amount against an invoice from its own payment rows.
 */
export function paidTotalOf (payments = []) {
  return (Array.isArray(payments) ? payments : [])
    .filter(countsAsPayment)
    .reduce((sum, payment) => sum + num(asRow(payment).Amount), 0)
}

/**
 * Outstanding unpaid balance on an invoice.
 */
export function balanceDueOf (invoice = {}, payments = []) {
  const total = netInvoiceTotalOf(invoice)
  const paid = paidTotalOf(payments)
  return Math.max(0, Number((total - paid).toFixed(2)))
}

/**
 * Sequential auto-distribution across selected invoices (oldest first).
 */
export function autoDistribute (totalVal, selectedInvoices = [], payments = []) {
  const sortedInvoices = [...(Array.isArray(selectedInvoices) ? selectedInvoices : [])]
    .sort((a, b) => new Date(a.Date || 0) - new Date(b.Date || 0))

  const allocations = {}
  let remainingAlloc = Number(totalVal) || 0

  for (const inv of sortedInvoices) {
    const invCode = text(inv.Code)
    const invPayments = (Array.isArray(payments) ? payments : []).filter(
      p => text(p.OutletConsumptionInvoiceCode) === invCode
    )
    const invBal = balanceDueOf(inv, invPayments)

    if (remainingAlloc >= invBal) {
      allocations[invCode] = Number(invBal.toFixed(2))
      remainingAlloc -= invBal
    } else if (remainingAlloc > 0) {
      allocations[invCode] = Number(remainingAlloc.toFixed(2))
      remainingAlloc = 0
    } else {
      allocations[invCode] = 0
    }
  }

  // Ensure every selected invoice has a numeric entry
  for (const inv of selectedInvoices) {
    const invCode = text(inv.Code)
    if (!(invCode in allocations)) {
      allocations[invCode] = 0
    }
  }

  return allocations
}

/**
 * Resolves currency code for a given price list.
 */
export function invoiceCurrencyOf (priceListCode = '') {
  const { getPriceList } = usePriceListResource()
  const { defaultCurrencyCode } = useCurrencyResource()
  const list = getPriceList(text(priceListCode))
  return text(list?.currency || list?.Currency) || text(defaultCurrencyCode?.value)
}

/**
 * Returns the maximum residual balance eligible for a small balance waiver (< 10x Rounding Interval or max 10.00).
 */
export function residualThreshold (priceListCode = '') {
  const { getCurrency, defaultCurrencyCode } = useCurrencyResource()
  const currency = getCurrency(invoiceCurrencyOf(priceListCode) || text(defaultCurrencyCode?.value))
  const interval = num(currency?.roundingInterval) || 0.01
  return Math.max(10, Number((interval * 10).toFixed(2)))
}

/**
 * Determines if an invoice balance is small enough for residual balance waiver.
 */
export function isWaiverEligible (balance = 0, priceListCode = '') {
  const b = num(balance)
  return b > 0 && b <= residualThreshold(priceListCode)
}

/**
 * Generates audit comment for residual waiver.
 */
export function waiverCommentOf (totalPaid, pendingTotal, invoiceCount, reason) {
  return `Total paid ${totalPaid} of pending ${pendingTotal} selecting ${invoiceCount}, and balance dropped due to ${reason}`
}

// ─── Composable Wrapper ───────────────────────────────────────────────────────

export function useOutletPaymentAllocation () {
  return {
    netInvoiceTotalOf,
    countsAsPayment,
    paidTotalOf,
    balanceDueOf,
    autoDistribute,
    invoiceCurrencyOf,
    residualThreshold,
    isWaiverEligible,
    waiverCommentOf
  }
}
