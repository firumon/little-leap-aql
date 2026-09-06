// OutletConsumptions stock maths, the return matrix, and the submit validation gate.
// Layer 2, pure: plain rows in, plain values out. Price lists are NOT resolved here —
// `priceOf` is a thin adapter onto Master/PriceLists and Master/Outlets.

import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { splitByWarehouseStock } from 'src/_resource/Operation/OutletRestocks/composables/useRestockStockMatch'
import {
  indexWarehouseStock,
  stockOf as warehouseStockOf
} from 'src/_resource/Operation/WarehouseStorages/composables/useWarehouseStorageResource'
// The return matrix is described here but OWNED by OutletReturns (§10.1), so both helpers
// below delegate to it.
import { returnQtyChange as returnDomainQtyChange } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { deriveReturnProgress, REASONS } from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

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

// Billable consumption. `max(0, …)` because a count ABOVE system stock is a return, which
// `returnQty` claims instead.
export function soldQty (systemQty, currentQty) {
  return Math.max(0, toNumber(systemQty) - toNumber(currentQty))
}

// Physical surplus — the exact mirror of `soldQty`, so no row can be both.
export function returnQty (systemQty, currentQty) {
  return Math.max(0, toNumber(currentQty) - toNumber(systemQty))
}

// A DEFAULT the user may override on the restock step, not a derived fact.
export function defaultRestockQty (systemQty, currentQty) {
  return soldQty(systemQty, currentQty)
}

// Count rows rebuilt from the wizard's own nodes, so the node graph needs no second copy.
export function countRowsOf (soldItems = [], returnRecords = [], storages = [], outletCode = '') {
  const outlet = text(outletCode)
  const shelf = new Map()
  ;(Array.isArray(storages) ? storages : []).map(asRow).forEach((row) => {
    if (!isActive(row) || text(row.OutletCode) !== outlet) return
    const sku = text(row.SKU)
    if (!sku) return
    const held = shelf.get(sku)
    shelf.set(sku, {
      StorageName: held?.StorageName || text(row.StorageName) || DEFAULT_STORAGE,
      SystemQty: (held?.SystemQty || 0) + toNumber(row.Quantity)
    })
  })

  const totalBySku = (rows) => (Array.isArray(rows) ? rows : []).map(asRow).reduce((map, row) => {
    const sku = text(row.SKU)
    if (sku) map.set(sku, (map.get(sku) || 0) + toNumber(row.Qty))
    return map
  }, new Map())

  const sold = totalBySku(soldItems)
  const returned = totalBySku(returnRecords)

  return [...new Set([...sold.keys(), ...returned.keys()])].map((sku) => {
    const held = shelf.get(sku)
    const system = held?.SystemQty || 0
    const soldQty = sold.get(sku) || 0
    const returnQty = returned.get(sku) || 0
    return {
      SKU: sku,
      StorageName: held?.StorageName || DEFAULT_STORAGE,
      SystemQty: system,
      CurrentQty: Math.max(0, system - soldQty + returnQty),
      SoldQty: soldQty,
      ReturnQty: returnQty,
      isManualReturn: !held
    }
  })
}

/** One positive-quantity filter for every row shape this module handles. */
export function positiveRows (rows = [], key = 'Qty') {
  return (Array.isArray(rows) ? rows : []).map(asRow).filter((row) => toNumber(row[key]) > 0)
}

/** The rows that produce `OutletConsumptionItems` and negative movements. */
export function soldRowsOf (rows = []) {
  return positiveRows(rows, 'SoldQty')
}

/** The rows that produce `OutletReturns`. */
export function returnRowsOf (rows = []) {
  return positiveRows(rows, 'ReturnQty')
}

