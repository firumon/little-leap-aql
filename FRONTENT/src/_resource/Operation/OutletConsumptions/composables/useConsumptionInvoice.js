/**
 * OutletConsumptions › invoice arithmetic — Layer 2, the ONE calculation engine.
 *
 * Every figure an outlet consumption invoice carries — the line prices, the discount, the
 * taxable bases, the per-tax-code breakdown and the net payable — is computed here and
 * nowhere else. The wizard's review step, the sticky bar that assembles the batch, the
 * payload builder that writes the rows, and the View card that reads them back all call
 * `calculateConsumptionInvoice`, so the number the user agreed to and the number the sheet
 * stores are the same number by construction, not by two implementations agreeing.
 *
 * They previously did not. The review step summed `qty × price` and subtracted a flat
 * discount, while the payload builder ran the same lines through the tax pipeline and a
 * separate `summariseInvoice` — so the total the user confirmed was, by design, missing the
 * tax the invoice was about to charge, and neither side knew which discount/tax policy the
 * price list actually declared.
 *
 * PURE (UI_RESOURCE_DOMAIN_LOGIC.md §3, §5): no refs, no `inject()`, no lifecycle. It takes
 * plain rows plus two RESOLVERS — a price lookup and a tax calculator — so a `PageAction.js`
 * running outside any setup context calls exactly what the cards call, and the arithmetic
 * stays testable with a stub. The resolvers DEFAULT to the module's existing Layer 2
 * adapters (`priceOf`, and the enriched price list's own policy columns) so the common
 * caller passes neither.
 *
 * ── THE TWO POLICIES ──
 * A price list declares two independent flags, and their four combinations are the whole
 * specification of this file:
 *
 *   DiscountTaxPolicy = POST_TAX   tax is charged on the FULL, pre-discount value; the
 *                                  discount comes off the bill afterwards. Every line
 *                                  stores `Discount: 0` — the discount is a header figure
 *                                  that no line has a share of.
 *   DiscountTaxPolicy = PRE_TAX    the discount reduces the taxable base, so it must be
 *                                  APPORTIONED across the lines by value before tax is
 *                                  computed. Each line stores its own share.
 *
 *   TaxInclusive = FALSE           the price list price excludes tax; the taxable base IS
 *                                  the line value.
 *   TaxInclusive = TRUE            the price already contains the tax; the calculator
 *                                  extracts a net base, which is smaller than the line
 *                                  value. This is why the net payable below is derived from
 *                                  `TotalTaxableAmount` and never from `Subtotal` — adding
 *                                  tax onto a tax-inclusive subtotal would charge it twice.
 *                                  On a tax-EXCLUSIVE list the two are equal, so the
 *                                  POST_TAX formula is unchanged for the ordinary case.
 */

import { toNumber, priceOf, lineTotal, discountAmount } from './useConsumptionStock'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useTaxResource } from 'src/_resource/Master/Taxes/composables/useTaxResource'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export const POST_TAX = 'POST_TAX'
export const PRE_TAX = 'PRE_TAX'

/** A sheet boolean. `TRUE`/`true`/`1` are true; anything else, including blank, is false. */
export function isTrue (value) {
  if (value === true) return true
  const raw = text(value).toUpperCase()
  return raw === 'TRUE' || raw === 'YES' || raw === '1'
}

/**
 * The two policy flags a price list declares.
 *
 * Read off the ENRICHED price list, which already normalised `TaxInclusive` and defaulted
 * `DiscountTaxPolicy` — re-parsing the raw columns here would be a second implementation of
 * a solved rule (CORE_ARCHITECTURE_RULES §6 — Enrich Once, Then Project).
 *
 * Defaults to `POST_TAX` / exclusive, matching the backend's own column defaults
 * (`setupMasterSheets.gs`), so an unresolvable list bills the same way a freshly created one
 * does rather than silently switching policy.
 */
export function invoicePolicyOf (priceListCode = '') {
  const { getPriceList, defaultPriceList } = usePriceListResource()
  const list = getPriceList(text(priceListCode)) || defaultPriceList?.value || null
  return {
    discountTaxPolicy: text(list?.discountTaxPolicy).toUpperCase() === PRE_TAX ? PRE_TAX : POST_TAX,
    taxInclusive: isTrue(list?.taxInclusive)
  }
}

