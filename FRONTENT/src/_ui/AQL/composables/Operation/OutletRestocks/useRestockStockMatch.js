import { computed, inject } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useProductSkuResolver } from 'src/composables/master/products/useProductSkuResolver'

/**
 * OutletRestocks › Add › step 2 — the stock-match aggregate behind `AdjustItems`
 * and `NewItems`.
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
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const isActive = (row) => (row?.Status || 'Active') === 'Active'

export function useRestockStockMatch () {
  const pageState = inject('pageState', null)
  // Rows come through `useRecord`, the same accessor step 1 loads them with, so
  // this file imports no store either — the whole restock flow reads resources
  // through one idiom.
  const { skuInfo } = useProductSkuResolver()

  const skus = useRecord('SKUs').items
  const outletStorages = useRecord('OutletStorages').items
  const warehouseStorages = useRecord('WarehouseStorages').items

  const parent = pageState.useNode(PARENT)
  const childEntries = parent.children(CHILD)

  const outletCode = computed(() => text(parent.record.value.OutletCode))
  const isDirect = computed(() => pageState.getControlField(PARENT, 'RestockMode') === 'DIRECT')
  const warehouseCode = computed(() => (isDirect.value ? text(pageState.getControlField(PARENT, 'WarehouseCode')) : ''))

  // Stock on hand at the chosen outlet, and — direct mode only — at the source
  // warehouse. Both are summed per SKU because a SKU can sit in several storages.
  const outletQuantities = computed(() => sumBySku(outletStorages.value, (row) => text(row.OutletCode) === outletCode.value))
  const warehouseQuantities = computed(() => sumBySku(warehouseStorages.value, (row) => !!warehouseCode.value && text(row.WarehouseCode) === warehouseCode.value))

  function sumBySku (source, predicate) {
    const totals = {}
    source.filter(isActive).filter(predicate).forEach((row) => {
      const sku = text(row.SKU)
      if (!sku) return
      totals[sku] = (totals[sku] || 0) + num(row.Quantity)
    })
    return totals
  }

  // Quantities keyed by SKU, read live off pageState. Deactivated rows count as
  // zero so a soft-deleted line renders as "not requested" rather than lingering.
  const quantities = computed(() => {
    const totals = {}
    childEntries.value.forEach((entry) => {
      if (entry._action === 'deactivate') return
      const sku = text(entry.data.SKU)
      if (sku) totals[sku] = num(entry.data.Quantity)
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
      const outletQuantity = outletQuantities.value[sku] || 0
      const warehouseQuantity = warehouseQuantities.value[sku] || 0
      const restockQuantity = quantities.value[sku] || 0
      return {
        SKU: sku,
        productCode: text(info.productCode) || 'UNGROUPED',
        productName: text(info.productName) || 'Unassigned product',
        // The variant values are what distinguishes one SKU of a product from
        // another; with no variant types configured the code is the only label left.
        variantLabel: variantLabel || sku,
        outletQuantity,
        warehouseQuantity,
        restockQuantity,
        finalQuantity: outletQuantity + restockQuantity,
        warehouseRemaining: warehouseQuantity - restockQuantity,
        // Standard requests are unbounded — the approver allocates against real
        // stock later. Direct allocation cannot exceed the source warehouse.
        maxQuantity: isDirect.value ? warehouseQuantity : Infinity
      }
    }).sort((a, b) => a.productName.localeCompare(b.productName) || a.variantLabel.localeCompare(b.variantLabel))
  })

  const existingRows = computed(() => rows.value.filter((row) => row.outletQuantity > 0))
  const newRows = computed(() => rows.value.filter((row) => row.outletQuantity <= 0))
  const totalRestockQuantity = computed(() => rows.value.reduce((sum, row) => sum + row.restockQuantity, 0))

  function groupTotal (group, key) {
    return (group?.items || []).reduce((sum, row) => sum + num(row[key]), 0)
  }

  // Index across ALL entries (deactivated included) so an existing line that was
  // soft-deleted is restored rather than duplicated.
  function entryIndex (sku) {
    return childEntries.value.findIndex((entry) => text(entry.data.SKU) === text(sku))
  }

  function setQuantity (sku, value) {
    const row = rows.value.find((item) => item.SKU === sku)
    if (!row) return
    const quantity = Math.min(Math.max(0, Math.floor(num(value))), row.maxQuantity)
    const index = entryIndex(sku)

    if (index < 0) {
      if (quantity > 0) pageState.addChild(PARENT, CHILD, { SKU: sku, Quantity: quantity, Progress: 'PENDING', Status: 'Active' })
      return
    }

    const entry = childEntries.value[index]
    if (quantity > 0) {
      pageState.updateChild(PARENT, CHILD, index, { Quantity: quantity })
      // Restore a line the user had zeroed out earlier in the same session.
      if (entry._action === 'deactivate') pageState.setChildAction(PARENT, CHILD, index, text(entry.data.Code) ? 'update' : 'create')
      return
    }

    // Zero means "not requested". A persisted line must be soft-deleted so GAS
    // deactivates it; a line only ever held in this wizard is simply dropped.
    if (text(entry.data.Code)) pageState.setChildAction(PARENT, CHILD, index, 'deactivate')
    else pageState.removeChild(PARENT, CHILD, index)
  }

  function adjustQuantity (sku, delta) {
    const row = rows.value.find((item) => item.SKU === sku)
    if (row) setQuantity(sku, row.restockQuantity + delta)
  }

  return {
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
