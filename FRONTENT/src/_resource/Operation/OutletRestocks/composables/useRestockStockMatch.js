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

const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

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

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useRestockStockMatch () {
  return {
    maxRestockQuantity,
    clampRestockQuantity,
    stockMatchFigures
  }
}
