/**
 * OutletConsumptions › stock derivation & validation — Layer 2, the resource's domain logic.
 *
 * The arithmetic that turns a physical count into billable consumption, the return matrix
 * that decides what a surplus does to the ledger and the invoice, and the validation gate
 * every submission passes through. All of it is "what does this record mean", not "how is
 * it drawn", so all of it lives here rather than in a `_ui/` composable
 * (UI_RESOURCE_DOMAIN_LOGIC.md §3).
 *
 * PURE THROUGHOUT. Every export takes plain rows and returns plain values — no refs, no
 * `inject()`, no store, nothing rendered — so a `PageAction.js` running outside any
 * component setup can call the same functions the wizard cards call (§5).
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO — price list resolution. `_resource/Master/
 * PriceLists` and `_resource/Master/Outlets` are already packed (§8.3): between them they
 * own the outlet-rule-then-global-default precedence AND the INLINE-vs-ITEMS lookup split,
 * keyed by `AppConfigMap.PriceListLookup`. Re-deriving either here would be a second
 * implementation of a solved rule, arrived at by the slowest possible route. `priceOf`
 * below is a thin, documented adapter onto those two — nothing more.
 */

import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { splitByWarehouseStock } from 'src/_resource/Operation/OutletRestocks/composables/useRestockStockMatch'

// ─── Primitives ───────────────────────────────────────────────────────────────

export const DEFAULT_STORAGE = '_default'

const text = (value) => (value == null ? '' : String(value).trim())
// `useRecord().items` can carry `null`, and an enriched relation getter yields `null` for
// a row whose Code has not landed. Normalizing BEFORE any predicate is what stops a null
// passing one guard and being dereferenced by the next (§11 rule 2).
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

