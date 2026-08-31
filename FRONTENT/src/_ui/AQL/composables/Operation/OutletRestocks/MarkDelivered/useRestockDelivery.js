import { computed, onMounted, watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { useRecord } from 'src/composables/resources/useRecord'
import { buildRestockDeliveryNodes } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'
import { useRestockDeliveryContext } from './useRestockDeliveryContext'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import {
  normalizeSelection,
  deliverableRows
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockDelivery'

/**
 * OutletRestocks › MarkDelivered — the UI half of the delivery selection aggregate.
 *
 * PRESENTATION ONLY (UI_RESOURCE_DOMAIN_LOGIC.md §4). This file owns the `inject()`
 * relay, the reactive projections the two cards render, the SKU labelling, and the
 * Product → SKU → storage grouping, which is display shaping. The RULE for what may be
 * delivered at all — `deliverableRows`, `normalizeSelection`, and the control-field key
 * itself — lives in `src/_resource/Operation/OutletRestocks/composables/useRestockDelivery`
 * and is imported above, so `MarkDelivered/PageAction.js` submits exactly the set step 2
 * displayed. Nothing here re-derives it.
 *
 * Page-scoped per §6.1: it calls `inject()`, and only `MarkDelivered.js` resolves the two
 * cards that use it.
 *
 * ONE reactive source of truth (ARCHITECTURE RULES §6). What the driver is
 * confirming as delivered lives in exactly one place: the `DeliverySelection`
 * control field on the `OutletRestocks` pageState node — a flat array of
 * `OutletRestockItems` Codes. Every computed below is a pure projection of
 * (the request's ALLOCATED item rows × SKUs × Products × that selection), and
 * every mutation writes only the selection back. There is no mirror map and no
 * watcher syncing two copies, so step 2 cannot disagree with step 1.
 *
 * It is a CONTROL field, not a local `ref`, for two reasons that are both hard
 * requirements rather than preferences (UI_PAGE_STATE.md §6.4):
 *   1. it must survive the step-1 → step-2 navigation, which unmounts step 1;
 *   2. `MarkDelivered/PageAction.js` runs OUTSIDE a setup context and has to
 *      read it at submit time, which it can only do through `pageState`.
 * A flat ARRAY rather than a `Set`: `controls` entries are written whole and
 * read back through the same reactive bag, and an array survives that round trip
 * without a wrapper type the payload layer would then have to unwrap.
 */

const PARENT = 'OutletRestocks'
const CHILD = 'OutletRestockItems'


const DEFAULT_STORAGE = '_default'
// The unit a SKU is counted in when its own `UOM` column is blank — the same
// default `useRestockApproval` states, for the same reason: a discrete count is
// what an unconfigured SKU is already treated as everywhere else.
const DEFAULT_UOM = 'PCS'

const text = (value) => String(value ?? '').trim()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// `useRecord().items` CAN CONTAIN `null` — see `useRestockAllocation.js`'s `asRow` for
// the full account. A null degrades to an empty row and is then dropped by the field
// checks, instead of being waved through one guard and dereferenced by the next.
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'
const storageOf = (value) => text(value) || DEFAULT_STORAGE

/**
 * Fold rows into the Product → SKU → storage tree both steps render.
 *
 * The same shape for the editable step and the read-only one, so the review is
 * literally the selection re-rendered rather than a second grouping that could
 * drift from it. Insertion order is preserved throughout — the groups follow the
 * order the items were requested in, not an arbitrary re-sort.
 *
 * `label(sku)` is injected rather than resolved here so this stays pure.
 */
export function groupDeliveryRows (rows = [], label = () => ({}), selected = []) {
  const chosen = new Set(normalizeSelection(selected))
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
        selectedQuantity: 0,
        codes: [],
        selectedCodes: [],
        _index: new Map()
      })
    }
    const product = products.get(productCode)

    // Keyed, not scanned: `product.skus` grows as rows are folded in, so a `.find()`
    // here is a scan of everything already grouped, per row (§6 — Indexed Joins).
    // `_index` is stripped before the tree is returned.
    let group = product._index.get(sku)
    if (!group) {
      group = {
        key: `${productCode}:${sku}`,
        sku,
        productCode,
        label: text(info.secondary) || sku,
        uom,
        rows: [],
        quantity: 0,
        selectedQuantity: 0,
        codes: [],
        selectedCodes: []
      }
      product.skus.push(group)
      product._index.set(sku, group)
    }

    const quantity = num(row.Quantity)
    const isSelected = chosen.has(code)
    const entry = {
      code,
      sku,
      productCode,
      warehouseCode: text(row.WarehouseCode),
      storageName: storageOf(row.StorageName),
      quantity,
      uom,
      selected: isSelected
    }

    group.rows.push(entry)
    group.quantity += quantity
    group.codes.push(code)
    product.quantity += quantity
    product.codes.push(code)
    if (isSelected) {
      group.selectedQuantity += quantity
      group.selectedCodes.push(code)
      product.selectedQuantity += quantity
      product.selectedCodes.push(code)
    }
  })

  // Tri-state flags are derived, never stored: a header's checked/indeterminate
  // state is a fact about its children, and storing it would be the second source
  // of truth this module exists to avoid.
  return Array.from(products.values()).map(({ _index, ...product }) => ({
    ...product,
    skus: product.skus.map((group) => ({
      ...group,
      allSelected: group.codes.length > 0 && group.selectedCodes.length === group.codes.length,
      someSelected: group.selectedCodes.length > 0
    })),
    allSelected: product.codes.length > 0 && product.selectedCodes.length === product.codes.length,
    someSelected: product.selectedCodes.length > 0
  }))
}

