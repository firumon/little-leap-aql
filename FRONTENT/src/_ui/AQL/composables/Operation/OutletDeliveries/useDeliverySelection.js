import { computed } from 'vue'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import {
  availableAllocatedItems,
  itemsSelectableFor
} from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryAllocation'
import { ITEM_DELIVERED } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'
import { useDeliveryFormContext } from './useDeliveryFormContext'

// Layer 2 says which lines can be picked. This file only shapes them for the screen.
// Every join is a Map built in one pass, so the tree stays cheap to rebuild.

const SELECTION = 'DeliverySelection'
const WAREHOUSE_FILTER = 'DeliveryWarehouseFilter'
const GROUP_BY = 'DeliveryGroupBy'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})

const UNSPECIFIED = {
  province: 'Unspecified province',
  city: 'Unspecified city',
  area: 'Unspecified area',
  storage: 'Unassigned storage'
}

export const GROUP_BY_OPTIONS = [
  { label: 'Province', value: 'Province' },
  { label: 'City', value: 'City' },
  { label: 'Area', value: 'Area' },
  { label: 'Outlet', value: 'Outlet' },
  { label: 'Product', value: 'Product' }
]

const DEFAULT_GROUP_BY = 'City'

const joinParts = (...parts) => parts.map(text).filter(Boolean).join(' • ')

const GAP_LABELS = new Set(Object.values(UNSPECIFIED))

const DEFAULT_UOM = 'PCS'

