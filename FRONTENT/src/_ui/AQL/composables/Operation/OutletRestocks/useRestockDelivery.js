import { computed, inject, onMounted, watch } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'

/**
 * OutletRestocks › MarkDelivered — the selection aggregate behind the two
 * `MarkDelivered/` cards and `MarkDelivered/PageAction.js`.
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
 * requirements rather than preferences (PAGE_STATE.md §6.4):
 *   1. it must survive the step-1 → step-2 navigation, which unmounts step 1;
 *   2. `MarkDelivered/PageAction.js` runs OUTSIDE a setup context and has to
 *      read it at submit time, which it can only do through `pageState`.
 * A flat ARRAY rather than a `Set`: `controls` entries are written whole and
 * read back through the same reactive bag, and an array survives that round trip
 * without a wrapper type the payload layer would then have to unwrap.
 *
 * Named PURE exports first — importable from a page contract or a JS modifier
 * without a setup context; the composable wrapper follows (AQL_CUSTOM_UI_GUIDE §2.2).
 *
 * ISOLATION: this file imports nothing resource-specific. The batch payloads live
 * in `./outletRestockPayload.js`; the only outside dependencies here are core
 * infrastructure (`useRecord`, the injected `pageState` / `resourceRecord`).
 */

const PARENT = 'OutletRestocks'
const CHILD = 'OutletRestockItems'

// Wizard-only key on the parent node's `controls` bag.
export const SELECTION = 'DeliverySelection'
const COMMENT = 'DeliveryComment'

const DEFAULT_STORAGE = '_default'
// The unit a SKU is counted in when its own `UOM` column is blank — the same
// default `useRestockApproval` states, for the same reason: a discrete count is
// what an unconfigured SKU is already treated as everywhere else.
const DEFAULT_UOM = 'PCS'

// Only ALLOCATED lines can be delivered. A PENDING line has no stock behind it,
// and a DELIVERED/CANCELLED one is settled history.
const DELIVERABLE_PROGRESS = 'ALLOCATED'

const text = (value) => String(value ?? '').trim()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Normalize anything out of a records array into a safe object.
 *
 * `useRecord().items` CAN CONTAIN `null` — it maps every store row through
 * `enrichRecord`, which returns `null` for a row with no `Code`, and the map is
 * 1:1 so that `null` lands in the array. Optional chaining alone does not survive
 * it: a guard written as `row?.Status || 'Active'` waves the null through the
 * active filter, and the NEXT predicate dereferences it. Every row read in this
 * file goes through `asRow` so a null degrades to an empty object and is then
 * dropped by the field checks (see `useRestockApproval.js`).
 */
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'
const storageOf = (value) => text(value) || DEFAULT_STORAGE

/** Codes normalized, blank-stripped and deduped — the shape everything else reads. */
export function normalizeSelection (value) {
  return Array.from(new Set((Array.isArray(value) ? value : []).map(text).filter(Boolean)))
}

/**
 * The ALLOCATED child rows of one request.
 *
 * Pure so `MarkDelivered/PageAction.js` can derive the very same set at submit
 * time from the injected `resourceRecord`, rather than restating the filter and
 * risking a submit that covers different rows than step 2 displayed.
 */
