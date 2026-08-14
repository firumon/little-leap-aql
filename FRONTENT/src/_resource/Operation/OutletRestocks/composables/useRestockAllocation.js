/**
 * OutletRestocks › allocation — Layer 2, the stock-allocation aggregate and algorithm.
 *
 * "Which physical bins does this requested line draw from, and what is left over?" is a
 * domain question, not a presentation one: the same answer must hold whichever UI asks
 * it, and it decides what gets written to `StockMovements`. So the bin keying, the
 * least-quantity-first draw, the plan netting, and the two row-splitting translations
 * live here (UI_RESOURCE_DOMAIN_LOGIC.md §3 — "stateful workflow aggregates that
 * back a wizard/action page").
 *
 * What stays in the UI half (`_ui/.../Outlets/useRestockApproval.js`) is everything that
 * needs a component: the `inject()`ed `pageState` the plan is stored on, the reactive
 * projections the four cards render, and the SKU/warehouse label lookups.
 *
 * Named PURE exports + a `useRestockAllocation()` wrapper (§5). Nothing here injects,
 * holds reactive state, renders, or touches a store.
 */

const DEFAULT_STORAGE = '_default'

const text = (value) => String(value ?? '').trim()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Normalize anything out of a records array into a safe object.
 *
 * `useRecord().items` CAN CONTAIN `null`. It maps every store row through
 * `enrichRecord(name, row.Code, …)`, which returns `null` outright when the row
 * has no `Code` — and the map is 1:1, so that `null` lands in the array. A row
 * without a Code is reachable in normal operation: a freshly written row is
 * hydrated from a batch response before its generated Code comes back.
 *
 * Optional chaining alone is not enough to survive this, and that is exactly how
 * the crash happened. A `Status` guard written as `row?.Status || 'Active'`
 * returns `'Active'` for `null`, so the null passes the active filter and the
 * NEXT predicate — reading `row.SKU` — throws. Every row read in this file is
 * funnelled through `asRow` so a null degrades to an empty object and is then
 * dropped by the field checks, instead of being waved through by one guard and
 * dereferenced by the next.
 */
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'
const storageOf = (value) => text(value) || DEFAULT_STORAGE

// A storage bin is addressed by warehouse + storage; stock in it is addressed by
// that pair PLUS the SKU. Both keys are built here so the plan, the availability
// netting and the emitted rows can never disagree on what "the same bin" means.
export function binKey (warehouseCode, storageName) {
  return `${text(warehouseCode)}|${text(storageName)}`
}
export function stockKey (sku, warehouseCode, storageName) {
  return `${text(sku)}|${binKey(warehouseCode, storageName)}`
}

/**
 * Every storage bin holding `skuCode`, as raw on-hand candidates.
 *
 * Null-safe against the `null` entries `useRecord().items` can carry (see
 * `asRow`): a non-object entry becomes `{}`, whose blank warehouse/storage then
 * fails the final filter, so it is dropped rather than dereferenced. The order of
 * the guards matters — the SKU comparison reads through `asRow`, never off the
 * raw entry, which is precisely the read that used to throw.
 *
 * Empty and negative bins are excluded: a bin with nothing in it is not a
 * candidate, and a negative balance is a data fault that must not be presented as
 * available stock.
 */
export function storageBinsForSku (storages = [], skuCode = '') {
  const target = text(skuCode)
  if (!target) return []
  return (Array.isArray(storages) ? storages : [])
    .map(asRow)
    .filter(isActive)
    .filter((entry) => text(entry.SKU) === target)
    .map((entry) => ({
      id: binKey(entry.WarehouseCode, storageOf(entry.StorageName)),
      warehouseCode: text(entry.WarehouseCode),
      storageName: storageOf(entry.StorageName),
      available: num(entry.Quantity)
    }))
    .filter((bin) => bin.warehouseCode && bin.storageName && bin.available > 0)
}

/**
 * The location-emptying strategy: draw from the SMALLEST bins first so the maximum
 * number of storage locations end up completely empty.
 *
 * `storageBinsForSku` returns raw on-hand figures; it cannot see quantities this
 * same plan has already committed to a bin for another line. So the sort is
 * applied here over the NETTED availability, with the bin key as the tie-break so
 * two equally stocked bins are drawn in a stable order rather than whichever the
 * store happened to return first.
 */
export function sortBinsLeastFirst (bins = []) {
  return bins.slice().sort((a, b) =>
    num(a.available) - num(b.available) ||
    binKey(a.warehouseCode, a.storageName).localeCompare(binKey(b.warehouseCode, b.storageName))
  )
}

