import { computed, inject, onMounted, watch } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'

/**
 * OutletRestocks › Approve — the allocation aggregate behind the four `Approve/`
 * cards and `Approve/PageAction.js`.
 *
 * ONE reactive source of truth (ARCHITECTURE RULES §6). The approver's whole
 * decision — which bins each requested line draws from, which remainders are
 * cancelled, which warehouses are being inspected — lives in exactly one place:
 * the `ApprovalPlan` control field on the `OutletRestocks` pageState node. Every
 * computed below is a pure projection of
 * (WarehouseStorages × SKUs × the request's item rows × that plan), and every
 * mutation writes only the plan back. There is no mirror map and no watcher
 * syncing two copies, so the review step cannot disagree with the allocation step.
 *
 * The plan is a CONTROL field rather than a record field because it is a
 * wizard-only structure that must never reach a GAS payload (PAGE_STATE.md §6.4);
 * `Approve/PageAction.js` translates it into item rows at submit time.
 *
 * Named PURE exports first — importable from a page contract or a JS modifier
 * without a setup context; the composable wrapper follows (AQL_CUSTOM_UI_GUIDE §2.2).
 *
 * ISOLATION: this file imports nothing resource-specific. Storage-bin candidates,
 * SKU/product labelling and the batch payloads all live under `_ui/` — the bins
 * and labels here, the payloads in `./outletRestockPayload.js`. The only outside
 * dependencies are core infrastructure (`useRecord`, the injected `pageState` /
 * `resourceRecord`), so the approval flow can be re-skinned for another tenant
 * without reaching back into `src/composables/operation/` or `.../master/`.
 */

const PARENT = 'OutletRestocks'
const CHILD = 'OutletRestockItems'

// Wizard-only keys on the parent node's `controls` bag.
const PLAN = 'ApprovalPlan'
// ONE warehouse selection, not a default plus a list of extras. The split forced
// the approver to answer two questions ("which warehouse?" then "which others?")
// to express one intent, and made "deselect the warehouse I am allocating from"
// unreachable from the second control. Allocation draws from every selected
// warehouse; the order they were picked in carries no meaning.
const WAREHOUSES = 'ApprovalWarehouses'
const SHOW_OUTSIDE = 'ApprovalShowOutsideStock'
const COMMENT = 'ApprovalComment'

const DEFAULT_STORAGE = '_default'
// The unit a SKU is counted in when its own `UOM` column is blank. A discrete
// count is what an unconfigured SKU is already treated as everywhere else, so
// this states that assumption rather than rendering a bare number.
const DEFAULT_UOM = 'PCS'

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
 * The location-emptying strategy (directive §4.1): draw from the SMALLEST bins
 * first so the maximum number of storage locations end up completely empty.
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