/**
 * The lines this engine accepts, normalised.
 *
 * `SoldQty` is what a wizard count row calls its quantity; `Qty` is what a stored
 * `OutletConsumptionItems` row calls it. Accepting both is what lets one call price the
 * union of a live audit and a bundled earlier one without the caller renaming columns.
 *
 * A line with no SKU or a non-positive quantity is DROPPED rather than priced at zero: it
 * would contribute nothing but an empty item row on the invoice.
 */
function normaliseLines (lines = []) {
  return (Array.isArray(lines) ? lines : [])
    .map(asRow)
    .map((row) => ({ sku: text(row.SKU), qty: toNumber(row.SoldQty ?? row.Qty) }))
    .filter((row) => row.sku && row.qty > 0)
}

/**
 * The stored item record for a calculated line — the eight `OutletConsumptionInvoiceItems`
 * columns, minus the two carriers.
 *
 * `TaxParts` is per-line working state the header's grouped `TaxDetails` is folded from, and
 * `Unpriced` is a display flag for the review step. Neither is a column, so neither is
 * written.
 */
export function invoiceItemOf (line) {
  const { TaxParts, Unpriced, ...record } = asRow(line)
  return record
}

/**
 * The invoice's tax breakdown, GROUPED BY TAX CODE.
 *
 * A tax return is filed per tax code, so the header has to answer "how much VAT5 was charged
 * on what base" without the reader re-summing one entry per SKU — and on a bundled invoice
 * covering several audits that list is unbounded.
 *
 * A COMPOUND tax (GST18 → CGST9 + SGST9) contributes one entry PER COMPONENT, because that
 * is the granularity the components were calculated at and the granularity a return needs.
 * Insertion order is preserved (`Map`), so the components appear in the calculator's own
 * order rather than alphabetically.
 */
export function groupTaxDetails (lines = []) {
  const grouped = new Map()
  ;(Array.isArray(lines) ? lines : []).forEach((line) => {
    ;(asRow(line).TaxParts || []).forEach((part) => {
      const code = text(part.TaxCode)
      if (!code) return
      const entry = grouped.get(code) || { TaxCode: code, TaxableAmount: 0, TaxAmount: 0 }
      entry.TaxableAmount += toNumber(part.TaxableAmount)
      entry.TaxAmount += toNumber(part.TaxAmount)
      grouped.set(code, entry)
    })
  })
  return [...grouped.values()]
}

/**
 * The `calculateLineTax` resolver this engine is driven by. Bridges the Taxes domain's field
 * names, and binds the SAME `resolvePrice` the lines use so an overridden price is taxed at
 * the price actually billed.
 *
 * Lives beside the engine so every billing screen uses one resolver. Omit it and every line
 * bills untaxed, silently.
 */
export function makeLineTaxResolver ({ priceListCode = '', resolvePrice = null, interState = false } = {}) {
  const listCode = text(priceListCode)
  const { discountTaxPolicy, taxInclusive } = invoicePolicyOf(listCode)

  return ({ skuCode = '', quantity = 0, discount = 0 } = {}) => {
    const { getSku } = useSkuResource()
    const { calculateLineTax } = useTaxResource()

    const sku = text(skuCode)
    const taxCode = text(getSku(sku)?.taxCode)
    const price = typeof resolvePrice === 'function' ? (resolvePrice(sku, listCode) ?? 0) : 0

    const result = calculateLineTax({
      price,
      quantity: toNumber(quantity),
      discount: toNumber(discount),
      taxCode,
      taxInclusive,
      discountTaxPolicy,
      // Bound once so every line of one invoice prices on the same branch.
      interState
    })

    return {
      taxableAmount: toNumber(result.taxableAmount),
      taxAmount: toNumber(result.totalTax),
      // One entry per COMPONENT: the granularity a return is filed at.
      taxBreakdown: (result.breakdown || []).map((entry) => ({
        taxCode: text(entry.code),
        taxAmount: toNumber(entry.amount)
      }))
    }
  }
}

/**
 * Price and tax ONE line, given the discount share the policy assigned it.
 *
 * `calculateLineTax` is injected rather than imported so this module stays clear of the tax
 * composable's store graph. When it is absent — or throws, which it does for a SKU with no
 * tax configuration or a price list it cannot resolve — the line is billed UNTAXED rather
 * than aborting the whole submission: a zero tax amount is visible and correctable, a lost
 * invoice is neither.
 */
