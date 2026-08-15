import { computed, onMounted } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRestockViewContext } from './useRestockViewContext'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import {
  itemProgressLabel,
  itemProgressColor,
  itemProgressIcon,
  isApprovalCommitted,
  workflowStamps
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'

/**
 * OutletRestocks › View — the UI half of the read-only aggregate behind the four
 * `View/` cards.
 *
 * PRESENTATION ONLY (UI_RESOURCE_DOMAIN_LOGIC.md §4). The workflow VOCABULARY this
 * page renders is no longer declared here. It used to carry its own `PROGRESS_META` — a
 * verbatim copy of all seven request states plus three item-row states, with a comment
 * promising it would be "kept in step" with the original. Two maps that must be kept in
 * step are one map that isn't (§3.3), so the copy is gone: `ITEM_ROW_META` in
 * `src/_resource/.../useRestockProgress` now extends the one `PROGRESS_META` with the
 * item-row states, and the three lookups below are thin aliases onto it.
 *
 * The aliases keep the names the four `View/` cards already import, so the vocabulary
 * consolidation changed no consumer.
 *
 * Page-scoped per §6.1: it calls `inject()`, and only `View.js` resolves its cards.
 *
 * ONE reactive source of truth (ARCHITECTURE RULES §6). Every card on the View
 * page renders a projection of the SAME `productGroups` tree — the summary reads
 * its totals, the allocation card reads the bins beneath them — so "how much was
 * requested?" cannot be answered differently by two cards on one screen.
 *
 * Nothing here mutates: there is no plan, no selection and no pageState write.
 * The View page is a statement of what happened, and the actions that changed it
 * live under `Approve/` and `MarkDelivered/`.
 */

const CHILD = 'OutletRestockItems'

const DEFAULT_STORAGE = '_default'
// Same default the approval and delivery aggregates state, for the same reason: a
// discrete count is what an unconfigured SKU is already treated as everywhere else.
const DEFAULT_UOM = 'PCS'

const text = (value) => String(value ?? '').trim()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
// `useRecord().items` CAN CONTAIN `null` — see `useRestockAllocation.js` for why. A
// null degrades to an empty row here and is then dropped by the field checks,
// rather than being waved through one guard and dereferenced by the next.
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'
const storageOf = (value) => text(value) || DEFAULT_STORAGE

// The one vocabulary, under the names this page's cards already import. `ITEM_ROW_META`
// covers both the request's own states and its item rows', which is what this page needs
// — it renders both on one screen.
export const progressLabel = itemProgressLabel
export const progressColor = itemProgressColor
export const progressIcon = itemProgressIcon

/**
 * Whether stock has been COMMITTED to this request — has it passed approval at all?
 *
 * Aliased to the domain predicate under the name `View/AllocationDetails.vue` imports.
 * Note it is deliberately NOT `useRestockProgress`'s `isApproved`, which asks the
 * narrower question "is this record sitting in the APPROVED state exactly"; a
 * PARTIALLY_DELIVERED request answers false to that and true to this.
 */
export const isApproved = isApprovalCommitted

/** Re-exported so the timeline card needs one import, not two. */
export { workflowStamps }

/** `2026-08-11T09:14:00.000Z` → `11 Aug 2026, 09:14`. Blank stays blank. */
export function formatStampDate (value) {
  const raw = text(value)
  if (!raw) return ''
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

/**
 * A SKU's display name, projected from its ENRICHED record.
 *
 * A SKU carries its variant VALUES in positional `Variant1..N` columns, and the
 * product names those positions through its `VariantTypes` CSV — so the values are
 * only meaningful in the product's order. `enrichSku` performs that join and the
 * five-column cap; this used to take the two RAW rows and redo both, which forced
 * its caller to scan the SKUs array and then the Products array per label
 * (§6 — Enrich Once, Then Project). Pure, so the lookup stays in the composable.
 */
export function skuLabelOf (info = {}, fallback = '') {
  const enriched = asRow(info)
  const code = text(fallback)
  const variants = (enriched.variantValues || []).filter(Boolean).join(' / ')
  return {
    primary: text(enriched.productName) || code,
    secondary: variants || code,
    // Falls back to the SKU so a SKU with no product still forms its own group
    // rather than collapsing every orphan into one nameless card — keyed off
    // whether the product actually RESOLVED, so a SKU pointing at a product that
    // no longer exists is treated as the orphan it is.
    productCode: (enriched._product ? text(enriched.productCode) : '') || code,
    uom: text(enriched.uom) || DEFAULT_UOM
  }
}

/**
 * Fold the request's item rows into the Product → SKU → bin tree every card reads.
 *
 * ALL active rows are folded, whatever their Progress: the summary states what was
 * requested, and after approval a requested line exists only as the sum of its
 * ALLOCATED bins plus whatever remainder stayed PENDING. Filtering by Progress
 * here would make an approved request's totals disagree with the same request's
 * totals before approval.
 *
 * `label(sku)` is injected rather than resolved here so this stays pure. Insertion
 * order is preserved throughout — groups follow the order the items were requested
 * in, not an arbitrary re-sort.
 */
export function groupViewRows (rows = [], label = () => ({}), warehouseName = (code) => code) {
  const products = new Map()

  ;(Array.isArray(rows) ? rows : []).map(asRow).forEach((row) => {
    const code = text(row.Code)
    if (!code) return
    const sku = text(row.SKU)
    const info = label(sku) || {}
    const productCode = text(info.productCode) || sku || code
    const uom = text(info.uom) || DEFAULT_UOM

    if (!products.has(productCode)) {
      products.set(productCode, {
        productCode,
        productName: text(info.primary) || productCode,
        uom,
        skus: [],
        quantity: 0,
        // Keyed, not scanned: `skus` grows as rows are folded in, so a `.find()` here
        // is a scan of everything already grouped, per row (§6 — Indexed Joins).
        // Stripped before the tree is returned.
        _index: new Map()
      })
    }
    const product = products.get(productCode)

    let group = product._index.get(sku)
    if (!group) {
      group = {
        key: `${productCode}:${sku}`,
        sku,
        productCode,
        productName: product.productName,
        label: text(info.secondary) || sku,
        uom,
        quantity: 0,
        rows: [],
        states: []
      }
      product.skus.push(group)
      product._index.set(sku, group)
    }

    const quantity = num(row.Quantity)
    const progress = text(row.Progress) || 'PENDING'
    group.rows.push({
      code,
      warehouseCode: text(row.WarehouseCode),
      warehouseName: text(row.WarehouseCode) ? warehouseName(row.WarehouseCode) : '',
      storageName: text(row.WarehouseCode) ? storageOf(row.StorageName) : '',
      quantity,
      uom,
      progress
    })
    group.quantity += quantity
    if (!group.states.includes(progress)) group.states.push(progress)
    product.quantity += quantity
  })

  return Array.from(products.values()).map(({ _index, ...product }) => product)
}

export function useRestockView () {
  // Injected once for the whole page, by the relay (§6.1) — not a second time
  // here, or the View page would have two composables injecting `resourceRecord`.
  const { resourceRecord } = useRestockViewContext()

  // Same accessor idiom as the rest of the restock flow, so this file imports no
  // store (ARCHITECTURE RULES §5).
  const restockItems = useRecord(CHILD)
  const outlets = useRecord('Outlets')
  const warehouses = useRecord('Warehouses')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')

  // The SKU × Product, Outlet and Warehouse joins belong to the resource layer
  // (§6 — Enrich Once, Then Project). The `useRecord` handles stay for their
  // `reload()` below: fetching the rows is a separate concern from reading them.
  const { getSku } = useSkuResource()
  const { getOutlet } = useOutletResource()
  const { getWarehouse } = useWarehouseResource()

  onMounted(() => {
    // A view route loads the record and its relations, but NOT the SKUs ×
    // Products × Warehouses the labelling projects over. `reload()` renders from
    // whatever the store already holds and syncs the delta in the background, so
    // a warm cache shows the page immediately.
    ;[restockItems, outlets, warehouses, skus, products].forEach((resource) => resource.reload())
  })

  const restock = computed(() => resourceRecord?.record?.value || null)
  const loading = computed(() => resourceRecord?.loading?.value === true)
  const pending = computed(() => !restock.value && loading.value)

  const outletName = computed(() => {
    const code = text(restock.value?.OutletCode)
    if (!code) return ''
    return text(getOutlet(code)?.name) || code
  })

  function warehouseName (code) {
    return text(getWarehouse(text(code))?.name) || text(code)
  }

  function skuLabel (sku) {
    const code = text(sku)
    if (!code) return { primary: 'Item', secondary: '', productCode: '', uom: DEFAULT_UOM }
    return skuLabelOf(getSku(code) || {}, code)
  }

  // Read from the resource rows rather than `childRecordsByResource`, so rows
  // written by an allocation or a delivery show up without a full relation reload.
  const items = computed(() => {
    const code = text(restock.value?.Code)
    if (!code) return []
    return restockItems.items.value
      .map(asRow)
      .filter((row) => text(row.OutletRestockCode) === code && isActive(row) && text(row.Code))
  })

  const productGroups = computed(() => groupViewRows(items.value, skuLabel, warehouseName))

  const approved = computed(() => isApproved(restock.value))
  const events = computed(() => workflowStamps(restock.value))

  return {
    // context
    restock,
    loading,
    pending,
    outletName,
    approved,
    // rows
    items,
    productGroups,
    skuLabel,
    warehouseName,
    // workflow
    events,
    // presentation
    progressLabel,
    progressColor,
    progressIcon,
    formatStampDate
  }
}