export function useRestockApproval () {
  const pageState = inject('pageState', null)
  const resourceRecord = inject('resourceRecord', null)

  // Same accessor idiom as the rest of the restock flow, so this file imports no
  // store (ARCHITECTURE RULES §5).
  const restocks = useRecord(PARENT)
  const restockItems = useRecord(CHILD)
  const outlets = useRecord('Outlets')
  const warehouses = useRecord('Warehouses')
  const warehouseStorages = useRecord('WarehouseStorages')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')

  const parent = pageState.useNode(PARENT)
  const serverRecord = computed(() => resourceRecord?.record?.value || null)

  // ── Plan accessors ─────────────────────────────────────────────────────────
  // Declared before hydration, which seeds an empty plan on its immediate run —
  // a `const` referenced from an eagerly-invoked watcher above it would be in its
  // temporal dead zone.
  //
  // Always written as a NEW object. `controls` entries are reactive, but replacing
  // the value outright means every projection below re-runs on one assignment
  // rather than depending on deep tracking of a nested structure.
  const getPlan = () => pageState.getControlField(PARENT, PLAN)
  const writePlan = (next) => pageState.setControlField(PARENT, PLAN, next)
  const plan = computed(() => getPlan() || {})

  // ── Hydration ──────────────────────────────────────────────────────────────
  // An `_action/:action` route is a custom sub-route: `usePageResolver` loads no
  // record for it (AQL_PAGE_AND_SECTION_SYSTEM.md §1.3.3), so the node is created
  // and seeded here. It must exist for `PageAction` to render the sticky bar at
  // all — `hasNodes` gates it (AQL_ACTION_SYSTEM.md §3.1).
  // Bookkeeping lives on the NODE, not in this closure. FOUR components call this
  // composable — `WarehouseAndLocation` and `ItemAllocating` at step 1,
  // `ReviewAllocating` and `ReviewPending` at step 2 — and each call gets its own
  // closure. A per-call `let hydratedKey` therefore starts empty when the step-2
  // cards MOUNT, and would re-run the pass and wipe the allocation plan the
  // approver has just spent the whole of step 1 building. A control field is
  // scoped to the node itself, so it is shared by every caller.
  const HYDRATED_FOR = 'ApprovalHydratedFor'
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
    // plan and comment across — and a plan is keyed by the OTHER request's item
    // Codes, so submitting it would allocate stock against the wrong lines.
    // `reset: true` detaches the node, which is the only thing that clears
    // `controls`.
    if (hydratedFor() === code) return

    pageState.initResource(PARENT, { isPrimaryKey: true, reset: true, code })
    if (!parent.exists.value) return

    pageState.setControlField(PARENT, HYDRATED_FOR, code)
    pageState.load(PARENT, record)
    writePlan({})

    // Seed the comment from the LAST approval pass on THIS request, for the same
    // reason the delivery flow does: an already-APPROVED request comes back to
    // have its leftover PENDING lines allocated, and the note written the first
    // time is usually most of the note wanted the second.
    //
    // Written unconditionally, because this line is only reached when the node
    // has just been created for this record: there is no approver input to
    // protect yet. Stepping between steps re-enters above.
    pageState.setControlField(PARENT, COMMENT, text(record.ProgressApprovedComment))
  }

  watch([serverRecord, () => parent.identifier.value], () => { hydrate() }, { immediate: true })

  onMounted(() => {
    // `usePageResolver` loads NOTHING for an `_action/:action` route — a custom
    // sub-route is expected to fetch what it needs itself
    // (AQL_PAGE_AND_SECTION_SYSTEM.md §1.3.3). That includes the request itself:
    // without this the injected `resourceRecord.record` never resolves on a cold
    // deep link and the page renders an empty shell.
    //
    // The rest is what the cards project over (SKUs × Products × Warehouses ×
    // WarehouseStorages × item rows). `reload()` renders from whatever the store
    // already holds and syncs the delta in the background, so a warm cache shows
    // the page immediately.
    ;[restocks, restockItems, outlets, warehouses, warehouseStorages, skus, products]
      .forEach((resource) => resource.reload())
  })

  // Deduped and blank-stripped on read, so a `null` cleared out of the multiselect
  // (Quasar's `clearable` emits `null`, not `[]`) can never reach the bin filter.
  const selectedWarehouses = computed(() => {
    const raw = pageState.getControlField(PARENT, WAREHOUSES)
    return Array.from(new Set((Array.isArray(raw) ? raw : []).map(text).filter(Boolean)))
  })
  const showOutsideStock = computed(() => pageState.getControlField(PARENT, SHOW_OUTSIDE) === true)
  const comment = computed(() => text(pageState.getControlField(PARENT, COMMENT)))

  function setSelectedWarehouses (codes) {
    pageState.setControlField(PARENT, WAREHOUSES, Array.isArray(codes) ? codes.map(text).filter(Boolean) : [])
  }
  function setShowOutsideStock (value) { pageState.setControlField(PARENT, SHOW_OUTSIDE, value === true) }
  function setComment (value) { pageState.setControlField(PARENT, COMMENT, value ?? '') }

  // ── The request's item rows ────────────────────────────────────────────────
  const restock = computed(() => serverRecord.value || {})
  const isInitialApproval = computed(() => text(restock.value.Progress) === 'PENDING_APPROVAL')

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

  // Only PENDING lines are allocatable. Everything else is settled history and is
  // shown read-only by `ReviewAllocating` / `ReviewPending`.
  const pendingItems = computed(() => allItems.value.filter((row) => (text(row.Progress) || 'PENDING') === 'PENDING'))
  const alreadyAllocated = computed(() => allItems.value.filter((row) => text(row.Progress) === 'ALLOCATED'))

  const itemsBySku = computed(() => {
    const map = {}
    pendingItems.value.forEach((row) => { map[text(row.Code)] = text(row.SKU) })
    return map
  })

  /**
   * The display name of a SKU, resolved from the SKUs + Products rows directly.
   *
   * A SKU carries its variant VALUES in positional `Variant1..N` columns, and the
   * product names those positions through its `VariantTypes` CSV — so the values
   * are only meaningful in the product's own order, which is why both records are
   * read rather than the SKU alone. Capped at five, matching the column set.
   *
   * The variant values are what distinguish one SKU of a product from another;
   * with no variant types configured, the code is the only label left.
   */
  function skuLabel (sku) {
    const code = text(sku)
    if (!code) return { primary: 'Item', secondary: '' }
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
      // The grouping key for the allocation cards. Falls back to the SKU so a SKU
      // with no product still forms its own group rather than collapsing every
      // orphan into one nameless card.
      productCode: text(productRow.Code) || code,
      // The unit every quantity on this line is counted in. It lives on the SKU
      // row — `Products` carries no UOM column — so there is nothing to fall back
      // to but the default. `PCS` is the safe default because a discrete count is
      // what an unconfigured SKU is already being treated as everywhere else.
      uom: text(skuRow.UOM) || DEFAULT_UOM
    }
  }

  function warehouseName (code) {
    const match = warehouses.items.value.find((row) => text(asRow(row).Code) === text(code))
    return text(asRow(match).Name) || text(code) || '—'
  }

  const warehouseOptions = computed(() => warehouses.items.value
    .map(asRow)
    .filter(isActive)
    .filter((row) => text(row.Code))
    .map((row) => ({ label: text(row.Name) || text(row.Code), value: text(row.Code) })))

  // ── Availability ───────────────────────────────────────────────────────────
  const consumption = computed(() => planConsumption(plan.value, itemsBySku.value))

  // Every warehouse whose stock the approver is currently drawing from. Allocation
  // is restricted to this set, so a bin the UI never showed can never be silently
  // drawn from. Now simply the selection itself — kept as its own name because the
  // bin filter reads it, and that read should not have to know how the UI collects it.
  const activeWarehouses = selectedWarehouses

  /**
   * Bins holding `sku`, with availability netted against this plan.
   *
   * `outside` marks a bin that sits beyond the selected warehouses. Those are
   * computed regardless of the toggle — the toggle governs VISIBILITY, not
   * existence, so flipping it never recomputes stock, it only reveals it.
   *
   * Sorted smallest-first on the NETTED figure, so the list the approver reads is
   * in the same order auto-allocation draws in — the bin that would be emptied
   * next is the bin at the top. Sorting here rather than in `storageBinsForSku`
   * is deliberate: only this scope knows what the plan has already committed.
   */
  function binsFor (sku) {
    return sortBinsLeastFirst(storageBinsForSku(warehouseStorages.items.value, sku).map((bin) => {
      const committed = consumption.value[stockKey(sku, bin.warehouseCode, bin.storageName)] || 0
      return {
        id: bin.id,
        warehouseCode: bin.warehouseCode,
        warehouseName: warehouseName(bin.warehouseCode),
        storageName: bin.storageName,
        onHand: num(bin.available),
        available: Math.max(num(bin.available) - committed, 0),
        outside: !activeWarehouses.value.includes(bin.warehouseCode)
      }
    }))
  }

  // The rows every card renders. One entry per requested PENDING line, carrying
  // its plan, its bins, and the arithmetic all four cards must agree on.
  const rows = computed(() => pendingItems.value.map((item) => {
    const code = text(item.Code)
    const entry = plan.value[code] || {}
    const requested = num(item.Quantity)
    const allocated = planAllocatedQty(entry)
    const remainder = Math.max(requested - allocated, 0)
    const bins = binsFor(item.SKU)
    const visibleBins = bins.filter((bin) => showOutsideStock.value || !bin.outside)
    const label = skuLabel(item.SKU)
    return {
      code,
      SKU: text(item.SKU),
      label: label.primary,
      variantLabel: label.secondary,
      productCode: label.productCode,
      productName: label.primary,
      uom: label.uom,
      requested,
      allocated,
      remainder,
      cancelled: entry.cancelled === true,
      lines: (entry.lines || []).map((line) => ({
        ...line,
        warehouseName: warehouseName(line.warehouseCode),
        key: binKey(line.warehouseCode, line.storageName)
      })),
      bins,
      visibleBins,
      // Everything the approver could still draw on, inside the selected
      // warehouses — what decides whether a line is fully, partly, or not coverable.
      coverable: bins.filter((bin) => !bin.outside).reduce((sum, bin) => sum + bin.available, 0) + allocated,
      status: remainder === 0 && allocated > 0
        ? 'full'
        : (allocated > 0 ? 'partial' : (entry.cancelled === true ? 'cancelled' : 'none'))
    }
  }))

  const allocatingRows = computed(() => rows.value.filter((row) => row.allocated > 0))
  const pendingRows = computed(() => rows.value.filter((row) => row.remainder > 0))
  const cancelledRows = computed(() => pendingRows.value.filter((row) => row.cancelled))
  const totalAllocated = computed(() => rows.value.reduce((sum, row) => sum + row.allocated, 0))
  const totalRemainder = computed(() => pendingRows.value.reduce((sum, row) => sum + row.remainder, 0))

  /**
   * The requested lines folded into one entry per PRODUCT.
   *
   * A restock is read product-first — "how much Fruit Feeder is going out?" — while
   * stock is only ever committed per SKU, because that is what a bin holds. So the
   * card groups by product and the allocation inputs stay on the SKU beneath it.
   * Insertion order is preserved, so the groups follow the order the items were
   * requested in rather than an arbitrary re-sort.
   */
  const productGroups = computed(() => {
    const groups = new Map()
    rows.value.forEach((row) => {
      if (!groups.has(row.productCode)) {
        groups.set(row.productCode, {
          productCode: row.productCode,
          productName: row.productName,
          // A product's SKUs are variants of one item, so they share a unit; the
          // first one to arrive names it for the group's own totals.
          uom: row.uom,
          skus: [],
          requested: 0,
          allocated: 0,
          remainder: 0
        })
      }
      const group = groups.get(row.productCode)
      group.skus.push(row)
      group.requested += row.requested
      group.allocated += row.allocated
      group.remainder += row.remainder
    })
    return Array.from(groups.values())
  })

  /**
   * The unit the ALLOCATED total is counted in.
   *
   * Empty when the allocated lines do not agree on one. A running total across
   * mixed units is not expressible in any single unit, so the summary drops the
   * label rather than picking one and stating something false — the per-line
   * figures still carry their own units.
   */
  const allocatedUom = computed(() => {
    const units = new Set(allocatingRows.value.map((row) => row.uom).filter(Boolean))
    return units.size === 1 ? Array.from(units)[0] : ''
  })

  // Warehouses actually drawn from, as opposed to merely selected — the review
  // step states what the batch will touch, which is not the same as what the
  // approver had ticked while deciding.
  const allocatedWarehouses = computed(() => {
    const codes = new Set()
    allocatingRows.value.forEach((row) => row.lines.forEach((line) => {
      if (text(line.warehouseCode)) codes.add(text(line.warehouseCode))
    }))
    return Array.from(codes).map((code) => ({ code, name: warehouseName(code) }))
  })

  // ── Mutations (the only writers of the plan) ───────────────────────────────
  function setEntry (code, patch) {
    const current = plan.value[text(code)] || { lines: [], cancelled: false }
    writePlan({ ...plan.value, [text(code)]: { ...current, ...patch } })
  }

  /**
   * Set one bin's quantity on one requested line.
   *
   * Clamped to what that bin can still give (its netted availability plus
   * whatever this same line already holds there, which is not a conflict with
   * itself) and to the line's own outstanding requirement — so no input can
   * over-allocate a bin or over-fulfil a request.
   */
  function setLineQuantity (code, warehouseCode, storageName, quantity) {
    const row = rows.value.find((entry) => entry.code === text(code))
    if (!row) return
    const key = binKey(warehouseCode, storageName)
    const existing = row.lines.find((line) => line.key === key)
    const held = num(existing?.quantity)
    const bin = row.bins.find((candidate) => candidate.id === key)
    if (!bin) return

    const ceiling = Math.min(bin.available + held, row.requested - row.allocated + held)
    const next = Math.min(Math.max(0, Math.floor(num(quantity))), Math.max(0, ceiling))

    const lines = row.lines
      .filter((line) => line.key !== key)
      .map(({ warehouseCode: w, storageName: s, quantity: q }) => ({ warehouseCode: w, storageName: s, quantity: q }))
    if (next > 0) lines.push({ warehouseCode: text(warehouseCode), storageName: text(storageName), quantity: next })

    // Allocating something is an implicit decision not to cancel: the two states
    // are mutually exclusive, so re-asserting it here keeps the plan self-consistent
    // rather than relying on the UI to clear the flag.
    setEntry(code, { lines, cancelled: next > 0 ? false : row.cancelled })
  }

  function clearLines (code) {
    setEntry(code, { lines: [] })
  }

  function setCancelled (code, cancelled) {
    setEntry(code, { cancelled: cancelled === true })
  }

  /** One requested line, filled smallest-bin-first from the selected warehouses. */
  function autoAllocateRow (code) {
    const row = rows.value.find((entry) => entry.code === text(code))
    if (!row) return
    const { lines } = drawLeastQuantityFirst(row.bins.filter((bin) => !bin.outside), row.requested)
    setEntry(code, { lines, cancelled: false })
  }

  /**
   * Every requested line at once.
   *
   * Sequential, not parallel: each line is drawn against a plan that already
   * includes the previous one's draw, so two lines for the same SKU cannot both
   * claim the same units. Reading `rows.value` fresh per iteration is what makes
   * that netting real rather than nominal.
   */
  function autoAllocateAll () {
    rows.value.forEach((row) => { if (!row.cancelled) autoAllocateRow(row.code) })
  }

  // Product-level bulk actions. Which SKUs belong to a product is a domain fact,
  // so the card asks for it rather than re-deriving the grouping to loop over.
  function skuCodesIn (productCode) {
    return rows.value.filter((row) => row.productCode === text(productCode)).map((row) => row.code)
  }

  function autoAllocateProduct (productCode) {
    // Re-read per code, for the same netting reason `autoAllocateAll` does.
    skuCodesIn(productCode).forEach((code) => {
      const row = rows.value.find((entry) => entry.code === code)
      if (row && !row.cancelled) autoAllocateRow(code)
    })
  }

  function clearProduct (productCode) {
    skuCodesIn(productCode).forEach((code) => clearLines(code))
  }

  function resetPlan () {
    writePlan({})
  }

  return {
    // context
    parent,
    restock,
    isInitialApproval,
    // warehouse selection
    warehouseOptions,
    selectedWarehouses,
    activeWarehouses,
    allocatedWarehouses,
    allocatedUom,
    showOutsideStock,
    setSelectedWarehouses,
    setShowOutsideStock,
    warehouseName,
    // rows + totals
    rows,
    productGroups,
    allocatingRows,
    pendingRows,
    cancelledRows,
    alreadyAllocated,
    pendingItems,
    totalAllocated,
    totalRemainder,
    skuLabel,
    // comment
    comment,
    setComment,
    // mutations
    setLineQuantity,
    clearLines,
    setCancelled,
    autoAllocateRow,
    autoAllocateAll,
    autoAllocateProduct,
    clearProduct,
    resetPlan
  }
}