function calculateLine (line, priceListCode, discount, calculateLineTax, resolvePrice) {
  const resolved = resolvePrice(line.sku, priceListCode)
  const price = resolved ?? 0
  const gross = lineTotal(line.qty, price)

  const base = {
    SKU: line.sku,
    Qty: line.qty,
    Price: price,
    // The line's own value, ALWAYS pre-discount. The discount is stated in its own column
    // beside it, so a reader can see both the list value and what was taken off it — a
    // `Total` that had already absorbed the discount would make the two indistinguishable.
    Total: gross,
    Discount: toNumber(discount),
    TaxableAmount: Math.max(0, gross - toNumber(discount)),
    TaxAmount: 0,
    TaxCode: '',
    TaxParts: [],
    Unpriced: resolved === null || resolved === undefined
  }

  if (typeof calculateLineTax !== 'function') return base

  try {
    const result = calculateLineTax({
      skuCode: line.sku,
      priceListCode,
      quantity: line.qty,
      discount: toNumber(discount)
    })
    // The calculator has already applied both policies to arrive at this base: it extracted
    // the net price when the list is tax-inclusive, and subtracted the discount only when
    // the policy is PRE_TAX. Reading its answer is what keeps ONE implementation of the
    // tax-inclusive extraction in the app.
    const taxableAmount = toNumber(result.taxableAmount)
    return {
      ...base,
      TaxableAmount: taxableAmount,
      TaxAmount: toNumber(result.taxAmount),
      TaxCode: text((result.taxBreakdown || []).map((entry) => entry.taxCode).filter(Boolean).join(',')),
      // ONE part per tax COMPONENT, not one per line — see `groupTaxDetails`. Every
      // component of a compound tax shares the line's single taxable base.
      TaxParts: (result.taxBreakdown || [])
        .filter((entry) => text(entry.taxCode))
        .map((entry) => ({
          TaxCode: text(entry.taxCode),
          TaxableAmount: taxableAmount,
          TaxAmount: toNumber(entry.taxAmount)
        }))
    }
  } catch (error) {
    return base
  }
}

/**
 * THE calculation. Everything an outlet consumption invoice is, from a set of sold lines.
 *
 * Returns `{ header, lines, taxBreakdown, policy }` — the header exactly as
 * `OutletConsumptionInvoices` stores it, the lines exactly as
 * `OutletConsumptionInvoiceItems` stores them (plus two stripped carriers), and the grouped
 * breakdown as a raw array for UI consumers that would otherwise re-parse the header's JSON.
 *
 * ── THE PIPELINE ──
 *   1. Resolve each line's unit price and raw value; sum them into the invoice subtotal.
 *   2. Resolve the nominal discount against that subtotal (`PERCENT` of it, or a `FLAT`
 *      amount), capped at the subtotal — a discount larger than the bill is a free bill,
 *      never a negative one.
 *   3. APPORTION that discount across the lines by value, but only under `PRE_TAX`. Under
 *      `POST_TAX` every line carries zero and tax is charged on the full value.
 *   4. Tax each line on the base its policy produced.
 *   5. Fold the per-component tax parts into one entry per tax code.
 *
 * The apportionment in step 3 is by RAW LINE VALUE rather than evenly, so a 100-unit line
 * and a 1-unit line at the same price do not absorb the same discount — and it is scaled off
 * the subtotal that was actually summed, so the shares total the discount exactly rather
 * than drifting by a rounding remainder on the last line.
 */
