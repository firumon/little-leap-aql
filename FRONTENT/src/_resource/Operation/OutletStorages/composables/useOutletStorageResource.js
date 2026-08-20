/**
 * OutletStorages › what each outlet actually holds — Layer 2, this resource's own domain
 * module and the app's ONE stock index.
 *
 * `OutletStorages` is a DERIVED balance sheet: a post-write hook on `OutletMovements`
 * rewrites it, and nothing in the frontend edits it. What the frontend does do, constantly,
 * is ASK it — "how much of this SKU does this outlet hold", once per SKU, inside a loop over
 * the catalogue, on every keystroke of a restock wizard. With 140 outlets, 3,500 storage
 * rows and a full SKU catalogue, a `.filter()` per question is an O(N×M) rescan that reruns
 * on every reactive invalidation.
 *
 * ── THE INDEXES ──
 * One pass over the sheet builds four lookups, and every question after that is O(1):
 *
 *   stockByOutletAndSku  Map<OutletCode, Map<SKU, qty>>   "what does this outlet hold"
 *   stockBySkuAndOutlet  Map<SKU, Map<OutletCode, qty>>   "who holds this SKU"
 *   totalStockByOutlet   Map<OutletCode, qty>             one outlet's total units
 *   totalStockBySku      Map<SKU, qty>                    one SKU's units across the estate
 *   rowsByOutlet         Map<OutletCode, row[]>           the raw rows a stock card lists
 *
 * A SKU can sit in several named storages at one outlet, so quantities are SUMMED into the
 * index rather than assigned — assignment would let the last storage row silently win.
 *
 * ── NON-DESTRUCTIVE ──
 * `rowsByOutlet` carries the RAW rows, untouched and unnarrowed, so a card that wants
 * `StorageName`, `UpdatedAt` or any column added later still has it. The indexes are the
 * fast path, not a replacement for the rows.
 *
 * PURE + shared (§5): the index builders take plain rows so a `PageAction.js` outside any
 * setup context can build one from a payload, while setup-context callers read the memoized
 * computeds through `useOutletStorageResource()`.
 */

import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { defineSharedComposable } from 'src/utils/appHelpers'

const RESOURCE_NAME = 'OutletStorages'

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
 * Deactivated rows are skipped — a soft-deleted balance is not stock. Rows with no outlet or
 * no SKU are skipped too: they cannot answer any question either index is asked.
 */
export function indexOutletStock (rows = []) {
  const stockByOutletAndSku = new Map()
  const stockBySkuAndOutlet = new Map()
  const totalStockByOutlet = new Map()
  const totalStockBySku = new Map()
  const rowsByOutlet = new Map()

  ;(Array.isArray(rows) ? rows : []).forEach((entry) => {
    const row = asRow(entry)
    if (!isActiveRow(row)) return

    const outlet = text(row.OutletCode)
    const sku = text(row.SKU)
    if (!outlet || !sku) return

    const qty = num(row.Quantity)

    addNested(stockByOutletAndSku, outlet, sku, qty)
    addNested(stockBySkuAndOutlet, sku, outlet, qty)
    totalStockByOutlet.set(outlet, (totalStockByOutlet.get(outlet) || 0) + qty)
    totalStockBySku.set(sku, (totalStockBySku.get(sku) || 0) + qty)

    const bucket = rowsByOutlet.get(outlet)
    if (bucket) bucket.push(row)
    else rowsByOutlet.set(outlet, [row])
  })

  return { stockByOutletAndSku, stockBySkuAndOutlet, totalStockByOutlet, totalStockBySku, rowsByOutlet }
}

/**
 * One outlet's stock as a plain `{ [SKU]: qty }` object.
 *
 * Offered beside the `Map` because the restock and consumption cards index by bracket
 * access in their render loops; handing them an object keeps those call sites unchanged
 * while the O(N×M) scan behind them disappears.
 */
export function stockObjectFor (outletCode, index) {
  const bucket = index?.stockByOutletAndSku?.get(text(outletCode))
  if (!bucket) return {}
  const out = {}
  bucket.forEach((qty, sku) => { out[sku] = qty })
  return out
}

/** How much of one SKU one outlet holds. `0` when it holds none. */
export function stockOf (outletCode, sku, index) {
  return index?.stockByOutletAndSku?.get(text(outletCode))?.get(text(sku)) || 0
}

/**
 * Reactive shape for setup-context callers.
 *
 * ONCE PER APP (CORE_ARCHITECTURE_RULES §6): the pass over the storage sheet runs one time
 * per data change, and every wizard, card and metric reads the same memoized indexes.
 */
const shared = defineSharedComposable((dataStore) => {
  const rawStorages = computed(() => (dataStore.getRecords(RESOURCE_NAME) || []).map(asRow))

  const index = computed(() => indexOutletStock(rawStorages.value))

  const stockByOutletAndSku = computed(() => index.value.stockByOutletAndSku)
  const stockBySkuAndOutlet = computed(() => index.value.stockBySkuAndOutlet)
  const totalStockByOutlet = computed(() => index.value.totalStockByOutlet)
  const totalStockBySku = computed(() => index.value.totalStockBySku)
  const rowsByOutlet = computed(() => index.value.rowsByOutlet)

  return {
    RESOURCE_NAME,
    rawStorages,
    index,

    // Indexes.
    stockByOutletAndSku,
    stockBySkuAndOutlet,
    totalStockByOutlet,
    totalStockBySku,
    rowsByOutlet,

    // O(1) projections.
    stockOf: (outletCode, sku) => stockOf(outletCode, sku, index.value),
    stockMapOf: (outletCode) => stockByOutletAndSku.value.get(text(outletCode)) || new Map(),
    stockObjectOf: (outletCode) => stockObjectFor(outletCode, index.value),
    outletsHolding: (sku) => stockBySkuAndOutlet.value.get(text(sku)) || new Map(),
    totalStockOf: (outletCode) => totalStockByOutlet.value.get(text(outletCode)) || 0,
    totalStockOfSku: (sku) => totalStockBySku.value.get(text(sku)) || 0,

    /** The raw rows of one outlet, non-zero balances first — what a stock card lists. */
    stockRowsOf: (outletCode) => [...(rowsByOutlet.value.get(text(outletCode)) || [])]
      .filter((row) => num(row.Quantity) !== 0)
      .sort((a, b) => num(b.Quantity) - num(a.Quantity))
  }
})

export function useOutletStorageResource () {
  return shared(useDataStore())
}
