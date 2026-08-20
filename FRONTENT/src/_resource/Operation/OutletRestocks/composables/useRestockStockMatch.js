/**
 * OutletRestocks › stock match — Layer 2, the request-quantity arithmetic.
 *
 * "How much will the outlet hold if this request is fulfilled, what does that leave in
 * the source warehouse, and how much is this line even allowed to ask for?" are domain
 * questions (UI_RESOURCE_DOMAIN_LOGIC.md §3): the ceiling in particular is a business
 * rule — a DIRECT restock moves real units and cannot exceed the source warehouse, while
 * a standard request is unbounded because an approver allocates against real stock later.
 *
 * What stays in the UI half (`_ui/.../Add/useRestockStockMatch.js`) is the projection the
 * two step-2 cards render, the `useProductSkuResolver` label lookup, the `inject()`ed
 * `pageState`, and the child-row bookkeeping — all presentation and page mechanics.
 *
 * Named PURE exports + a `useRestockStockMatch()` wrapper (§5). Nothing here injects,
 * holds reactive state, renders, or touches a store.
 */

import {
  indexWarehouseStock,
  stockMapOf as warehouseStockMapOf
} from 'src/_resource/Operation/WarehouseStorages/composables/useWarehouseStorageResource'

const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})

/**
 * The ceiling one requested line may reach.
 *
 * Standard requests are unbounded — the approver allocates against real stock later.
 * Direct allocation moves units out of a named warehouse immediately, so it cannot
 * exceed what that warehouse holds.
 */
export function maxRestockQuantity (warehouseQuantity, isDirect) {
  return isDirect === true ? num(warehouseQuantity) : Infinity
}

/**
 * A requested quantity, coerced into the legal range.
 *
 * Whole units only, never negative, never above the ceiling. `Infinity` as the ceiling
 * leaves the value untouched, which is what makes a standard request unbounded.
 */
export function clampRestockQuantity (value, maxQuantity = Infinity) {
  return Math.min(Math.max(0, Math.floor(num(value))), maxQuantity)
}

/**
 * The three derived figures every stock-match row states.
 *
 * `finalQuantity` is what the outlet ends up holding; `warehouseRemaining` is what the
 * source warehouse is left with. Both are stated here rather than in each card so the
 * "existing" list and the "new" list cannot compute them differently.
 */
export function stockMatchFigures ({ outletQuantity = 0, warehouseQuantity = 0, restockQuantity = 0, isDirect = false } = {}) {
  const outlet = num(outletQuantity)
  const warehouse = num(warehouseQuantity)
  const restock = num(restockQuantity)
  return {
    outletQuantity: outlet,
    warehouseQuantity: warehouse,
    restockQuantity: restock,
    finalQuantity: outlet + restock,
    warehouseRemaining: warehouse - restock,
    maxQuantity: maxRestockQuantity(warehouse, isDirect)
  }
}

/**
 * Split restock lines into what the warehouse can cover now and what it cannot.
 *
 * The covered half becomes `ALLOCATED` item rows against the source warehouse; the rest
 * stays `PENDING` for a later allocation. A line partially covered appears in BOTH halves,
 * which is what lets a direct restock ship what it has instead of failing whole.
 *
 * "What can this warehouse cover for this restock" is an OutletRestocks question, so the
 * answer lives here. `useConsumptionStock.js` re-exports it, so the consumption wizard —
 * the first caller to ask — keeps its import line and there is still ONE definition (§3.3).
 *
 * Indexed in one pass rather than rescanned per line (CORE_ARCHITECTURE_RULES §6).
 */
export function splitByWarehouseStock (rows = [], warehouseCode = '', warehouseStorages = []) {
  // The warehouse's per-SKU totals are NOT summed here: `WarehouseStorages` owns that index
  // (§10.4), and this file reads it. A MUTABLE COPY, because the allocation below decrements
  // as it goes — the shared index is a read-only projection and must never be written to.
  // `warehouseStorages` may be raw rows or an already-built index; both resolve the same way.
  const source = warehouseStorages && warehouseStorages.stockByWarehouseAndSku
    ? warehouseStorages
    : indexWarehouseStock(warehouseStorages)
  const stock = new Map(warehouseStockMapOf(source, warehouseCode))

  const allocated = []
  const pending = []
  ;(Array.isArray(rows) ? rows : []).map(asRow).forEach((row) => {
    const sku = text(row.SKU)
    const wanted = num(row.Quantity)
    if (!sku || wanted <= 0) return
    const onHand = stock.get(sku) || 0
    const covered = Math.min(wanted, onHand)
    if (covered > 0) {
      allocated.push({ SKU: sku, Quantity: covered })
      // Decremented so two lines for the same SKU cannot each claim the whole shelf.
      stock.set(sku, onHand - covered)
    }
    if (wanted - covered > 0) pending.push({ SKU: sku, Quantity: wanted - covered })
  })

  return { allocated, pending, shortfall: pending.reduce((total, row) => total + row.Quantity, 0) }
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useRestockStockMatch () {
  return {
    maxRestockQuantity,
    clampRestockQuantity,
    stockMatchFigures,
    splitByWarehouseStock
  }
}