export function deliverableRows (rows = [], restockCode = '') {
  const parentCode = text(restockCode)
  return (Array.isArray(rows) ? rows : [])
    .map(asRow)
    .filter((row) => text(row.Code) && isActive(row))
    .filter((row) => !parentCode || text(row.OutletRestockCode) === parentCode)
    .filter((row) => text(row.Progress) === DELIVERABLE_PROGRESS)
}

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
        selectedCodes: []
      })
    }
    const product = products.get(productCode)

    let group = product.skus.find((entry) => entry.sku === sku)
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
  return Array.from(products.values()).map((product) => ({
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

export function useRestockDelivery () {
  const pageState = inject('pageState', null)
  const resourceRecord = inject('resourceRecord', null)

  // Same accessor idiom as the rest of the restock flow, so this file imports no
  // store (ARCHITECTURE RULES §5).
  const restocks = useRecord(PARENT)
  const restockItems = useRecord(CHILD)
  const outlets = useRecord('Outlets')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')

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
  const getSelection = () => pageState.getControlField(PARENT, SELECTION)
  const writeSelection = (next) => pageState.setControlField(PARENT, SELECTION, normalizeSelection(next))
  const selectedCodes = computed(() => normalizeSelection(getSelection()))

  // ── Hydration ──────────────────────────────────────────────────────────────
  // An `_action/:action` route is a custom sub-route: `usePageResolver` loads no
  // record for it (AQL_PAGE_AND_SECTION_SYSTEM.md §1.3.3), so the node is created
  // and seeded here. It must exist for `PageAction` to render the sticky bar at
  // all — `hasNodes` gates it (AQL_ACTION_SYSTEM.md §3.1).
  // Bookkeeping lives on the NODE, not in this closure. Two components call this
  // composable (`SelectDeliveryItems` at step 1, `ReviewDelivery` at step 2), and
  // each call gets its own closure — so a per-call `let hydratedKey` starts empty
  // when step 2 MOUNTS, and would re-run the pass and wipe the selection the
  // driver just made. A control field is scoped to the node itself, so it is
  // shared by every caller and is discarded with the node.
  const HYDRATED_FOR = 'DeliveryHydratedFor'
  const hydratedFor = () => (pageState.hasNode(PARENT)
    ? text(pageState.getControlField(PARENT, HYDRATED_FOR))
    : '')

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

    pageState.setControlField(PARENT, HYDRATED_FOR, code)
    pageState.load(PARENT, record)
    writeSelection([])

    // Seed the comment from the LAST delivery on THIS request. A
    // PARTIALLY_DELIVERED restock is delivered again, and the note explaining the
    // first drop is usually most of the note explaining the second — presenting
    // it to be amended is a better default than an empty box the user retypes.
    //
    // Written unconditionally, because this line is only reached when the node
    // has just been created for this record: there is no user input to protect
    // yet. Stepping back and forth within the same request re-enters above.
    pageState.setControlField(PARENT, COMMENT, text(record.ProgressDeliveredComment))
  }

  watch([serverRecord, () => parent.identifier.value], () => { hydrate() }, { immediate: true })

  onMounted(() => {
    // `usePageResolver` loads NOTHING for an `_action/:action` route — a custom
    // sub-route is expected to fetch what it needs itself
    // (AQL_PAGE_AND_SECTION_SYSTEM.md §1.3.3), and `loadRelations()` is only
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

  const comment = computed(() => text(pageState.getControlField(PARENT, COMMENT)))
  function setComment (value) { pageState.setControlField(PARENT, COMMENT, value ?? '') }

  // ── The request's item rows ────────────────────────────────────────────────
  const restock = computed(() => serverRecord.value || {})

  const outletName = computed(() => {
    const code = text(restock.value.OutletCode)
    if (!code) return '—'
    const match = outlets.items.value.find((row) => text(asRow(row).Code) === code)
    return text(asRow(match).Name) || code
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

  /**
   * The display name of a SKU, resolved from the SKUs + Products rows directly.
   *
   * A SKU carries its variant VALUES in positional `Variant1..N` columns, and the
   * product names those positions through its `VariantTypes` CSV — so the values
   * are only meaningful in the product's own order, which is why both records are
   * read rather than the SKU alone. Capped at five, matching the column set.
   */
  function skuLabel (sku) {
    const code = text(sku)
    if (!code) return { primary: 'Item', secondary: '', productCode: '', uom: DEFAULT_UOM }
    const skuRow = asRow(skus.items.value.find((row) => text(asRow(row).Code) === code))
    const productRow = asRow(products.items.value.find((row) => text(asRow(row).Code) === text(skuRow.ProductCode)))
    const variantCount = text(productRow.VariantTypes)
      .split(',').map((label) => label.trim()).filter(Boolean).slice(0, 5).length
    const variants = Array.from({ length: variantCount }, (_, index) => text(skuRow[`Variant${index + 1}`]))
      .filter(Boolean)
      .join(' / ')
    return {
      primary: text(productRow.Name) || code,
      secondary: variants || code,
      // Falls back to the SKU so a SKU with no product still forms its own group
      // rather than collapsing every orphan into one nameless card.
      productCode: text(productRow.Code) || code,
      uom: text(skuRow.UOM) || DEFAULT_UOM
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
  function toggleSku (productCode, sku, selected) {
    const group = productGroups.value
      .find((product) => product.productCode === text(productCode))
      ?.skus.find((entry) => entry.sku === text(sku))
    setCodes(group?.codes, selected)
  }

  function toggleProduct (productCode, selected) {
    const product = productGroups.value.find((entry) => entry.productCode === text(productCode))
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