const countLabel = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`

/** Quantities only add up inside one unit of measure, so totals are reported per UOM. */
const unitsLabel = (rows) => {
  const byUom = new Map()
  for (const row of rows) {
    byUom.set(row.uom, (byUom.get(row.uom) || 0) + row.quantity)
  }
  return [...byUom.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([uom, quantity]) => `${quantity} ${uom}`)
    .join(' • ')
}

/** A place sorts by name, but a data gap sinks to the bottom of its level. */
const byLabel = (a, b) => {
  const gapA = GAP_LABELS.has(a.label)
  const gapB = GAP_LABELS.has(b.label)
  if (gapA !== gapB) return gapA ? 1 : -1
  return a.label.localeCompare(b.label)
}

export function useDeliverySelection (options = {}) {
  const { pageState, resource } = useDeliveryFormContext()

  // A getter rather than a value, so Edit's record can arrive after the first call.
  const currentRecord = typeof options.record === 'function' ? options.record : () => null

  const restockItems = resource('OutletRestockItems')
  const restocks = resource('OutletRestocks')
  const deliveries = resource('OutletDeliveries')
  const outlets = resource('Outlets')
  const skus = resource('SKUs')
  const products = resource('Products')
  const warehouses = resource('Warehouses')

  const { getOutlet } = useOutletResource()
  const { skuLabelOf } = useSkuResource()
  const { getWarehouse } = useWarehouseResource()

  /** Parent restock -> its outlet code. The line's only route to an outlet. */
  const outletCodeByRestock = computed(() => {
    const map = new Map()
    for (const raw of restocks.items.value) {
      const row = asRow(raw)
      const code = text(row.Code)
      if (code) map.set(code, text(row.OutletCode))
    }
    return map
  })

  // Spread the source row first, so no consumer has to go back to the store for a column.
  const selectableItems = computed(() => {
    const record = currentRecord()
    const rows = record
      ? itemsSelectableFor(record, restockItems.items.value, deliveries.items.value)
      : availableAllocatedItems(restockItems.items.value, deliveries.items.value)

    const outletByRestock = outletCodeByRestock.value

    return rows.map((row) => {
      const restockCode = text(row.OutletRestockCode)
      const outletCode = outletByRestock.get(restockCode) || ''
      const outlet = outletCode ? getOutlet(outletCode) : null
      const skuCode = text(row.SKU)
      const sku = skuLabelOf(skuCode)
      const warehouseCode = text(row.WarehouseCode)
      const warehouse = warehouseCode ? getWarehouse(warehouseCode) : null

      return {
        ...row,
        outletCode,
        outletName: text(outlet?.Name) || outletCode || 'Unknown outlet',
        province: text(outlet?.Province) || UNSPECIFIED.province,
        city: text(outlet?.City) || UNSPECIFIED.city,
        area: text(outlet?.Area) || UNSPECIFIED.area,
        skuCode,
        productName: text(sku.primary) || skuCode,
        skuVariant: text(sku.secondary),
        uom: text(sku.uom).toUpperCase() || DEFAULT_UOM,
        warehouseCode,
        warehouseName: text(warehouse?.name) || warehouseCode,
        storageName: text(row.StorageName) || UNSPECIFIED.storage,
        restockCode,
        quantity: Math.abs(Number(row.Quantity) || 0),
        // A line already handed over is shown but LOCKED: those units are on a shelf and the
        // payload builder refuses to drop them.
        locked: text(row.Progress) === ITEM_DELIVERED
      }
    })
  })

  /** Warehouses actually represented in the queue — the selector's whole option set. */
  const warehouseOptions = computed(() => {
    const seen = new Map()
    for (const row of selectableItems.value) {
      if (row.warehouseCode && !seen.has(row.warehouseCode)) {
        seen.set(row.warehouseCode, { label: row.warehouseName, value: row.warehouseCode })
      }
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label))
  })

  const warehouseFilter = computed(() =>
    text(pageState?.getControlField(SELECTION, WAREHOUSE_FILTER)))

  const setWarehouseFilter = (value) =>
    pageState?.setControlField(SELECTION, WAREHOUSE_FILTER, text(value))

  const selectedWarehouse = computed(() =>
    warehouseOptions.value.find((option) => option.value === warehouseFilter.value) || null)

  const groupBy = computed(() =>
    text(pageState?.getControlField(SELECTION, GROUP_BY)) || DEFAULT_GROUP_BY)

  const setGroupBy = (value) =>
    pageState?.setControlField(SELECTION, GROUP_BY, text(value) || DEFAULT_GROUP_BY)

  /** The queue after the warehouse filter — what the tree actually renders. */
  const visibleItems = computed(() => {
    const filter = warehouseFilter.value
    if (!filter) return selectableItems.value
    return selectableItems.value.filter((row) => row.warehouseCode === filter)
  })

  // Same node shape at every depth, so the renderer can walk it without knowing the mode.

  const outletLevel = (omit) => ({
    key: (row) => row.outletCode || row.outletName,
    label: (row) => row.outletName,
    // Drop whatever the level above already names.
    caption: (row) => joinParts(
      omit === 'province' ? '' : row.province,
      omit === 'city' ? '' : row.city,
      omit === 'area' ? '' : row.area)
  })

  const geoLevel = (field) => ({
    key: (row) => row[field],
    label: (row) => row[field],
    caption: () => ''
  })

  const productLevel = {
    key: (row) => row.skuCode,
    label: (row) => row.productName,
    caption: (row) => joinParts(row.skuVariant === row.productName ? '' : row.skuVariant, row.skuCode)
  }

  /** The levels above the line, plus how the line itself reads, per grouping mode. */
  const treeShape = computed(() => {
    switch (groupBy.value) {
      case 'Province':
        return { levels: [geoLevel('province'), outletLevel('province')], leaf: 'product' }
      case 'Area':
        return { levels: [geoLevel('area'), outletLevel('area')], leaf: 'product' }
      case 'Outlet':
        return { levels: [outletLevel()], leaf: 'product' }
      case 'Product':
        return { levels: [productLevel], leaf: 'outlet' }
      default:
        return { levels: [geoLevel('city'), outletLevel('city')], leaf: 'product' }
    }
  })

  const leafNode = (row, leaf) => ({
    key: text(row.Code),
    label: leaf === 'outlet' ? row.outletName : row.productName,
    // Warehouse, bin and restock code are not the picker's question on this screen — the
    // bin walk is step 2, and repeating it here buried the variant that tells SKUs apart.
    caption: leaf === 'outlet'
      ? joinParts(row.province, row.city, row.area)
      : (row.skuVariant === row.productName ? row.skuCode : row.skuVariant),
    codes: [text(row.Code)],
    quantity: row.quantity,
    quantityLabel: `${row.quantity} ${row.uom}`,
    itemCount: 1,
    locked: row.locked,
    item: row,
    children: []
  })

  /** One recursive pass: bucket rows by this level's key, then recurse or emit leaves. */
  function buildLevel (rows, levels, depth, leaf, parentKey) {
    if (depth >= levels.length) return rows.map((row) => leafNode(row, leaf))

    const level = levels[depth]
    const buckets = new Map()
    for (const row of rows) {
      const key = text(level.key(row)) || '-'
      if (!buckets.has(key)) {
        buckets.set(key, { label: text(level.label(row)), caption: level.caption(row), rows: [] })
      }
      buckets.get(key).rows.push(row)
    }

    return [...buckets.entries()]
      .map(([key, bucket]) => {
        const nodeKey = parentKey + '/' + key
        const children = buildLevel(bucket.rows, levels, depth + 1, leaf, nodeKey)
        return {
          key: nodeKey,
          label: bucket.label,
          caption: bucket.caption,
          codes: children.flatMap((child) => child.codes),
          itemCount: children.reduce((sum, child) => sum + child.itemCount, 0),
          quantity: children.reduce((sum, child) => sum + child.quantity, 0),
          locked: false,
          item: null,
          children
        }
      })
      .sort(byLabel)
  }

  const treeNodes = computed(() => {
    const { levels, leaf } = treeShape.value
    return buildLevel(visibleItems.value, levels, 0, leaf, groupBy.value)
  })

  // Held in a control field. The sticky bar reads it back to build the batch.

  const selectedCodes = computed(() => {
    const raw = pageState?.getControlField(SELECTION, 'Codes')
    return Array.isArray(raw) ? raw.map(text).filter(Boolean) : []
  })

  const selectedSet = computed(() => new Set(selectedCodes.value))

  function setSelection (codes) {
    pageState?.setControlField(SELECTION, 'Codes',
      [...new Set((codes || []).map(text).filter(Boolean))])
  }

  const isSelected = (code) => selectedSet.value.has(text(code))

  /** Locked lines are never dropped by any control — the builder would refuse anyway. */
  const lockedCodes = computed(() =>
    new Set(selectableItems.value.filter((row) => row.locked).map((row) => text(row.Code))))

  function toggleItem (row, on) {
    const code = text(asRow(row).Code)
    if (!code || asRow(row).locked) return
    const next = new Set(selectedSet.value)
    if (on === undefined ? next.has(code) : on === false) next.delete(code)
    else next.add(code)
    setSelection([...next])
  }

  function toggleCodes (codes, on) {
    const next = new Set(selectedSet.value)
    for (const code of codes) {
      const value = text(code)
      if (on) next.add(value)
      else if (!lockedCodes.value.has(value)) next.delete(value)
    }
    setSelection([...next])
  }

  // `null` is Quasar's indeterminate: some children ticked, not all.
  function groupState (codes) {
    const list = codes.map(text).filter(Boolean)
    if (!list.length) return false
    const hits = list.filter((code) => selectedSet.value.has(code)).length
    if (hits === 0) return false
    if (hits === list.length) return true
    return null
  }

  const selectedItems = computed(() =>
    selectableItems.value.filter((row) => selectedSet.value.has(text(row.Code))))

  /** The running total the toolbar and the sticky bar both report. */
  const selectionSummary = computed(() => {
    const chosen = selectedItems.value
    const outlets = new Set(chosen.map((row) => row.outletCode).filter(Boolean)).size
    return {
      items: chosen.length,
      outlets,
      label: chosen.length
        ? [countLabel(chosen.length, 'Item'), unitsLabel(chosen), countLabel(outlets, 'Outlet')]
          .filter(Boolean).join(' • ')
        : 'Nothing Selected'
    }
  })

  // ─── The warehouse pick list ────────────────────────────────────────────────

  // One flat row per bin + SKU, pre-sorted for `AqlGroupedList`.
  // Quantity is summed: the picker takes them off the shelf once, not once per outlet.
  const pickRows = computed(() => {
    const bins = new Map()

    for (const row of selectedItems.value) {
      if (!bins.has(row.storageName)) bins.set(row.storageName, new Map())
      const bySku = bins.get(row.storageName)
      if (!bySku.has(row.skuCode)) {
        bySku.set(row.skuCode, {
          key: `${row.storageName}/${row.skuCode}`,
          storageName: row.storageName,
          skuCode: row.skuCode,
          productName: row.productName,
          skuVariant: row.skuVariant,
          uom: row.uom,
          quantity: 0,
          outlets: new Map()
        })
      }
      const line = bySku.get(row.skuCode)
      line.quantity += row.quantity
      const outlet = line.outlets.get(row.outletCode)
        || { code: row.outletCode, name: row.outletName, quantity: 0 }
      outlet.quantity += row.quantity
      line.outlets.set(row.outletCode, outlet)
    }

    return [...bins.entries()]
      .sort((a, b) => byLabel({ label: a[0] }, { label: b[0] }))
      .flatMap(([, bySku]) => [...bySku.values()]
        .map((line) => ({
          ...line,
          quantityLabel: `${line.quantity} ${line.uom}`,
          outlets: [...line.outlets.values()].sort((a, b) => a.name.localeCompare(b.name))
        }))
        .sort((a, b) => a.productName.localeCompare(b.productName)))
  })

  /** Every resource the surface reads, preloaded in one place by the hydration point. */
  async function preload () {
    await Promise.all(
      [restockItems, restocks, deliveries, outlets, skus, products, warehouses]
        .map((res) => res.reload()))
  }

  return {
    SELECTION,
    GROUP_BY_OPTIONS,
    selectableItems,
    visibleItems,
    treeNodes,
    groupBy,
    setGroupBy,
    warehouseOptions,
    warehouseFilter,
    setWarehouseFilter,
    selectedWarehouse,
    selectedCodes,
    selectedItems,
    selectionSummary,
    pickRows,
    isSelected,
    toggleItem,
    toggleCodes,
    groupState,
    setSelection,
    preload
  }
}
