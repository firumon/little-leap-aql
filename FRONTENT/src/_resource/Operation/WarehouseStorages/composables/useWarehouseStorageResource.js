/**
 * WarehouseStorages › what each warehouse actually holds — Layer 2, this resource's own
 * domain module and the app's ONE warehouse stock index.
 *
 * The mirror of `OutletStorages`, and for the same reason. `WarehouseStorages` is a DERIVED
 * balance sheet — a post-write hook on `StockMovements` rewrites it, nothing in the frontend
 * edits it — and what the frontend does do, constantly, is ASK it: "how much of this SKU can
 * this warehouse cover", once per line, inside a loop over the restock's items, on every
 * keystroke of a quantity field. A `.filter()` per question is an O(N×M) rescan that reruns
 * on every reactive invalidation.
 *
 * ── THE INDEXES ──
 * One pass over the sheet builds five lookups, and every question after that is O(1):
 *
 *   stockByWarehouseAndSku  Map<WarehouseCode, Map<SKU, qty>>  "what does this warehouse hold"
 *   stockBySkuAndWarehouse  Map<SKU, Map<WarehouseCode, qty>>  "which warehouse has this SKU"
 *   totalStockByWarehouse   Map<WarehouseCode, qty>            one warehouse's total units
 *   totalStockBySku         Map<SKU, qty>                      one SKU's units across the estate
 *   rowsByWarehouse         Map<WarehouseCode, row[]>          the raw bin rows a card lists
 *
 * A SKU can sit in several named bins in one warehouse, so quantities are SUMMED into the
 * index rather than assigned — assignment would let the last bin silently win, and an
 * allocation screen would offer stock the warehouse does not have.
 *
 * ── NON-DESTRUCTIVE ──
 * `rowsByWarehouse` carries the RAW rows, untouched and unnarrowed, so a caller that needs
 * `StorageName` — the bin, which the quantity indexes deliberately collapse — still has
 * every column. The indexes are the fast path, not a replacement for the rows.
 *
 * PURE + shared (§5, §10.4): the index builder takes plain rows so a `PageAction.js` outside
 * any setup context can index a payload, while setup-context callers read the memoized
 * computeds through `useWarehouseStorageResource()`.
 */

import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { defineSharedComposable } from 'src/utils/appHelpers'

const RESOURCE_NAME = 'WarehouseStorages'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const isActiveRow = (value) => {
  const status = text(asRow(value).Status)
  return !status || status.toUpperCase() === 'ACTIVE'
}

/** Add `qty` into a nested `Map<outer, Map<inner, number>>`, creating the inner map once. */
function addNested (map, outer, inner, qty) {
  let bucket = map.get(outer)
  if (!bucket) {
    bucket = new Map()
    map.set(outer, bucket)
  }
  bucket.set(inner, (bucket.get(inner) || 0) + qty)
}

/**
 * Every index this module offers, built in ONE pass over the rows.
 *
 * Deactivated rows are skipped — a soft-deleted balance is not stock. Rows with no warehouse
 * or no SKU are skipped too: they cannot answer any question either index is asked.
 */
export function indexWarehouseStock (rows = []) {
  const stockByWarehouseAndSku = new Map()
  const stockBySkuAndWarehouse = new Map()
  const totalStockByWarehouse = new Map()
  const totalStockBySku = new Map()
  const rowsByWarehouse = new Map()

  ;(Array.isArray(rows) ? rows : []).forEach((entry) => {
    const row = asRow(entry)
    if (!isActiveRow(row)) return

    const warehouse = text(row.WarehouseCode)
    const sku = text(row.SKU)
    if (!warehouse || !sku) return

    const qty = num(row.Quantity)

    addNested(stockByWarehouseAndSku, warehouse, sku, qty)
    addNested(stockBySkuAndWarehouse, sku, warehouse, qty)
    totalStockByWarehouse.set(warehouse, (totalStockByWarehouse.get(warehouse) || 0) + qty)
    totalStockBySku.set(sku, (totalStockBySku.get(sku) || 0) + qty)

    const bucket = rowsByWarehouse.get(warehouse)
    if (bucket) bucket.push(row)
    else rowsByWarehouse.set(warehouse, [row])
  })

  return { stockByWarehouseAndSku, stockBySkuAndWarehouse, totalStockByWarehouse, totalStockBySku, rowsByWarehouse }
}