/** Safe numeric coercion. A blank, a null or an unparseable string is `0`, never `NaN`. */
export function toNumber (value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// ─── The count arithmetic ─────────────────────────────────────────────────────
//
// Three derivations, each stated once. Every card, badge, validator and payload builder
// in this module reads them from here, so the "Sold: 4" chip on the count card and the
// `Qty: 4` the batch writes are guaranteed to be the same number.

/**
 * Billable consumption — stock that left the outlet since the last audit.
 *
 * `max(0, …)` because a count ABOVE system stock is not negative consumption; it is a
 * return, which `returnQty` claims instead. Without the floor, a surplus would quietly
 * subtract from the invoice.
 */
export function soldQty (systemQty, currentQty) {
  return Math.max(0, toNumber(systemQty) - toNumber(currentQty))
}

/**
 * Physical surplus — stock found at the outlet that the system did not know about, or a
 * damaged/expired unit entered by hand.
 *
 * The exact mirror of `soldQty`, so the two can never both be positive for one row and a
 * row can never be counted as both a sale and a return.
 */
export function returnQty (systemQty, currentQty) {
  return Math.max(0, toNumber(currentQty) - toNumber(systemQty))
}

/**
 * The default restock quantity for a counted row.
 *
 * Replenishment mirrors consumption: what was sold is what needs putting back. This is a
 * DEFAULT the user may override on the restock step, not a derived fact — which is why it
 * is a separate function rather than every caller reading `soldQty` and implying the rule.
 */
export function defaultRestockQty (systemQty, currentQty) {
  return soldQty(systemQty, currentQty)
}

/**
 * One count row, derived from an outlet storage row.
 *
 * `currentQty` starts AT the system quantity rather than at zero: the overwhelmingly
 * common audit outcome is "some of this sold", and seeding at zero would mean an officer
 * who skips a line has silently declared the entire shelf sold.
 */
export function buildCountRow (storage = {}, currentQty = null) {
  const entry = asRow(storage)
  const system = toNumber(entry.Quantity)
  const current = currentQty === null || currentQty === undefined ? system : toNumber(currentQty)
  return {
    SKU: text(entry.SKU),
    StorageName: text(entry.StorageName) || DEFAULT_STORAGE,
    SystemQty: system,
    CurrentQty: current,
    SoldQty: soldQty(system, current),
    ReturnQty: returnQty(system, current),
    isManualReturn: false
  }
}

/**
 * A manual return line for a SKU the outlet's storage does not carry.
 *
 * `SystemQty = 0` by construction, so the shared arithmetic above yields `SoldQty = 0` and
 * `ReturnQty = qty` with no special case anywhere downstream. A damaged unit is entered
 * exactly like a counted surplus, because that is what it is.
 */
export function buildManualReturnRow (sku, qty = 0) {
  const quantity = Math.max(0, toNumber(qty))
  return {
    SKU: text(sku),
    StorageName: DEFAULT_STORAGE,
    SystemQty: 0,
    CurrentQty: quantity,
    SoldQty: 0,
    ReturnQty: quantity,
    isManualReturn: true
  }
}

/** Re-derive a row's three quantities after the user changes the physical count. */
export function recountRow (row = {}, currentQty) {
  const entry = asRow(row)
  const system = toNumber(entry.SystemQty)
  const current = Math.max(0, toNumber(currentQty))
  return { ...entry, CurrentQty: current, SoldQty: soldQty(system, current), ReturnQty: returnQty(system, current) }
}

/** The rows that produce `OutletConsumptionItems` and negative movements. */
export function soldRowsOf (rows = []) {
  return (Array.isArray(rows) ? rows : []).map(asRow).filter((row) => toNumber(row.SoldQty) > 0)
}

/** The rows that produce `OutletReturns`. */
export function returnRowsOf (rows = []) {
  return (Array.isArray(rows) ? rows : []).map(asRow).filter((row) => toNumber(row.ReturnQty) > 0)
}

/**
 * The restock lines that will actually be requested.
 *
 * A different shape from the two above — restock rows are `{ SKU, Quantity }` collected on
 * step 4, not count rows — but it is the same question, so it is stated the same way and in
 * the same place. A zeroed line is not a restock; the wizard keeps it on screen until the
 * user leaves the step, and it is dropped here as well as there.
 */
export function restockRowsOf (rows = []) {
  return (Array.isArray(rows) ? rows : []).map(asRow)
    .filter((row) => text(row.SKU) && toNumber(row.Quantity) > 0)
}

// ─── The return matrix ────────────────────────────────────────────────────────
//
// Two independent booleans decide what a return does, and the four combinations are NOT
// intuitive — which is exactly why the truth table is one function rather than a condition
// re-written at each call site.
//
//  IAR = InvoiceAdjustmentRequired — the outlet is credited for the value.
//  WAR = WarehouseActionRequired   — the units physically leave for a warehouse.
//
//  IAR  WAR  destination            ledger QtyChange   next Progress
//   ✓    ✗   stays at the outlet    +ReturnQty         COMPLETED
//   ✗    ✓   ships to a warehouse   -ReturnQty         AWAITING_WAREHOUSE_RECEIPT
//   ✓    ✓   ships to a warehouse    0                 AWAITING_WAREHOUSE_RECEIPT
//   ✗    ✗   stays, written off      0                 COMPLETED
//
// The two zero rows are the ones worth stating out loud. Case 3 nets to zero because the
// surplus was never in the ledger to begin with and is now leaving — crediting it AND
// shipping it cancels out. Case 4 touches nothing at all: the unit stays where it is and
// nobody is paid for it.

export const RETURN_REASONS = ['DAMAGE', 'EXPIRED', 'SLOW_MOVING', 'RECALL', 'OVERSTOCK', 'SPECIFICATION_MISMATCH', 'OTHER']

/** The default routing for a newly-added return line: credit it, leave it at the outlet. */
export function defaultReturnMeta () {
  return {
    Reason: 'DAMAGE',
    ReasonComment: '',
    InvoiceAdjustmentRequired: true,
    WarehouseActionRequired: false,
    WarehouseCode: ''
  }
}

/**
 * The ledger movement a return line writes, per the matrix above.
 *
 * Returns `0` for both cases where the two flags agree with each other, which is the
 * result — not an omission. A caller filters zero movements out rather than writing an
 * empty ledger row.
 */
export function returnQtyChange (quantity, meta = {}) {
  const qty = Math.abs(toNumber(quantity))
  const iar = asRow(meta).InvoiceAdjustmentRequired === true
  const war = asRow(meta).WarehouseActionRequired === true
  if (iar && !war) return qty
  if (!iar && war) return -qty
  return 0
}

/** The Progress a newly-created return lands in, per the matrix above. */
export function returnProgressFor (meta = {}) {
  return asRow(meta).WarehouseActionRequired === true ? 'AWAITING_WAREHOUSE_RECEIPT' : 'COMPLETED'
}

/** Whether a return credits the invoice — the half of the matrix pricing cares about. */
export function creditsInvoice (meta = {}) {
  return asRow(meta).InvoiceAdjustmentRequired === true
}

// ─── Price resolution — adapters, not a second implementation ─────────────────

/**
 * The price list that applies to an outlet: its operating rule's, else the global default.
 *
 * Both halves of that precedence already live in `enrichOutlet` (which folds the outlet's
 * `OutletOperatingRules` row in and falls back to `defaultPriceList`), so this reads the
 * answer rather than recomputing it. Returns the ENRICHED price list, which already
 * carries the `priceMap` built under whichever lookup mode `AppConfigMap.PriceListLookup`
 * selected — so no caller ever branches on INLINE vs ITEMS.
 */
export function priceListForOutlet (outletCode) {
  const { getOutlet } = useOutletResource()
  const { defaultPriceList } = usePriceListResource()
  const outlet = getOutlet(text(outletCode))
  return outlet?.priceList || defaultPriceList?.value || null
}

/**
 * A SKU's unit price under a given price list, or `null` when it has none.
 *
 * `null` rather than `0`, deliberately: an unpriced SKU is a condition the invoice step
 * must SURFACE, and silently billing it at zero is how a consignment gets given away.
 * `validateConsumption` treats it as an error when an invoice is being generated.
 */
export function priceOf (sku, priceListCode = '') {
  const { getPriceOf, defaultPriceList } = usePriceListResource()
  const code = text(priceListCode) || defaultPriceList?.value?.code || ''
  const price = getPriceOf(text(sku), code)
  return price === null || price === undefined ? null : toNumber(price)
}

/** Line value for a quantity at a resolved price. `null` price yields `0` value. */
export function lineTotal (qty, price) {
  return toNumber(qty) * toNumber(price)
}

/**
 * The monetary credit a set of return lines applies to the invoice.
 *
 * Only lines whose `InvoiceAdjustmentRequired` is set contribute — a return shipped back
 * without a credit reduces stock, not the bill.
 */
export function returnDeductionTotal (returnRows = [], metaOf = () => ({}), priceListCode = '') {
  return (Array.isArray(returnRows) ? returnRows : []).map(asRow).reduce((total, row) => {
    if (!creditsInvoice(metaOf(row.SKU))) return total
    return total + lineTotal(row.ReturnQty, priceOf(row.SKU, priceListCode) ?? 0)
  }, 0)
}

/** A flat or percentage discount, resolved against a subtotal. Never exceeds the subtotal. */
export function discountAmount (subtotal, type = 'FLAT', value = 0) {
  const base = toNumber(subtotal)
  const raw = text(type).toUpperCase() === 'PERCENT'
    ? base * (toNumber(value) / 100)
    : toNumber(value)
  return Math.min(Math.max(0, raw), base)
}

// ─── The validation gate ──────────────────────────────────────────────────────

/**
 * Everything that must be true before a consumption may be submitted.
 *
 * PURE and caller-fed: outlet storages arrive as an argument rather than being fetched, so
 * the same function validates the wizard's live rows and a replayed payload identically.
 *
 * Returns `{ valid, errors, warnings }`. Warnings do not block — an unpriced SKU is only
 * an error when an invoice is actually being generated, and is worth saying either way.
 *
 * ── THE "SOMETHING HAPPENED" RULE ──
 * A consumption needs at least one operational effect, and a RESTOCK is one of them. An
 * audit that counted every shelf exactly as the system had it, found no damage, and left a
 * replenishment request behind is a legitimate visit — the officer did the work and the
 * outlet is getting stock. Requiring a sale would force them to invent one.
 *
 * The check is SUBMIT-ONLY (`options.submitting`), and that is what makes the wizard
 * navigable: the restock lines are collected on step 4, so applying it while the user is
 * still on step 2 would refuse to let them reach the step where they would satisfy it.
 */
export function validateConsumption (form = {}, rows = [], storages = [], options = {}) {
  const errors = []
  const warnings = []
  const entry = asRow(form)

  if (!text(entry.OutletCode)) errors.push('Select an outlet before submitting.')
  if (!text(entry.Date)) errors.push('A consumption date is required.')
  if (!text(entry.Username)) errors.push('A recording user is required.')

  const sold = soldRowsOf(rows)
  const returns = returnRowsOf(rows)
  const restocks = restockRowsOf(options.restockRows)

  if (options.submitting && !sold.length && !returns.length && !restocks.length) {
    errors.push('At least one sold item, return item, or restock item is required to record a consumption.')
  }

  // One pass to index the outlet's stock, then O(1) per row. A `.find()` per row over the
  // storages array would be O(n×m) and re-run on every reactive invalidation
  // (CORE_ARCHITECTURE_RULES §6 — Indexed Joins, Never Linear Scans).
  //
  // Skipped outright when nothing sold: the whole index exists to answer "did this line
  // consume more than the outlet held", and on a restock-only audit there is no such line
  // to ask about — indexing every storage row to then loop over nothing is pure cost.
  const available = new Map()
  ;(sold.length ? (Array.isArray(storages) ? storages : []) : []).map(asRow).forEach((storage) => {
    if (!isActive(storage)) return
    if (text(storage.OutletCode) !== text(entry.OutletCode)) return
    const sku = text(storage.SKU)
    if (!sku) return
    available.set(sku, (available.get(sku) || 0) + toNumber(storage.Quantity))
  })

  const seen = new Set()
  sold.forEach((row) => {
    const sku = text(row.SKU)
    if (!sku) {
      errors.push('Every counted line needs a SKU.')
      return
    }
    if (seen.has(sku)) errors.push(`${sku} appears on more than one line.`)
    seen.add(sku)

    // A count cannot consume more than the outlet was recorded as holding. This is the one
    // check that catches a mistyped physical count before it writes a negative balance.
    const stock = available.get(sku) || 0
    const qty = toNumber(row.SoldQty)
    if (qty > stock) {
      errors.push(`${sku}: counted ${qty} sold but the outlet only holds ${stock}.`)
    }
  })

  if (options.generateInvoice) {
    const priceListCode = text(options.priceListCode)
    if (!priceListCode) errors.push('No price list resolves for this outlet — an invoice cannot be priced.')
    sold.forEach((row) => {
      // Strictly `null` — a legitimately free line priced at 0 is not an error, an
      // UNPRICED line is. Collapsing the two would bill a missing price as a giveaway.
      if (priceOf(row.SKU, priceListCode) === null) {
        errors.push(`${text(row.SKU)} has no price in this price list.`)
      }
    })
  }

  if (options.directRestock && !text(options.warehouseCode)) {
    errors.push('Select a source warehouse for the direct restock.')
  }

  returns.forEach((row) => {
    const meta = asRow(options.returnMetaOf ? options.returnMetaOf(row.SKU) : {})
    if (meta.WarehouseActionRequired === true && !text(meta.WarehouseCode)) {
      errors.push(`${text(row.SKU)} is routed to a warehouse but none is selected.`)
    }
  })

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Warehouse stock available for a SKU at one warehouse.
 *
 * Used by the restock step to say, before submission, which lines the warehouse can
 * actually cover — so a partial allocation is a stated outcome rather than a surprise.
 */
export function warehouseAvailableQty (sku, warehouseCode, warehouseStorages = []) {
  const skuCode = text(sku)
  const warehouse = text(warehouseCode)
  if (!skuCode || !warehouse) return 0
  return (Array.isArray(warehouseStorages) ? warehouseStorages : [])
    .map(asRow)
    .filter(isActive)
    .filter((entry) => text(entry.SKU) === skuCode && text(entry.WarehouseCode) === warehouse)
    .reduce((total, entry) => total + toNumber(entry.Quantity), 0)
}

/**
 * "What can the source warehouse cover for this restock" is an OutletRestocks question, so
 * `splitByWarehouseStock` is owned by
 * `_resource/Operation/OutletRestocks/composables/useRestockStockMatch.js` and merely
 * re-exported here — one definition, read by both modules (§3.3). Every existing caller
 * keeps its import line.
 */
export { splitByWarehouseStock }

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useConsumptionStock () {
  return {
    DEFAULT_STORAGE,
    RETURN_REASONS,
    toNumber,
    soldQty,
    returnQty,
    defaultRestockQty,
    buildCountRow,
    buildManualReturnRow,
    recountRow,
    soldRowsOf,
    returnRowsOf,
    restockRowsOf,
    defaultReturnMeta,
    returnQtyChange,
    returnProgressFor,
    creditsInvoice,
    priceListForOutlet,
    priceOf,
    lineTotal,
    returnDeductionTotal,
    discountAmount,
    validateConsumption,
    warehouseAvailableQty,
    splitByWarehouseStock
  }
}
