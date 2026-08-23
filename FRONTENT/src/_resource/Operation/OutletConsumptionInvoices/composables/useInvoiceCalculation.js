/**
 * OutletConsumptionInvoices › pricing, rounding and balance — Layer 2.
 *
 * ── WHAT THIS FILE IS NOT ──
 * It is NOT a second tax engine. The line-by-line arithmetic an invoice is built from —
 * tax-inclusive extraction, PRE_TAX discount apportionment, ordered compound tax
 * evaluation, the grouped `TaxDetails` fold — already has exactly one implementation, in
 * `OutletConsumptions/composables/useConsumptionInvoice.js`, and it is READ FROM HERE
 * rather than restated (UI_RESOURCE_DOMAIN_LOGIC.md §8.3: a sibling built afterward reads
 * the packed domain layer as-is).
 *
 * Restating it would be the exact failure that file's own header describes: two
 * implementations of one calculation, agreeing until the day one of them is updated. The
 * engine is re-exported at the bottom so a caller in this module still has one import.
 *
 * ── WHAT THIS FILE ADDS ──
 * The three things the invoice module needs that the consumption-side engine never had a
 * reason to answer, because a consumption submit already knew them from its own form:
 *
 *   1. WHICH PRICE LIST an outlet bills at, when nobody has chosen one yet.
 *   2. WHAT THE ROUNDED payable is, once the currency's own rounding interval applies.
 *   3. HOW MUCH IS STILL OWED, after the invoice's active payments.
 *
 * PURE (§3, §5): no refs, no `inject()`, no lifecycle. `balanceDueOf` takes the payment
 * rows explicitly rather than reaching for a store, so a `PageAction.js` outside any setup
 * context calls exactly what the cards call. `useInvoiceIndex.js` is what builds the
 * indexed payment map and feeds it in.
 */