// A zeroed or SKU-less line is not a restock request.
function restockRowsOf (rows = []) {
  return positiveRows(rows, 'Quantity').filter((row) => text(row.SKU))
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
//   ✓    ✗   stays at the outlet    +ReturnQty         SUBMITTED (credit still owed)
//   ✗    ✓   ships to a warehouse   -ReturnQty         SUBMITTED (receipt still owed)
//   ✓    ✓   ships to a warehouse    0                 SUBMITTED (both still owed)
//   ✗    ✗   stays, written off      0                 COMPLETED (nothing owed)
//
// The Progress column is NOT derived from WAR alone, which is what this file used to do.
// A return lands COMPLETED only when every track it flagged as required is already
// resolved — and at creation none of them are — so the only row born complete is the one
// that asked for nothing. See `isReturnCompleted` in the OutletReturns domain.
//
// The two zero rows are the ones worth stating out loud. Case 3 nets to zero because the
// surplus was never in the ledger to begin with and is now leaving — crediting it AND
// shipping it cancels out. Case 4 touches nothing at all: the unit stays where it is and
// nobody is paid for it.

// The reason codes belong to OutletReturns, which owns the rows. Re-exported, never restated.
export const RETURN_REASONS = REASONS

// The ledger movement a return line writes. `0` when the two flags agree — a result, not
// an omission; the caller drops zero movements.
export function returnQtyChange (quantity, meta = {}) {
  return returnDomainQtyChange(quantity, {
    invoiceRequired: asRow(meta).InvoiceAdjustmentRequired === true,
    warehouseRequired: asRow(meta).WarehouseActionRequired === true
  })
}

// The Progress a fresh return lands in. Asked of the row as OutletReturns will store it,
// so the wizard's preview banner and the written row can never disagree.
export function returnProgressFor (meta = {}) {
  const row = asRow(meta)
  return deriveReturnProgress({
    InvoiceAdjustmentRequired: row.InvoiceAdjustmentRequired === true ? 'TRUE' : 'FALSE',
    InvoiceAdjustmentDone: 'FALSE',
    WarehouseActionRequired: row.WarehouseActionRequired === true ? 'TRUE' : 'FALSE',
    WarehouseActionCompleted: 'FALSE'
  })
}

/** Whether a return credits the invoice — the half of the matrix pricing cares about. */
export function creditsInvoice (meta = {}) {
  return asRow(meta).InvoiceAdjustmentRequired === true
}

// ─── Price resolution — adapters, not a second implementation ─────────────────

// The outlet's price list: its operating rule's, else the global default. Read, not
// recomputed — `enrichOutlet` already holds both halves of that precedence.
export function priceListForOutlet (outletCode) {
  const { getOutlet } = useOutletResource()
  const { defaultPriceList } = usePriceListResource()
  const outlet = getOutlet(text(outletCode))
  return outlet?.priceList || defaultPriceList?.value || null
}

// A SKU's unit price, or `null` when it has none. `null` rather than `0`, deliberately:
// silently billing an unpriced SKU at zero is how a consignment gets given away.
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

// Only lines flagged `InvoiceAdjustmentRequired` credit the bill.
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

// Everything that must be true before a consumption may be submitted. Pure and caller-fed.
// A restock counts as an operational effect, so a count-and-replenish visit is legitimate.
// The "at least one of the three" rule is submit-only, or step 2 would refuse to let the
// user reach step 4 where they would satisfy it.
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
      // The REVIEWED price wins. Step 3 offers a unit price for a SKU the list does not
      // carry, so reading the list alone called a line unpriced that the officer had
      // already priced, and froze the whole chain.
      const reviewed = options.resolvePrice ? options.resolvePrice(row.SKU) : null
      if (reviewed !== null && reviewed !== undefined && reviewed !== '') return
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

// Warehouse stock for one SKU, so the restock step can say what the warehouse can cover.
export function warehouseAvailableQty (sku, warehouseCode, warehouseStorages = []) {
  const skuCode = text(sku)
  const warehouse = text(warehouseCode)
  if (!skuCode || !warehouse) return 0
  // Read out of the `WarehouseStorages` index rather than re-summing the sheet: that
  // resource owns the warehouse × SKU totals (§10.4). `warehouseStorages` may be raw rows
  // OR an already-built index — a caller asking per row passes the index and pays for the
  // pass once instead of once per line.
  const index = warehouseStorages && warehouseStorages.stockByWarehouseAndSku
    ? warehouseStorages
    : indexWarehouseStock(warehouseStorages)
  return warehouseStockOf(index, warehouse, skuCode)
}

// Owned by OutletRestocks' useRestockStockMatch.js, re-exported so both modules read one
// definition (§3.3).
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
    countRowsOf,
    positiveRows,
    soldRowsOf,
    returnRowsOf,
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
