import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useRestockFormContext } from './useRestockFormContext'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useOutletStorageResource } from 'src/_resource/Operation/OutletStorages/composables/useOutletStorageResource'
import { useWarehouseStorageResource } from 'src/_resource/Operation/WarehouseStorages/composables/useWarehouseStorageResource'
import {
  stockMatchFigures,
  clampRestockQuantity
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockStockMatch'

/**
 * OutletRestocks — the UI half of the stock-match aggregate behind `AdjustItems`
 * and `NewItems`.
 *
 * PRESENTATION ONLY (UI_RESOURCE_DOMAIN_LOGIC.md §4). The ARITHMETIC — existing +
 * restock = final, what the source warehouse is left with, and the `maxQuantity` ceiling
 * that makes a DIRECT restock bounded and a standard one unbounded — is domain, and now
 * lives in `src/_resource/Operation/OutletRestocks/composables/useRestockStockMatch`.
 * What stays here is the projection the two cards render, the `useSkuResource`
 * label lookup, and the pageState child bookkeeping.
 *
 * RESOURCE tier, not `Add/` (§6.2). It used to sit under `Add/` — written when
 * the Add wizard was its only caller — but `AdjustItems`/`NewItems` are resource-
 * tier cards that BOTH `Add.js` and `Edit.js` resolve, and a `.vue` file has one
 * import line per composable: left under `Add/`, the Edit page could only reach
 * this aggregate by copying both cards. It sits at the tier of its most general
 * consumer, which is where those two cards already are.
 *
 * It no longer calls `inject()` itself — `useRestockFormContext`, the one relay
 * shared by the Add and Edit pages, owns that (§6.1).
 *
 * ONE reactive source of truth (ARCHITECTURE RULES §6): the restock quantity of
 * every SKU is read straight back out of `pageState`'s `OutletRestockItems`
 * child bucket. There is no mirror map, no local quantity ref and no watcher
 * syncing the two — `rows` is a pure projection of
 * (SKUs × Products × OutletStorages × WarehouseStorages × pageState children),
 * and `setQuantity`/`adjustQuantity` write only to pageState. A SKU is therefore
 * an active child row exactly while its quantity is > 0, which is the invariant
 * `Add/PageAction.js` validates before letting the wizard advance.
 *
 * Both step-2 cards call this independently; they still agree because neither
 * of them owns any state.
 */
const CHILD = 'OutletRestockItems'
const PARENT = 'OutletRestocks'

const text = (value) => String(value ?? '').trim()
// SKU codes reach this file from three independent sources — the SKUs sheet, the
// outlet/warehouse storage rows, and the restock's own child lines — so they are
// only ever compared through this normalizer. Matching them raw let a difference
// in case or padding hide an existing line: the lookup missed it, `+` opened a
// SECOND line for the same SKU, and from then on the card displayed one line's
// quantity while the buttons edited the other's, leaving a line the UI could no
// longer reach but the payload still carried.
const key = (value) => text(value).toLowerCase()
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const isActive = (row) => (row?.Status || 'Active') === 'Active'

export function useRestockStockMatch () {
  // Injected once for the Add + Edit pages, by the shared relay (§6.1).
  const { pageState } = useRestockFormContext()
  // Rows come through `useRecord`, the same accessor step 1 loads them with, so
  // this file imports no store either — the whole restock flow reads resources
  // through one idiom.
  const { skuInfo } = useSkuResource()

  const skus = useRecord('SKUs').items
  // Both stock sides come from their OWN resource's domain index (outlet × SKU and
  // warehouse × SKU, each built once for the whole app) rather than from a filter over the
  // storage sheet per code — this recomputes on every keystroke in the quantity field.
  const { stockObjectOf: outletStockObjectOf } = useOutletStorageResource()
  const { stockObjectOf: warehouseStockObjectOf } = useWarehouseStorageResource()

  const parent = pageState.useNode(PARENT)
  const childEntries = parent.children(CHILD)

  const outletCode = computed(() => text(parent.record.value.OutletCode))
  const isDirect = computed(() => pageState.getControlField(PARENT, 'RestockMode') === 'DIRECT')
  const warehouseCode = computed(() => (isDirect.value ? text(pageState.getControlField(PARENT, 'WarehouseCode')) : ''))

  // Stock on hand at the chosen outlet, and — direct mode only — at the source
  // warehouse. Both are summed per SKU because a SKU can sit in several storages.
  const outletQuantities = computed(() => outletStockObjectOf(outletCode.value))
  const warehouseQuantities = computed(() => (warehouseCode.value ? warehouseStockObjectOf(warehouseCode.value) : {}))

  // Quantities keyed by NORMALIZED SKU, read live off pageState. Deactivated rows
  // count as zero so a soft-deleted line renders as "not requested" rather than
  // lingering.
  //
  // Summed, not assigned. While duplicate lines for one SKU exist, assignment made
  // the last one silently win, so the card displayed a number that was not what the
  // payload would send — and the buttons, which edit the FIRST match, appeared dead
  // because their writes landed on a line nothing was reading.
  const quantities = computed(() => {
    const totals = {}
    childEntries.value.forEach((entry) => {
      if (entry._action === 'deactivate') return
      const sku = key(entry.data.SKU)
      if (sku) totals[sku] = (totals[sku] || 0) + num(entry.data.Quantity)
    })
    return totals
  })

  // Direct mode can only move stock that exists in the source warehouse, so the
  // catalogue is the union of what the warehouse holds and what the outlet
  // already stocks. A standard request goes to an approver who allocates later,
  // so there the whole active SKU catalogue is offered.
  const availableSkus = computed(() => {
    const active = skus.value.filter(isActive).map((row) => text(row.Code)).filter(Boolean)
    if (!isDirect.value) return active
    const stocked = new Set([...Object.keys(warehouseQuantities.value), ...Object.keys(outletQuantities.value)])
    return active.filter((code) => stocked.has(code))
  })

  const rows = computed(() => {
    if (!outletCode.value) return []
    return availableSkus.value.map((sku) => {
      const info = skuInfo(sku) || {}
      const variantLabel = (info.variantValues || []).filter(Boolean).join(' / ')
      return {
        SKU: sku,
        productCode: text(info.productCode) || 'UNGROUPED',
        productName: text(info.productName) || 'Unassigned product',
        // The variant values are what distinguishes one SKU of a product from
        // another; with no variant types configured the code is the only label left.
        variantLabel: variantLabel || sku,
        // The five quantity figures come from the domain layer, so the ceiling this
        // card enforces is the same one the payload is built against.
        ...stockMatchFigures({
          outletQuantity: outletQuantities.value[sku] || 0,
          warehouseQuantity: warehouseQuantities.value[sku] || 0,
          restockQuantity: quantities.value[key(sku)] || 0,
          isDirect: isDirect.value
        })
      }
    }).sort((a, b) => a.productName.localeCompare(b.productName) || a.variantLabel.localeCompare(b.variantLabel))
  })

  // `setQuantity`/`adjustQuantity` run on every +/- tap and every typed digit, and both
  // address a row by SKU. Indexed rather than scanned over the whole catalogue, which in
  // standard mode is every active SKU in the system (§6 — Indexed Joins).
  const rowsBySku = computed(() => new Map(rows.value.map((row) => [row.SKU, row])))

  const existingRows = computed(() => rows.value.filter((row) => row.outletQuantity > 0))
  const newRows = computed(() => rows.value.filter((row) => row.outletQuantity <= 0))
  const totalRestockQuantity = computed(() => rows.value.reduce((sum, row) => sum + row.restockQuantity, 0))

  function groupTotal (group, key) {
    return (group?.items || []).reduce((sum, row) => sum + num(row[key]), 0)
  }

  // EVERY entry for this SKU (deactivated included, so a soft-deleted line is
  // restored rather than duplicated), lowest index first. Duplicates should not
  // exist — but when they do, the writer below has to fold them back into one
  // line instead of silently editing whichever one it happened to find first.
  function matchingEntries (sku) {
    const target = key(sku)
    return childEntries.value.filter((entry) => key(entry.data.SKU) === target)
  }

  // Zero means "not requested". A persisted line must be soft-deleted so GAS
  // deactivates it; a line only ever held in this form is simply dropped.
  //
  // Addressed by entry IDENTITY, not by a captured index: removing a line splices
  // the bucket, which would shift every index captured before it. usePageState
  // documents entry identity as stable across reads, so indexOf is the supported
  // way back to a position.
  function dropEntry (entry) {
    const index = childEntries.value.indexOf(entry)
    if (index < 0) return
    if (text(entry.data.Code)) pageState.setChildAction(PARENT, CHILD, index, 'deactivate')
    else pageState.removeChild(PARENT, CHILD, index)
  }

  function setQuantity (sku, value) {
    const row = rowsBySku.value.get(sku)
    if (!row) return
    const quantity = clampRestockQuantity(value, row.maxQuantity)
    const entries = matchingEntries(sku)

    if (!entries.length) {
      if (quantity > 0) pageState.addChild(PARENT, CHILD, { SKU: sku, Quantity: quantity, Progress: 'PENDING', Status: 'Active' })
      return
    }

    // The line that survives is a persisted one when there is one, so an edit
    // patches the existing server row instead of orphaning it behind a new line.
    const keeper = entries.find((entry) => text(entry.data.Code)) || entries[0]

    // Fold every other line for this SKU away first, so one SKU is one line again
    // and the next read of `quantities` agrees with what these buttons just wrote.
    entries.filter((entry) => entry !== keeper).forEach(dropEntry)

    if (quantity > 0) {
      const index = childEntries.value.indexOf(keeper)
      pageState.updateChild(PARENT, CHILD, index, { Quantity: quantity })
      // Restore a line the user had zeroed out earlier in the same session.
      if (keeper._action === 'deactivate') pageState.setChildAction(PARENT, CHILD, index, text(keeper.data.Code) ? 'update' : 'create')
      return
    }

    dropEntry(keeper)
  }

  function adjustQuantity (sku, delta) {
    const row = rowsBySku.value.get(sku)
    if (!row) return
    // Stepped off the live total rather than off `row.restockQuantity`: `rows` is a
    // projection, and reading the source directly keeps a rapid second click from
    // stepping off a value the first click already superseded.
    setQuantity(sku, (quantities.value[key(sku)] || 0) + delta)
  }

  return {
    // Relayed on so `AdjustItems`/`NewItems` — which already import this file
    // and need nothing else from the context — can gate on `meta.currentStep`
    // without a second import line (§6).
    pageState,
    isDirect,
    outletCode,
    warehouseCode,
    rows,
    existingRows,
    newRows,
    totalRestockQuantity,
    groupTotal,
    setQuantity,
    adjustQuantity
  }
}
