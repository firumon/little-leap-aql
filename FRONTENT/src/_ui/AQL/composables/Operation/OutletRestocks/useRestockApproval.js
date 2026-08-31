import { computed, onMounted, watch } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRestockApprovalContext } from './useRestockApprovalContext'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import { useAuth } from 'src/composables/core/useAuth'
import {
  binKey,
  stockKey,
  indexStorageBinsBySku,
  sortBinsLeastFirst,
  drawLeastQuantityFirst,
  planConsumption,
  planAllocatedQty,
  pendingAllocationRows,
  splitApprovalRows
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockAllocation'
import {
  buildPendingRestockAllocationNodes,
  buildRestockAllocationNodes,
  buildRestockCancelItemNodes
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'

/**
 * OutletRestocks › allocation context — the UI half of the approval aggregate.
 *
 * PRESENTATION ONLY (UI_RESOURCE_DOMAIN_LOGIC.md §4). This file owns the `inject()`
 * relay, the reactive projections the cards render, and the SKU/warehouse label lookups.
 * Every piece of allocation ARITHMETIC — bin keying, the least-quantity-first draw, plan
 * netting, and the two row-splitting translations — now lives in
 * `src/_resource/Operation/OutletRestocks/composables/useRestockAllocation` and is
 * imported above. Nothing here re-derives any of it.
 *
 * PLACEMENT. It sits at `composables/Operation/OutletRestocks/` rather than under a page folder
 * because two action routes share it: `Approve.js` and `Reallocate.js` both resolve the
 * same four content cards (`WarehouseAndLocation`, `ItemAllocating`, `ReviewAllocating`,
 * `ReviewPending`), which live at the resource tier for exactly that reason
 * (UI_MODULE_DEVELOPER_GUIDE.md §3.1 — share by placement, not by copying).
 * A single `.vue` file has one import line, so a per-page copy of this composable would
 * have forced a per-page copy of all four cards, which is the drift §3.1 exists to
 * prevent. The sticky bars stay separate, as §3.1 also requires: `Approve/PageAction.js`
 * and `Reallocate/PageAction.js` are two files that import the same pure builders.
 *
 * ONE reactive source of truth (ARCHITECTURE RULES §6). The approver's whole
 * decision — which bins each requested line draws from, which remainders are
 * cancelled — lives in the `OutletRestockItems` CHILDREN of the `OutletRestocks`
 * node, because that decision is line-item data of the batch, not a UI switch
 * (UI_PAGE_STATE.md §5A.1). `controls` keeps only the view flags: the warehouses
 * being inspected, the outside-stock toggle, and the approval comment.
 *
 * Every computed below is a pure projection of
 * (WarehouseStorages × SKUs × the request's item rows × those children), and every
 * mutation writes only the children back. There is no mirror map and no watcher
 * syncing two copies, so the review step cannot disagree with the allocation step.
 *
 * The children are a DRAFT of the rows to be written. `Approve/PageAction.js`
 * clears them and lets the Layer 2 builder's own node replace them at submit time,
 * so the wizard shape never reaches GAS.
 */

const PARENT = 'OutletRestocks'
const CHILD = 'OutletRestockItems'
// ONE warehouse selection, not a default plus a list of extras. The split forced
// the approver to answer two questions ("which warehouse?" then "which others?")
// to express one intent, and made "deselect the warehouse I am allocating from"
// unreachable from the second control. Allocation draws from every selected
// warehouse; the order they were picked in carries no meaning.
const WAREHOUSES = 'ApprovalWarehouses'
const SHOW_OUTSIDE = 'ApprovalShowOutsideStock'

// The unit a SKU is counted in when its own `UOM` column is blank. A discrete
// count is what an unconfigured SKU is already treated as everywhere else, so
// this states that assumption rather than rendering a bare number.
const DEFAULT_UOM = 'PCS'

const text = (value) => String(value ?? '').trim()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// `useRecord().items` CAN CONTAIN `null` — see `useRestockAllocation.js`'s `asRow` for
// the full account. A null degrades to an empty row here and is then dropped by the
// field checks, rather than being waved through one guard and dereferenced by the next.
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

const ITEMS = 'OutletRestockItems'
const MOVEMENTS = 'StockMovements'
const APPROVED_COMMENT = 'ProgressApprovedComment'

/**
 * The approver's plan, read back off the LIVE `OutletRestockItems` node.
 *
 * That node holds the rows this batch will actually write — there is no second
 * draft copy. `_sourceCode` names the requested line a row descends from and
 * `_cancelled` marks a remainder the approver gave up on; `build()` strips both,
 * so neither reaches GAS.
 */
export function readApprovalPlan (pageState) {
  const plan = {}
  ;(pageState?.getRecordRows?.(ITEMS) || []).forEach((raw) => {
    const row = asRow(raw)
    const code = text(row._sourceCode)
    if (!code) return
    if (!plan[code]) plan[code] = { lines: [], cancelled: false }
    if (row._cancelled === true) plan[code].cancelled = true
    if (text(row.Progress) !== 'ALLOCATED') return
    plan[code].lines.push({
      warehouseCode: text(row.WarehouseCode),
      storageName: text(row.StorageName),
      quantity: num(row.Quantity)
    })
  })
  return plan
}

// Everything the approval writes, dropped in one go. The parent node itself stays —
// it carries the warehouse selection and the comment, and `hasNodes` gates the bar.
export function clearApprovalPlan (pageState) {
  pageState.removeNode(ITEMS)
  pageState.removeNode(MOVEMENTS)
  pageState.excludeAdditionalAction()
  // The note is the approver's own input, not part of the plan, so it survives a clear.
  const note = pageState.getRecord(APPROVED_COMMENT, PARENT)
  pageState.setResource(PARENT, { record: note ? { [APPROVED_COMMENT]: note } : {} })
}

export function useRestockApproval () {
  // Injected once for both the Approve and Reallocate routes, by the relay
  // (§6.1) — not a second time here.
  const { pageState, resourceRecord } = useRestockApprovalContext()

  // Same accessor idiom as the rest of the restock flow, so this file imports no
  // store (ARCHITECTURE RULES §5).
  const restocks = useRecord(PARENT)
  const restockItems = useRecord(CHILD)
  const outlets = useRecord('Outlets')
  const warehouses = useRecord('Warehouses')
  const warehouseStorages = useRecord('WarehouseStorages')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')

  // The SKU × Product and Warehouse joins are the resource layer's, not this file's
  // (§6 — Enrich Once, Then Project). The `useRecord` handles above stay for their
  // `reload()` in `onMounted` — fetching the rows is a separate concern from reading
  // them, and these accessors are what the rest of the restock flow fetches with.
  const { getSku } = useSkuResource()
  const { getWarehouse } = useWarehouseResource()

  const parent = pageState.useNode(PARENT)
  const serverRecord = computed(() => resourceRecord?.record?.value || null)

  const { user } = useAuth()
  const actor = () => user.value?.name || user.value?.email || ''

  // ── Plan accessors ─────────────────────────────────────────────────────────
  // ONE representation. What the cards read and what `submit` ships are the same
  // node: every mutation runs the Layer 2 builder and applies its nodes STRAIGHT
  // AWAY, so the batch is complete and inspectable at every step and `submit` has
  // nothing left to assemble (UI_PAGE_STATE.md §5A).
  const plan = computed(() => readApprovalPlan(pageState))

  function writePlan (next) {
    const record = serverRecord.value || {}
    const items = pendingItems.value
    const entryOf = (item) => (next || {})[text(item.Code)] || {}

    // Nothing decided yet means nothing to write. Leaving the nodes up would put an
    // APPROVED parent and a set of unchanged item rows in the batch for a page the
    // approver has only looked at.
    const decided = items.filter((item) => planAllocatedQty(entryOf(item)) > 0 || entryOf(item).cancelled === true)
    if (!text(record.Code) || !decided.length) {
      clearApprovalPlan(pageState)
      return
    }

    const nodes = isInitialApproval.value
      ? buildRestockAllocationNodes(record, items.flatMap((item) => splitApprovalRows(item, entryOf(item))), actor(), comment.value)
      : buildPendingRestockAllocationNodes(
        record,
        items.filter((item) => planAllocatedQty(entryOf(item)) > 0).flatMap((item) => pendingAllocationRows(item, entryOf(item))),
        actor(),
        comment.value
      )

    pageState.applyNodes([...nodes, ...cancelNodesFor(next, items)])
  }

  // Cancelling a remainder moves no stock, so it is a queued executeAction rather
  // than a row in the bulk write. Only a remainder that still EXISTS can be given
  // up on — striking out a line that was fully allocated would cancel stock the
  // approver just committed.
  function cancelNodesFor (next, items) {
    const rows = items
      .filter((item) => {
        const entry = (next || {})[text(item.Code)] || {}
        return entry.cancelled === true && num(item.Quantity) - planAllocatedQty(entry) > 0
      })
      .map((item) => ({ Code: text(item.Code), Progress: 'PENDING' }))
    if (!rows.length) return []
    return buildRestockCancelItemNodes(
      serverRecord.value || {},
      rows,
      actor(),
      comment.value || 'Cancelled: no warehouse stock available.'
    )
  }

  // ── Hydration ──────────────────────────────────────────────────────────────
  // An `_action/:action` route is a custom sub-route: `usePageResolver` loads no
  // record for it (UI_PAGE_AND_SECTION_SYSTEM.md §1.3.3), so the node is created
  // and seeded here. It must exist for `PageAction` to render the sticky bar at
  // all — `hasNodes` gates it (UI_ACTION_SYSTEM.md §3.1).
  // Whether the node was already built for THIS request is asked of the node's own
  // `code` — there is no bookkeeping control for it. FOUR components call this
  // composable (`WarehouseAndLocation` and `ItemAllocating` at step 1,
  // `ReviewAllocating` and `ReviewPending` at step 2) and each call gets its own
  // closure, so a per-call `let hydratedKey` would start empty when the step-2 cards
  // MOUNT and re-run the pass, wiping the plan built on step 1.
  const hydratedFor = () => (pageState.hasNode(PARENT) ? text(parent.node.value.code) : '')

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

    // The node carries the approval's OWN writes, not a copy of the loaded row: a
    // full `load` here would put every column of the request into the batch.
    clearApprovalPlan(pageState)

    // Seed the note from the LAST approval pass on THIS request: an already-APPROVED
    // request comes back to have its leftover PENDING lines allocated, and the note
    // written the first time is usually most of the note wanted the second.
    pageState.setRecord(APPROVED_COMMENT, text(record.ProgressApprovedComment), PARENT)
  }

  watch([serverRecord, () => parent.identifier.value], () => { hydrate() }, { immediate: true })

  onMounted(() => {
    // `usePageResolver` loads NOTHING for an `_action/:action` route — a custom
    // sub-route is expected to fetch what it needs itself
    // (UI_PAGE_AND_SECTION_SYSTEM.md §1.3.3). That includes the request itself:
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
    const raw = pageState.getControls(WAREHOUSES, null, PARENT)
    return Array.from(new Set((Array.isArray(raw) ? raw : []).map(text).filter(Boolean)))
  })
  const showOutsideStock = computed(() => pageState.getControls(SHOW_OUTSIDE, null, PARENT) === true)
  // The note is a COLUMN, bound straight to the parent record — not a control. It exists
  // only on an initial approval: a later allocation never writes the parent, and there is
  // no other column for it to land in, so that route does not collect one.
  const commentField = pageState.useRecord(APPROVED_COMMENT, PARENT)
  const comment = computed(() => (isInitialApproval.value ? text(commentField.value) : ''))

  function setSelectedWarehouses (codes) {
    pageState.setControls(WAREHOUSES, Array.isArray(codes) ? codes.map(text).filter(Boolean) : [], PARENT)
  }
  function setShowOutsideStock (value) { pageState.setControls(SHOW_OUTSIDE, value === true, PARENT) }
  function setComment (value) { commentField.value = value ?? '' }

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
   * The display name of a SKU, read off the enriched SKU record.
   *
   * A SKU carries its variant VALUES in positional `Variant1..N` columns, and the
   * product names those positions through its `VariantTypes` CSV — so the values
   * are only meaningful in the product's own order. That join, and the five-column
   * cap, are `enrichSku`'s job; this function used to redo both by scanning the SKUs
   * array and then the Products array for every row it labelled, which made the
   * projection below O(rows × (skus + products)) and was a third copy of an
   * enrichment that already exists (§6 — Enrich Once, Then Project).
   */
  function skuLabel (sku) {
    const code = text(sku)
    if (!code) return { primary: 'Item', secondary: '' }
    const info = getSku(code) || {}
    const variants = (info.variantValues || []).filter(Boolean).join(' / ')
    return {
      primary: text(info.productName) || code,
      secondary: variants || code,
      // The grouping key for the allocation cards. Falls back to the SKU so a SKU
      // with no product still forms its own group rather than collapsing every
      // orphan into one nameless card — which is why it keys off whether the
      // product was actually RESOLVED, not off the SKU's `ProductCode` column: a
      // SKU pointing at a product that no longer exists is an orphan too.
      productCode: (info._product ? text(info.productCode) : '') || code,
      // The unit every quantity on this line is counted in. It lives on the SKU
      // row — `Products` carries no UOM column — so there is nothing to fall back
      // to but the default. `PCS` is the safe default because a discrete count is
      // what an unconfigured SKU is already being treated as everywhere else.
      uom: text(info.uom) || DEFAULT_UOM
    }
  }

  function warehouseName (code) {
    return text(getWarehouse(text(code))?.name) || text(code) || '—'
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
  // Every SKU's candidate bins, indexed in ONE pass over `WarehouseStorages` (§6 —
  // Indexed Joins). `binsFor` used to call `storageBinsForSku`, which scans the whole
  // sheet, once per requested line; with the index each line is a Map read.
  const binsBySku = computed(() => indexStorageBinsBySku(warehouseStorages.items.value))

  // Membership is asked once per BIN, so the selection is read as a Set rather than
  // re-scanned with `includes` for every bin of every row.
  const activeWarehouseSet = computed(() => new Set(activeWarehouses.value))

  function binsFor (sku) {
    const selected = activeWarehouseSet.value
    return sortBinsLeastFirst((binsBySku.value.get(text(sku)) || []).map((bin) => {
      const committed = consumption.value[stockKey(sku, bin.warehouseCode, bin.storageName)] || 0
      return {
        id: bin.id,
        warehouseCode: bin.warehouseCode,
        warehouseName: warehouseName(bin.warehouseCode),
        storageName: bin.storageName,
        onHand: num(bin.available),
        available: Math.max(num(bin.available) - committed, 0),
        outside: !selected.has(bin.warehouseCode)
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
    const lines = (entry.lines || []).map((line) => ({
      ...line,
      warehouseName: warehouseName(line.warehouseCode),
      key: binKey(line.warehouseCode, line.storageName)
    }))
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
      lines,
      bins,
      visibleBins,
      // Carried ON the row so the cards and the mutations address a line or a bin by
      // key instead of scanning the arrays inside a `v-for` (§6 — Indexed Joins).
      // Built here, once per row per recompute, rather than per lookup.
      linesByKey: new Map(lines.map((line) => [line.key, line])),
      binsById: new Map(bins.map((bin) => [bin.id, bin])),
      // Everything the approver could still draw on, inside the selected
      // warehouses — what decides whether a line is fully, partly, or not coverable.
      coverable: bins.filter((bin) => !bin.outside).reduce((sum, bin) => sum + bin.available, 0) + allocated,
      status: remainder === 0 && allocated > 0
        ? 'full'
        : (allocated > 0 ? 'partial' : (entry.cancelled === true ? 'cancelled' : 'none'))
    }
  }))

  // Every mutation below addresses a row by Code, so the lookup is indexed rather than
  // a scan of `rows` per keystroke and per click (§6 — Indexed Joins).
  const rowsByCode = computed(() => new Map(rows.value.map((row) => [row.code, row])))
  const rowFor = (code) => rowsByCode.value.get(text(code)) || null

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

  // The comment is stamped ONTO the rows, so the live batch has to be re-cut when it
  // changes. Keyed off the comment itself, never off the node the rebuild writes, so
  // this cannot feed itself.
  watch([comment, isInitialApproval], () => {
    const current = plan.value
    if (Object.keys(current).length) writePlan(current)
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
    const row = rowFor(code)
    if (!row) return
    const key = binKey(warehouseCode, storageName)
    const existing = row.linesByKey.get(key)
    const held = num(existing?.quantity)
    const bin = row.binsById.get(key)
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
    const row = rowFor(code)
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
   *
   * So this deliberately keeps N recomputes of `rows` — batching the writes would
   * break the netting, which is a correctness property, not a performance one. What
   * made that expensive was the per-row scanning inside `rows`, not the loop: the
   * bin index is keyed off `WarehouseStorages` alone and the labels off the SKU
   * aggregate, so neither is invalidated by a plan write. A recompute is now a walk
   * of the requested lines with Map reads, and this loop is O(lines²) in Map reads
   * rather than O(lines² × storages) in comparisons.
   */
  function autoAllocateAll () {
    rows.value.forEach((row) => { if (!row.cancelled) autoAllocateRow(row.code) })
  }

  // Product-level bulk actions. Which SKUs belong to a product is a domain fact,
  // so the card asks for it rather than re-deriving the grouping to loop over.
  // `productGroups` already indexed the rows by product, so this reads that grouping
  // instead of re-filtering every row per click.
  const rowCodesByProduct = computed(() => {
    const map = new Map()
    rows.value.forEach((row) => {
      if (!map.has(row.productCode)) map.set(row.productCode, [])
      map.get(row.productCode).push(row.code)
    })
    return map
  })

  function skuCodesIn (productCode) {
    return rowCodesByProduct.value.get(text(productCode)) || []
  }

  function autoAllocateProduct (productCode) {
    // Re-read per code, for the same netting reason `autoAllocateAll` does.
    skuCodesIn(productCode).forEach((code) => {
      const row = rowFor(code)
      if (row && !row.cancelled) autoAllocateRow(code)
    })
  }

  function clearProduct (productCode) {
    skuCodesIn(productCode).forEach((code) => clearLines(code))
  }

  function resetPlan () {
    clearApprovalPlan(pageState)
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