import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'
import {
  operatingRuleDefaults,
  priceListCodeFor as rulePriceListCodeFor,
  invoiceDueDaysFor as ruleInvoiceDueDaysFor
} from 'src/_resource/Master/OutletOperatingRules/composables/useOutletOperatingRulesResource'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import {
  calculateConsumptionInvoice,
  makeLineTaxResolver,
  netPayableOf,
  storedTaxBreakdown,
  invoicePolicyOf,
  invoiceItemOf,
  groupTaxDetails,
  isTrue,
  PRE_TAX,
  POST_TAX
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionInvoice'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** A row the sheet has not soft-deleted. Blank `Status` counts as active, matching GAS. */
const isActiveRow = (row) => {
  const status = text(asRow(row).Status)
  return !status || status.toUpperCase() === 'ACTIVE'
}

/**
 * The default number of days an invoice is given to be paid, when the outlet declares none.
 *
 * CONFIGURED, not compiled in: it comes from `OutletOperatingRules`' own backend
 * `DefaultValues` through that resource's domain module, which is where the term lives.
 * `0` means nobody has configured one — a caller that needs a date treats that as "due on
 * issue" rather than inventing a window.
 */
export function defaultInvoiceDueDays () {
  return operatingRuleDefaults().invoiceDueDays
}

// ─── 1. Which price list an outlet bills at ───────────────────────────────────

/**
 * The price list to bill `outletCode` on, in strict precedence: the outlet's own operating
 * rule, then the tenant default, then nothing.
 *
 * Returns `''` rather than guessing when neither is configured. An invoice priced off a
 * list nobody chose is worse than one that refuses to generate: the first is wrong quietly
 * and gets paid, the second is a validation message. `validateInvoiceDraft` in
 * `useInvoiceWorkflow.js` is what turns the blank into that message.
 *
 * `rules` is passed IN rather than read from a store, because this is the pure half of the
 * pair — `useInvoiceIndex.js` holds the reactive `OutletOperatingRules` rows and calls
 * through. The price lists themselves come from the enriched Layer 2 resource, which has
 * already normalised `IsDefault`, so this never re-parses a sheet boolean (§6 — Enrich
 * Once, Then Project).
 */
export function resolvePriceListCode (outletCode = '', rules = []) {
  const { getPriceList, defaultPriceList } = usePriceListResource()
  const outlet = text(outletCode)

  // The rule's price list comes from the OutletOperatingRules domain — indexed once there
  // rather than re-scanned per outlet here.
  const ruleCode = rulePriceListCodeFor(outlet, rules)
  if (ruleCode) {
    const matched = getPriceList(ruleCode)
    if (matched) return text(matched.code || matched.Code)
  }

  const fallback = defaultPriceList?.value
  return fallback ? text(fallback.code || fallback.Code) : ''
}

/**
 * How many days after issue an invoice for this outlet falls due.
 *
 * Read off the outlet's operating rule when it declares one, otherwise the CONFIGURED
 * default of the `OutletOperatingRules` resource. A rule of `0` is treated as unset rather
 * than as "due the same day" — a zero in an unconfigured numeric column is far more often a
 * blank that got coerced than a deliberate same-day term.
 *
 * A thin adapter onto that resource's domain module, kept here so every existing caller
 * keeps its import line while there is still ONE definition of the term (§3.3).
 */
export function invoiceDueDaysFor (outletCode = '', rules = []) {
  return ruleInvoiceDueDaysFor(outletCode, rules)
}

/** The due date `days` after `fromISO`, as `YYYY-MM-DD`. */
export function dueDateFrom (fromISO = '', days = null) {
  if (days === null || days === undefined) days = defaultInvoiceDueDays()
  const base = text(fromISO) ? new Date(`${text(fromISO)}T00:00:00`) : new Date()
  if (Number.isNaN(base.getTime())) return ''
  base.setDate(base.getDate() + Math.max(0, num(days)))
  return base.toISOString().slice(0, 10)
}

// ─── 2. Currency rounding ─────────────────────────────────────────────────────

/**
 * The currency an invoice priced on `priceListCode` is denominated in.
 *
 * Falls back to the tenant's default currency, never to a literal code — a hardcoded `AED`
 * here would round a rupee invoice to the wrong interval on a tenant that never uses it.
 */
export function invoiceCurrencyOf (priceListCode = '') {
  const { getPriceList } = usePriceListResource()
  const { defaultCurrencyCode } = useCurrencyResource()
  const list = getPriceList(text(priceListCode))
  return text(list?.currency || list?.Currency) || text(defaultCurrencyCode?.value)
}

/**
 * A money figure snapped to its currency's own rounding interval (`Currencies.RoundingInterval`
 * — 0.01 for most, 0.05 where the smallest coin is a nickel).
 *
 * Applied to the PAYABLE, never to the component figures. Rounding `Subtotal`, the taxable
 * base and the tax separately and then adding them up produces a total that disagrees with
 * its own breakdown by up to one interval per line — which is exactly the discrepancy a
 * customer queries. The stored components stay exact; only the number somebody actually
 * hands over is snapped.
 */
export function roundPayable (value, priceListCode = '') {
  const { roundToInterval } = useCurrencyResource()
  return roundToInterval(num(value), invoiceCurrencyOf(priceListCode))
}

/**
 * The rounded net payable of a STORED invoice row.
 *
 * `netPayableOf` derives the exact figure from the six stored columns; this is that figure
 * at the currency's interval. Both exist because they answer different questions: the exact
 * one reconciles against the line items, the rounded one is what a payment settles.
 */
export function grandTotalOf (row = {}) {
  const entry = asRow(row)
  return roundPayable(netPayableOf(entry), entry.PriceListCode)
}

/**
 * The payable as both numbers. The exact one is what the lines add up to; the rounded one is
 * what a payment can settle.
 *
 * Display rule: data-entry screens show exact only, view/payment show `exact (rounded)`.
 */
export function payableFigures (exactValue, priceListCode = '') {
  const exact = num(exactValue)
  const rounded = roundPayable(exact, priceListCode)
  return { exact, rounded, differs: Math.abs(exact - rounded) >= 0.000001 }
}

/** The same pair, for a STORED invoice row. */
export function payableFiguresOf (row = {}) {
  const entry = asRow(row)
  return payableFigures(netPayableOf(entry), entry.PriceListCode)
}

/** `exact (rounded)`, or just the exact figure when rounding changed nothing. */
export function payableLabel (figures, money) {
  const entry = figures && typeof figures === 'object' ? figures : { exact: 0, rounded: 0 }
  const format = typeof money === 'function' ? money : ((value) => String(num(value)))
  const exact = format(entry.exact)
  return entry.differs ? `${exact} (${format(entry.rounded)})` : exact
}

// ─── 3. What is still owed ────────────────────────────────────────────────────

/**
 * The payments that count against an invoice: active rows, not cancelled.
 *
 * A cancelled payment is a payment that was reversed, so counting it would show an invoice
 * as settled on money that came back.
 */
export function countsAsPayment (payment = {}) {
  const row = asRow(payment)
  return isActiveRow(row) && text(row.Progress).toUpperCase() !== 'CANCELLED'
}

/** The total collected against an invoice, from that invoice's own payment rows. */
export function paidTotalOf (payments = []) {
  return (Array.isArray(payments) ? payments : [])
    .filter(countsAsPayment)
    .reduce((sum, payment) => sum + num(asRow(payment).Amount), 0)
}

/**
 * What is still owed on an invoice — the rounded grand total less what has been collected.
 *
 * FLOORED AT ZERO. An overpayment is a credit to be handled on the outlet's account, never
 * a negative balance that would show as money the business owes the outlet on this row and
 * would flip every "highest balance first" sort on its head.
 *
 * `payments` is the invoice's OWN payment rows, already filtered by code — the caller does
 * the join, because doing it here would mean scanning every payment in the tenant once per
 * invoice, which is the O(n×m) render-loop scan §6 forbids. `useInvoiceIndex.js` builds
 * that map in one pass.
 */
export function balanceDueOf (row = {}, payments = []) {
  return Math.max(0, grandTotalOf(row) - paidTotalOf(payments))
}

/**
 * Is this balance small enough to treat as settled?
 *
 * The threshold is the currency's own rounding interval, not a hardcoded 0.01: on a
 * currency that rounds to 0.05, a 3-fils residue is unpayable — no combination of coins
 * clears it — so an invoice carrying one would sit in the pending queue forever. This is
 * also what the `Waive-off Invoices` view keys off, from the other side.
 */
export function isMicroBalance (balance, priceListCode = '') {
  const { getCurrency, defaultCurrencyCode } = useCurrencyResource()
  const currency = getCurrency(invoiceCurrencyOf(priceListCode) || text(defaultCurrencyCode?.value))
  const interval = num(currency?.roundingInterval) || 0.01
  return num(balance) <= interval
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useInvoiceCalculation () {
  return {
    defaultInvoiceDueDays,
    resolvePriceListCode,
    invoiceDueDaysFor,
    dueDateFrom,
    makeLineTaxResolver,
    invoiceCurrencyOf,
    roundPayable,
    grandTotalOf,
    payableFigures,
    payableFiguresOf,
    payableLabel,
    countsAsPayment,
    paidTotalOf,
    balanceDueOf,
    isMicroBalance,
    calculateConsumptionInvoice,
    netPayableOf,
    storedTaxBreakdown,
    invoicePolicyOf
  }
}

/**
 * The ONE calculation engine, re-exported so this module's callers have a single import
 * for "everything invoice arithmetic" without any of it being reimplemented here.
 */
export {
  calculateConsumptionInvoice,
  makeLineTaxResolver,
  netPayableOf,
  storedTaxBreakdown,
  invoicePolicyOf,
  invoiceItemOf,
  groupTaxDetails,
  isTrue,
  PRE_TAX,
  POST_TAX
}