/**
 * Draw `requestedQty` from `bins`, smallest bin first.
 *
 * Returns the allocation lines plus whatever could not be covered. The remainder
 * is returned rather than thrown away because it is a first-class outcome: it
 * becomes the PENDING line the approver either leaves for a later allocation or
 * cancels outright.
 */
export function drawLeastQuantityFirst (bins = [], requestedQty = 0) {
  let remainder = Math.max(0, num(requestedQty))
  const lines = []
  sortBinsLeastFirst(bins).forEach((bin) => {
    if (remainder <= 0) return
    const quantity = Math.min(num(bin.available), remainder)
    if (quantity <= 0) return
    lines.push({ warehouseCode: bin.warehouseCode, storageName: bin.storageName, quantity })
    remainder -= quantity
  })
  return { lines, remainder }
}

// Total already committed to each (SKU, bin) across the WHOLE plan. Netting off
// this is what stops two requested lines for the same SKU from both being
// allocated the same physical units.
export function planConsumption (plan = {}, itemsBySku = {}) {
  const totals = {}
  Object.entries(plan).forEach(([code, entry]) => {
    const sku = itemsBySku[code]
    if (!sku) return
    ;(entry?.lines || []).forEach((line) => {
      const key = stockKey(sku, line.warehouseCode, line.storageName)
      totals[key] = (totals[key] || 0) + num(line.quantity)
    })
  })
  return totals
}

export function planAllocatedQty (entry) {
  return (entry?.lines || []).reduce((sum, line) => sum + num(line.quantity), 0)
}

/**
 * Translate one requested item + its plan entry into the row shape
 * `buildRestockAllocationBatchRequests` consumes (initial approval).
 *
 * The ORIGINAL row's `Code` is attached to exactly one emitted row, so a Code is
 * never written twice in one batch:
 *   remainder > 0  → the original row becomes the PENDING remainder; every
 *                    allocated bin is a NEW row.
 *   remainder == 0 → the original row becomes the first ALLOCATED bin; the rest
 *                    are new rows.
 * A cancelled remainder still emits the PENDING row here — the cancellation is a
 * separate `executeAction` against the same Code later in the batch, which is
 * what stamps it CANCELLED without a stock movement.
 */
export function splitApprovalRows (item = {}, entry = {}) {
  const code = text(item.Code)
  const requested = num(item.Quantity)
  const lines = (entry?.lines || []).filter((line) => num(line.quantity) > 0)
  const remainder = Math.max(requested - planAllocatedQty(entry), 0)
  const base = { SKU: text(item.SKU), OutletRestockCode: text(item.OutletRestockCode), Status: 'Active' }

  const rows = lines.map((line, index) => ({
    ...base,
    ...(index === 0 && remainder === 0 && code ? { Code: code } : {}),
    WarehouseCode: text(line.warehouseCode),
    StorageName: text(line.storageName),
    Quantity: num(line.quantity),
    Progress: 'ALLOCATED'
  }))

  if (remainder > 0) {
    rows.push({
      ...base,
      ...(code ? { Code: code } : {}),
      WarehouseCode: '',
      StorageName: '',
      Quantity: remainder,
      Progress: 'PENDING'
    })
  }
  return rows
}

/**
 * Translate the same plan into the row shape
 * `buildPendingRestockAllocationBatchRequests` consumes (later allocation).
 *
 * That builder groups by a SOURCE code, so the untouched source row is emitted
 * alongside the allocated bins, each tagged with `_pendingSourceCode`. It decides
 * for itself whether the source row is reused, left as a smaller remainder, or
 * deactivated — which is why nothing here attaches a `Code` to a bin row.
 */
export function pendingAllocationRows (item = {}, entry = {}) {
  const code = text(item.Code)
  const requested = num(item.Quantity)
  const base = { SKU: text(item.SKU), OutletRestockCode: text(item.OutletRestockCode), Status: 'Active' }
  const source = { ...base, Code: code, Quantity: requested, Progress: 'PENDING', _approvalRequestedQty: requested }

  const allocated = (entry?.lines || [])
    .filter((line) => num(line.quantity) > 0)
    .map((line) => ({
      ...base,
      WarehouseCode: text(line.warehouseCode),
      StorageName: text(line.storageName),
      Quantity: num(line.quantity),
      Progress: 'ALLOCATED',
      _pendingSourceCode: code,
      _approvalRequestedQty: requested
    }))

  return [source, ...allocated]
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useRestockAllocation () {
  return {
    binKey,
    stockKey,
    storageBinsForSku,
    sortBinsLeastFirst,
    drawLeastQuantityFirst,
    planConsumption,
    planAllocatedQty,
    splitApprovalRows,
    pendingAllocationRows
  }
}