/** How much of one SKU one warehouse holds, across all its bins. `0` when it holds none. */
export function stockOf (index, warehouseCode, skuCode) {
  return index?.stockByWarehouseAndSku?.get(text(warehouseCode))?.get(text(skuCode)) || 0
}

/** One warehouse's stock as `Map<SKU, qty>`. Empty map when the warehouse holds nothing. */
export function stockMapOf (index, warehouseCode) {
  return index?.stockByWarehouseAndSku?.get(text(warehouseCode)) || new Map()
}

/**
 * One warehouse's stock as a plain `{ [SKU]: qty }` object.
 *
 * Offered beside the `Map` because the restock cards index by bracket access in their render
 * loops; handing them an object keeps those call sites unchanged while the O(N×M) scan behind
 * them disappears.
 */
export function stockObjectOf (index, warehouseCode) {
  const bucket = index?.stockByWarehouseAndSku?.get(text(warehouseCode))
  if (!bucket) return {}
  const out = {}
  bucket.forEach((qty, sku) => { out[sku] = qty })
  return out
}

/** Which warehouses hold a SKU, as `Map<WarehouseCode, qty>` — the reverse lookup. */
export function warehousesHolding (index, skuCode) {
  return index?.stockBySkuAndWarehouse?.get(text(skuCode)) || new Map()
}

/** One warehouse's total units across every SKU and bin. */
export function totalStockOf (index, warehouseCode) {
  return index?.totalStockByWarehouse?.get(text(warehouseCode)) || 0
}

/** One SKU's total units across every warehouse. */
export function totalStockOfSku (index, skuCode) {
  return index?.totalStockBySku?.get(text(skuCode)) || 0
}

/** The raw bin rows of one warehouse, non-zero balances first — what a stock card lists. */
export function stockRowsOf (index, warehouseCode) {
  return [...(index?.rowsByWarehouse?.get(text(warehouseCode)) || [])]
    .filter((row) => num(row.Quantity) !== 0)
    .sort((a, b) => num(b.Quantity) - num(a.Quantity))
}

/**
 * Reactive shape for setup-context callers.
 *
 * ONCE PER APP (CORE_ARCHITECTURE_RULES §6): the pass over the storage sheet runs one time
 * per data change, and every wizard, allocation screen and metric reads the same memoized
 * indexes. The getters below drop the `index` argument — the shared computed supplies it.
 */
const shared = defineSharedComposable((dataStore) => {
  const rawStorages = computed(() => (dataStore.getRecords(RESOURCE_NAME) || []).map(asRow))

  const index = computed(() => indexWarehouseStock(rawStorages.value))

  const stockByWarehouseAndSku = computed(() => index.value.stockByWarehouseAndSku)
  const stockBySkuAndWarehouse = computed(() => index.value.stockBySkuAndWarehouse)
  const totalStockByWarehouse = computed(() => index.value.totalStockByWarehouse)
  const totalStockBySku = computed(() => index.value.totalStockBySku)
  const rowsByWarehouse = computed(() => index.value.rowsByWarehouse)

  return {
    RESOURCE_NAME,
    rawStorages,
    index,

    // Indexes.
    stockByWarehouseAndSku,
    stockBySkuAndWarehouse,
    totalStockByWarehouse,
    totalStockBySku,
    rowsByWarehouse,

    // O(1) projections.
    stockOf: (warehouseCode, skuCode) => stockOf(index.value, warehouseCode, skuCode),
    stockMapOf: (warehouseCode) => stockMapOf(index.value, warehouseCode),
    stockObjectOf: (warehouseCode) => stockObjectOf(index.value, warehouseCode),
    warehousesHolding: (skuCode) => warehousesHolding(index.value, skuCode),
    totalStockOf: (warehouseCode) => totalStockOf(index.value, warehouseCode),
    totalStockOfSku: (skuCode) => totalStockOfSku(index.value, skuCode),
    stockRowsOf: (warehouseCode) => stockRowsOf(index.value, warehouseCode)
  }
})

export function useWarehouseStorageResource () {
  return shared(useDataStore())
}
