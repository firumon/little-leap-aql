/**
 * OutletReturns › unit credit pricing — Layer 2.
 *
 * What a returned unit is worth back to the outlet. One question, one answer, read by the
 * Add page (to pre-fill the price), by the View card (to show the credit) and by the
 * invoice deduction — so a return is credited at exactly the rate the outlet was billed at.
 *
 * ── WHY THIS IS A SEPARATE FILE FROM `useReturnPayload.js` ──
 * Resolving a price means reading the outlet's rules and the active price list, which the
 * cascade exposes through composables backed by the data store. `useReturnPayload.js` is
 * bound by §9.6 to stay store-free — it assembles declarative requests and nothing else —
 * so the pricing adapter lives here instead and hands the payload builders a plain number.
 * That is the same split `useConsumptionStock.priceOf` already uses, for the same reason.
 *
 * ── AND WHY IT IS AN ADAPTER, NOT AN IMPLEMENTATION ──
 * `_resource/Master/Outlets` and `_resource/Master/PriceLists` are already packed (§8.3):
 * between them they own the outlet-rule-then-global-default precedence AND the
 * INLINE-vs-ITEMS lookup split. Re-deriving either here would be a second implementation of
 * a solved rule, reached by the slowest possible route — the bypass link §10.1 names. This
 * file only asks them, in series: outlet → its price list → that list's price for the SKU.
 */

import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'

const text = (value) => (value == null ? '' : String(value).trim())

/**
 * The unit credit value for a returned SKU at a given outlet.
 *
 * Returns `0` for an SKU the outlet's price list does not cover, rather than refusing. A
 * return is a PHYSICAL fact that must be recordable even when it carries no monetary
 * credit; it is the INVOICE that declines to credit an unpriced line. `0` here therefore
 * means "no credit value", and the Add page leaves the field editable so an officer can
 * state one.
 *
 * Rounded to 2 decimals at the boundary, so the figure the form shows, the figure stored
 * and the figure deducted on the bill are the same number.
 */
export function resolveReturnUnitPrice (outletCode, skuCode) {
  const outlet = text(outletCode)
  const sku = text(skuCode)
  if (!outlet || !sku) return 0
  // In series — the outlet resolves WHICH list applies, the list resolves the price.
  // Neither question is answered here.
  return priceFromList(effectivePriceListCode(outlet), sku)
}

/**
 * The price list that applies to an outlet, by the cascade's own precedence.
 *
 * Exposed separately because the Add page SHOWS the list it is pricing from and lets the
 * officer change it — so the UI needs the resolved code, not just the number it produced.
 */
export function effectivePriceListCode (outletCode) {
  const outlet = text(outletCode)
  if (!outlet) return ''
  const { getEffectivePriceListCode } = useOutletResource()
  return text(getEffectivePriceListCode(outlet))
}

/**
 * A SKU's price on an EXPLICITLY chosen list.
 *
 * The Add page's price list selector writes no column — `OutletReturns` has no
 * `PriceListCode` header — so the chosen list is a control field whose only job is to decide
 * what goes in `Price`. This is the function that decides it, and it is the same
 * `getPriceOf` the outlet-driven path above ends at, so a return priced by the default list
 * and one priced by naming that list explicitly cannot differ.
 *
 * Returns `0` for a SKU the list does not cover, rather than refusing — a return is a
 * PHYSICAL fact that must be recordable even when it carries no monetary credit, and the
 * Add page leaves the field editable so an officer can state one.
 */
export function priceFromList (priceListCode, skuCode) {
  const sku = text(skuCode)
  if (!sku) return 0

  const { getPriceOf } = usePriceListResource()
  // A blank list code falls through to the price list domain's own default, which is its
  // documented behaviour — not an error to guard against here.
  const price = getPriceOf(sku, text(priceListCode))

  const numeric = Number(price)
  if (!Number.isFinite(numeric)) return 0
  return Math.round(numeric * 100) / 100
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useReturnPricing () {
  return { resolveReturnUnitPrice, effectivePriceListCode, priceFromList }
}