export function calculateConsumptionInvoice ({
  lines = [],
  priceListCode = '',
  discountType = 'FLAT',
  discountValue = 0,
  returnDeduction = 0,
  calculateLineTax = null,
  resolvePrice = priceOf,
  policy = null
} = {}) {
  const code = text(priceListCode)
  const { discountTaxPolicy, taxInclusive } = policy || invoicePolicyOf(code)
  const priceFor = typeof resolvePrice === 'function' ? resolvePrice : priceOf

  const normalised = normaliseLines(lines)

  // Step 1–2. Both need the raw values, so they are summed once and reused rather than
  // recomputed inside the per-line pass below (§6 — the map runs per line, this does not).
  const rawValues = normalised.map((line) => lineTotal(line.qty, priceFor(line.sku, code) ?? 0))
  const rawSubtotal = rawValues.reduce((sum, value) => sum + value, 0)
  const totalDiscount = discountAmount(rawSubtotal, discountType, discountValue)

  // Step 3.
  const shareOf = (index) => {
    if (discountTaxPolicy !== PRE_TAX || totalDiscount <= 0 || rawSubtotal <= 0) return 0
    return (rawValues[index] / rawSubtotal) * totalDiscount
  }

  // Steps 4–5.
  const calculated = normalised.map((line, index) =>
    calculateLine(line, code, shareOf(index), calculateLineTax, priceFor))

  const subtotal = calculated.reduce((sum, line) => sum + toNumber(line.Total), 0)
  const totalTaxableAmount = calculated.reduce((sum, line) => sum + toNumber(line.TaxableAmount), 0)
  const totalTaxAmount = calculated.reduce((sum, line) => sum + toNumber(line.TaxAmount), 0)
  const deduction = Math.max(0, toNumber(returnDeduction))
  const taxBreakdown = groupTaxDetails(calculated)

  /**
   * The net payable.
   *
   * Built from `TotalTaxableAmount`, never from `Subtotal` — see the TaxInclusive note in
   * the file header. Under PRE_TAX the discount is already inside every line's taxable
   * amount, so subtracting it again here would apply it twice; under POST_TAX no line has
   * seen it and it comes off exactly once, here.
   *
   * Floored at zero: a credit larger than the bill is a zero invoice, never a negative one
   * the payment flow would then try to collect.
   */
  const outstandingDiscount = discountTaxPolicy === PRE_TAX ? 0 : totalDiscount
  const total = Math.max(0, totalTaxableAmount - outstandingDiscount + totalTaxAmount - deduction)

  return {
    header: {
      Subtotal: subtotal,
      Discount: totalDiscount,
      TotalTaxableAmount: totalTaxableAmount,
      TotalTaxAmount: totalTaxAmount,
      TaxDetails: JSON.stringify(taxBreakdown),
      ReturnDeductionTotal: deduction,
      Total: total
    },
    lines: calculated,
    taxBreakdown,
    policy: { discountTaxPolicy, taxInclusive }
  }
}

/**
 * The stored `TaxDetails` of an invoice row, as an array.
 *
 * A malformed or legacy value yields an empty list rather than throwing — an unreadable
 * breakdown must not take a whole invoice card down with it, and `TotalTaxAmount` still
 * states the number that matters.
 */
export function storedTaxBreakdown (row = {}) {
  try {
    const raw = asRow(row).TaxDetails
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return (Array.isArray(parsed) ? parsed : []).filter((entry) => text(entry?.TaxCode))
  } catch (error) {
    return []
  }
}

/**
 * The net payable of a STORED invoice row — the same number `calculateConsumptionInvoice`
 * produced when the row was written.
 *
 * `OutletConsumptionInvoices` stores the six component figures but no `Total` column, so
 * every reader derives this. Deriving it HERE is what stops the View card, the payments page
 * and the printed invoice each writing their own version of the formula and disagreeing on a
 * PRE_TAX or tax-inclusive list.
 *
 * The policy is re-resolved from the row's own `PriceListCode` rather than assumed, because
 * it is what decides whether `Discount` has already been absorbed into `TotalTaxableAmount`
 * (PRE_TAX) or is still owed against it (POST_TAX). Subtracting it in the PRE_TAX case would
 * apply the discount twice.
 */
export function netPayableOf (row = {}) {
  const entry = asRow(row)
  const { discountTaxPolicy } = invoicePolicyOf(entry.PriceListCode)
  // LEGACY ROWS. Invoices written before the tax columns were populated carry a `Subtotal`
  // and a blank `TotalTaxableAmount`, and reading the blank one literally would display
  // every historical invoice as zero. On a tax-EXCLUSIVE list the two are equal by
  // definition, which is what makes the fallback exact rather than a guess — and a
  // tax-inclusive invoice always stored the extracted base, so it never reaches this.
  const taxable = toNumber(entry.TotalTaxableAmount) || toNumber(entry.Subtotal)
  const discount = discountTaxPolicy === PRE_TAX ? 0 : toNumber(entry.Discount)
  return Math.max(0, taxable - discount + toNumber(entry.TotalTaxAmount) - toNumber(entry.ReturnDeductionTotal))
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useConsumptionInvoice () {
  return {
    POST_TAX,
    PRE_TAX,
    isTrue,
    invoicePolicyOf,
    groupTaxDetails,
    invoiceItemOf,
    makeLineTaxResolver,
    calculateConsumptionInvoice,
    storedTaxBreakdown,
    netPayableOf
  }
}