const ITEMS = 'OutletRestockItems'
const OUTLET_MOVEMENTS = 'OutletMovements'
const DELIVERED_COMMENT = 'ProgressDeliveredComment'

// Everything the confirmation writes, dropped in one go. The parent node stays — it
// carries the selection and the note, and `hasNodes` gates the sticky bar.
export function clearDeliveryPayload (pageState) {
  pageState.removeNode(ITEMS)
  pageState.removeNode(OUTLET_MOVEMENTS)
  // The note is the driver's own input, not part of the selection, so it survives.
  const note = pageState.getRecord(DELIVERED_COMMENT, PARENT)
  pageState.setResource(PARENT, { record: note ? { [DELIVERED_COMMENT]: note } : {} })
}

export function useRestockDelivery () {
  // Injected once for the whole page, by the relay (§6.1) — not a second time
  // here, or the page would have two composables injecting the same keys.
  const { pageState, resourceRecord } = useRestockDeliveryContext()

  // Same accessor idiom as the rest of the restock flow, so this file imports no
  // store (ARCHITECTURE RULES §5).
  const restocks = useRecord(PARENT)
  const restockItems = useRecord(CHILD)
  const outlets = useRecord('Outlets')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')

  // The SKU × Product and Outlet joins belong to the resource layer (§6 — Enrich
  // Once, Then Project). The `useRecord` handles stay for their `reload()` below:
  // fetching the rows is a separate concern from reading them.
  const { getSku } = useSkuResource()
  const { getOutlet } = useOutletResource()

  const parent = pageState.useNode(PARENT)
  const serverRecord = computed(() => resourceRecord?.record?.value || null)

  // ── Selection accessors ────────────────────────────────────────────────────
  // Declared before hydration, which seeds an empty selection on its immediate
  // run — a `const` referenced from an eagerly-invoked watcher above it would be
  // in its temporal dead zone.
  //
  // Always written as a NEW array. `controls` entries are reactive, but replacing
  // the value outright means every projection below re-runs on one assignment
  // rather than depending on deep tracking of a mutated array.
  // THE SELECTION IS THE NODE. A ticked line is a row in the live `OutletRestockItems`
  // write; unticking removes it. There is no control mirroring the choice, so what the
  // driver sees ticked and what the batch delivers cannot drift (UI_PAGE_STATE.md §5A.1
  // — "whether a resource is written is the node's existence").
  const selectedCodes = computed(() => normalizeSelection(
    (pageState.getRecordRows(ITEMS) || []).map((row) => text(asRow(row).Code))
  ))

  // ── Hydration ──────────────────────────────────────────────────────────────
  // An `_action/:action` route is a custom sub-route: `usePageResolver` loads no
  // record for it (UI_PAGE_AND_SECTION_SYSTEM.md §1.3.3), so the node is created
  // and seeded here. It must exist for `PageAction` to render the sticky bar at
  // all — `hasNodes` gates it (UI_ACTION_SYSTEM.md §3.1).
  // Whether the node was already built for THIS request is asked of the node's own
  // `code` — there is no bookkeeping control for it. Two components call this
  // composable (`SelectDeliveryItems` at step 1, `ReviewDelivery` at step 2) and each
  // call gets its own closure, so a per-call `let hydratedKey` would start empty when
  // step 2 MOUNTS and re-run the pass, wiping the selection just made.
  const hydratedFor = () => (pageState.hasNode(PARENT) ? text(parent.node.value.code) : '')

  function hydrate () {
    const record = serverRecord.value
    if (!pageState || !record) return
    const code = text(record.Code)
    if (!code) return

    // The record's CODE is what the node is hydrated FOR. Anything else is a
    // DIFFERENT restock, and its node must be built from scratch: `hasNode` is
    // true for the whole resource, so reusing it carried the previous request's
    // selection and comment across. `reset: true` detaches the node, which is
    // the only thing that clears `controls`.
    if (hydratedFor() === code) return

    pageState.initResource(PARENT, { isPrimaryKey: true, reset: true, code })
    if (!parent.exists.value) return

    // The node carries the delivery's OWN writes, not a copy of the loaded row: a
    // full `load` here would put every column of the request into the batch.
    clearDeliveryPayload(pageState)

    // Seed the comment from the LAST delivery on THIS request. A
    // PARTIALLY_DELIVERED restock is delivered again, and the note explaining the
    // first drop is usually most of the note explaining the second — presenting
    // it to be amended is a better default than an empty box the user retypes.
    //
    // Written unconditionally, because this line is only reached when the node
    // has just been created for this record: there is no user input to protect
    // yet. Stepping back and forth within the same request re-enters above.
    pageState.setRecord(DELIVERED_COMMENT, text(record.ProgressDeliveredComment), PARENT)
  }

  watch([serverRecord, () => parent.identifier.value], () => { hydrate() }, { immediate: true })

  onMounted(() => {
    // `usePageResolver` loads NOTHING for an `_action/:action` route — a custom
    // sub-route is expected to fetch what it needs itself
    // (UI_PAGE_AND_SECTION_SYSTEM.md §1.3.3), and `loadRelations()` is only
    // called on a view route, so the child item rows are NOT there either. That
    // includes the request itself: without this the injected
    // `resourceRecord.record` never resolves on a cold deep link and the page
    // renders an empty shell.
    //
    // SKUs × Products are what the Product → SKU labelling projects over.
    // `reload()` renders from whatever the store already holds and syncs the
    // delta in the background, so a warm cache shows the page immediately.
    ;[restocks, restockItems, outlets, skus, products].forEach((resource) => resource.reload())
  })

  // The note is a COLUMN on the parent, bound straight through `useRecord` — not a
  // control. Writing it re-cuts the live batch.
  const commentField = pageState.useRecord(DELIVERED_COMMENT, PARENT)
  const comment = computed(() => text(commentField.value))
  function setComment (value) { commentField.value = value ?? '' }

  const { user } = useAuth()
  const actor = () => user.value?.name || user.value?.email || ''

  // ── The request's item rows ────────────────────────────────────────────────
  const restock = computed(() => serverRecord.value || {})

  const outletName = computed(() => {
    const code = text(restock.value.OutletCode)
    if (!code) return '—'
    return text(getOutlet(code)?.name) || code
  })

  // Read from the resource rows rather than `childRecordsByResource`, so a row
  // written by an earlier allocation pass shows up without a full relation reload.
  const allItems = computed(() => {
    const code = text(restock.value.Code)
    if (!code) return []
    // `.map(asRow)` BEFORE any predicate: `items` can carry nulls (see `asRow`),
    // and a null that survives one guard would be dereferenced by the next.
    return restockItems.items.value
      .map(asRow)
      .filter((row) => text(row.OutletRestockCode) === code && isActive(row) && text(row.Code))
  })

  const items = computed(() => deliverableRows(allItems.value, restock.value.Code))

  // ── The live batch ─────────────────────────────────────────────────────────
  // ONE representation. What step 2 reviews and what `submit` ships are the same nodes:
  // the Layer 2 builder runs on every tick and on every edit of the note, so the batch
  // is complete and inspectable at every step and `submit` has nothing left to assemble.
  function writeSelection (next) {
    const record = restock.value
    const chosen = new Set(normalizeSelection(next))
    const delivered = items.value.filter((row) => chosen.has(text(row.Code)))
    if (!text(record.Code) || !delivered.length) {
      clearDeliveryPayload(pageState)
      return
    }
    // `role: ''` keeps the parent on the ROLELESS address — this page confirms exactly
    // one request, so a roled second node would leave an empty one beside it.
    pageState.applyNodes(buildRestockDeliveryNodes(record, delivered, actor(), comment.value, {
      allItems: allItems.value,
      role: ''
    }))
  }

  // The note is stamped ONTO the rows, so the live batch has to be re-cut when it
  // changes. Keyed off the note, never off the node the rebuild writes, so this cannot
  // feed itself.
  watch(comment, () => {
    if (selectedCodes.value.length) writeSelection(selectedCodes.value)
  })

  /**
   * The display name of a SKU, read off the enriched SKU record.
   *
   * A SKU carries its variant VALUES in positional `Variant1..N` columns, and the
   * product names those positions through its `VariantTypes` CSV — so the values are
   * only meaningful in the product's own order. That join, and the five-column cap,
   * are `enrichSku`'s job. This used to redo both by scanning the SKUs array and then
   * the Products array on every call, and it is called once per row while grouping
   * and again per selected row while summing units (§6 — Enrich Once, Then Project).
   */
  function skuLabel (sku) {
    const code = text(sku)
    if (!code) return { primary: 'Item', secondary: '', productCode: '', uom: DEFAULT_UOM }
    const info = getSku(code) || {}
    const variants = (info.variantValues || []).filter(Boolean).join(' / ')
    return {
      primary: text(info.productName) || code,
      secondary: variants || code,
      // Falls back to the SKU so a SKU with no product still forms its own group
      // rather than collapsing every orphan into one nameless card — keyed off
      // whether the product actually RESOLVED, so a SKU pointing at a product that
      // no longer exists is treated as the orphan it is.
      productCode: (info._product ? text(info.productCode) : '') || code,
      uom: text(info.uom) || DEFAULT_UOM
    }
  }

  const productGroups = computed(() => groupDeliveryRows(items.value, skuLabel, selectedCodes.value))

  const selectedRows = computed(() => {
    const chosen = new Set(selectedCodes.value)
    return items.value.filter((row) => chosen.has(text(row.Code)))
  })

  // Only what is actually selectable counts as "everything". A stale Code left in
  // the selection by a row that has since been delivered elsewhere must not make
  // the header read as fully ticked.
  const selectableCodes = computed(() => items.value.map((row) => text(row.Code)))
  const selectedCount = computed(() => selectedRows.value.length)
  const selectedQuantity = computed(() => selectedRows.value.reduce((sum, row) => sum + num(row.Quantity), 0))
  const totalQuantity = computed(() => items.value.reduce((sum, row) => sum + num(row.Quantity), 0))
  const allSelected = computed(() =>
    selectableCodes.value.length > 0 && selectedCount.value === selectableCodes.value.length)

  /**
   * The unit the selected total is counted in.
   *
   * Empty when the selected lines do not agree on one. A running total across
   * mixed units is not expressible in any single unit, so the summary drops the
   * label rather than picking one and stating something false — the per-line
   * figures still carry their own units.
   */
  const selectedUom = computed(() => {
    const units = new Set(selectedRows.value.map((row) => skuLabel(row.SKU).uom).filter(Boolean))
    return units.size === 1 ? Array.from(units)[0] : ''
  })

  // ── Mutations (the only writers of the selection) ──────────────────────────
  function setCodes (codes, selected) {
    const targets = normalizeSelection(codes)
    if (!targets.length) return
    const current = new Set(selectedCodes.value)
    targets.forEach((code) => {
      if (selected === false) current.delete(code)
      else current.add(code)
    })
    writeSelection(Array.from(current))
  }

  function toggleRow (code, selected) {
    setCodes([code], selected)
  }

  // A header toggle is expressed in terms of the Codes beneath it rather than a
  // re-derived filter, so what a header controls is exactly what it displayed.
  // Indexed rather than scanned: a toggle is a click handler, and the nested
  // `.find().skus.find()` walked the whole tree on every tick (§6 — Indexed Joins).
  const groupIndex = computed(() => {
    const byProduct = new Map()
    const bySku = new Map()
    productGroups.value.forEach((product) => {
      byProduct.set(product.productCode, product)
      product.skus.forEach((group) => bySku.set(group.key, group))
    })
    return { byProduct, bySku }
  })

  function toggleSku (productCode, sku, selected) {
    // The group's own `key`, which is how `groupDeliveryRows` already identifies it.
    const group = groupIndex.value.bySku.get(`${text(productCode)}:${text(sku)}`)
    setCodes(group?.codes, selected)
  }

  function toggleProduct (productCode, selected) {
    const product = groupIndex.value.byProduct.get(text(productCode))
    setCodes(product?.codes, selected)
  }

  function selectAll () { writeSelection(selectableCodes.value) }
  function clearSelection () { writeSelection([]) }

  return {
    // context
    parent,
    restock,
    outletName,
    // rows
    items,
    allItems,
    productGroups,
    selectedRows,
    selectedCodes,
    skuLabel,
    // totals
    selectedCount,
    selectedQuantity,
    totalQuantity,
    selectedUom,
    allSelected,
    // comment
    comment,
    setComment,
    // mutations
    toggleRow,
    toggleSku,
    toggleProduct,
    selectAll,
    clearSelection
  }
}
