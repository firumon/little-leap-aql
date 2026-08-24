import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import { toDateTime24 } from 'src/utils/dateHelpers'
import {
  ITEM_DELIVERED,
  progressColor,
  progressIcon,
  progressLabel,
  orsisForDelivery,
  deliveryRatio,
  workflowStamps
} from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'
import {
  itemProgressColor,
  itemProgressIcon,
  itemProgressLabel
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'
import { useDeliveryViewContext } from './useDeliveryViewContext'

// One aggregate for all three View cards, so their numbers cannot disagree.
// A manifest names its lines in a CSV, so this file opens the item and restock sheets itself.

const DEFAULT_UOM = 'PCS'

// A raw audit key like `U0001`, as opposed to a person's name.
const isUserId = (value) => /^[A-Z]{1,3}\d{3,}$/.test(String(value || '').trim())

export function useDeliveryView () {
  const { resourceRecord } = useDeliveryViewContext()

  const restockItems = useRecord('OutletRestockItems')
  const restocks = useRecord('OutletRestocks')

  const { getOutlet } = useOutletResource()
  const { skuLabelOf } = useSkuResource()
  const { getWarehouse } = useWarehouseResource()

  const text = (value) => (value == null ? '' : String(value).trim())
  const asRow = (value) => (value && typeof value === 'object' ? value : {})

  const record = computed(() => resourceRecord?.record?.value || null)
  const pending = computed(() => resourceRecord?.loading?.value === true)

  /** The codes this manifest carries, parsed by the domain — never split here. */
  const manifestCodes = computed(() => orsisForDelivery(record.value))

  /** `Map<itemCode, row>`, one pass. Every lookup below is `O(1)` into it. */
  const itemsByCode = computed(() => {
    const map = new Map()
    for (const raw of restockItems.items.value) {
      const row = asRow(raw)
      const code = text(row.Code)
      if (code) map.set(code, row)
    }
    return map
  })

  /** Parent restock → its outlet code. An item's only route to an outlet. */
  const outletCodeByRestock = computed(() => {
    const map = new Map()
    for (const raw of restocks.items.value) {
      const row = asRow(raw)
      const code = text(row.Code)
      if (code) map.set(code, text(row.OutletCode))
    }
    return map
  })

  // An unmatched code is kept as a placeholder. Dropping it would shrink the denominator
  // and make an unfinished run look complete.
  const lines = computed(() => {
    const byCode = itemsByCode.value
    const outletByRestock = outletCodeByRestock.value

    return manifestCodes.value.map((code) => {
      const row = byCode.get(code)
      if (!row) {
        return {
          Code: code, missing: true, delivered: false, quantity: 0,
          uom: DEFAULT_UOM, quantityLabel: '',
          skuCode: code, productName: code, skuVariant: '',
          outletCode: '', outletName: 'Unresolved item', progress: ''
        }
      }
      const outletCode = outletByRestock.get(text(row.OutletRestockCode)) || ''
      const progress = text(row.Progress)
      const skuCode = text(row.SKU)
      const sku = skuLabelOf(skuCode)
      const quantity = Math.abs(Number(row.Quantity) || 0)
      const uom = text(sku.uom).toUpperCase() || DEFAULT_UOM
      return {
        ...row,
        missing: false,
        progress,
        delivered: progress === ITEM_DELIVERED,
        quantity,
        uom,
        quantityLabel: `${quantity} ${uom}`,
        skuCode,
        productName: text(sku.primary) || skuCode,
        skuVariant: text(sku.secondary),
        outletCode,
        outletName: text(getOutlet(outletCode)?.Name) || outletCode || 'Unknown outlet',
        warehouseCode: text(row.WarehouseCode),
        restockCode: text(row.OutletRestockCode)
      }
    })
  })

  /** The rows the ratio is measured against — the same set the item card renders. */
  const ratio = computed(() => deliveryRatio(record.value, lines.value))

  /** Lines grouped by outlet: how a driver reads a manifest — one stop at a time. */
  const outletGroups = computed(() => {
    const groups = new Map()
    for (const line of lines.value) {
      const key = line.outletCode || '__unresolved'
      if (!groups.has(key)) {
        groups.set(key, { outletCode: line.outletCode, outletName: line.outletName, items: [] })
      }
      groups.get(key).items.push(line)
    }
    return [...groups.values()]
      .map((group) => ({
        ...group,
        delivered: group.items.filter((line) => line.delivered).length,
        total: group.items.length,
        units: group.items.reduce((sum, line) => sum + line.quantity, 0)
      }))
      .sort((a, b) => a.outletName.localeCompare(b.outletName))
  })

  /** Distinct outlets on the run — the summary's "how many stops" figure. */
  const outletNames = computed(() =>
    outletGroups.value.map((group) => group.outletName).filter(Boolean))

  const totalUnits = computed(() =>
    lines.value.reduce((sum, line) => sum + line.quantity, 0))

  // Quantities only add up inside one unit of measure, so totals are reported per UOM.
  const unitsLabel = computed(() => {
    const byUom = new Map()
    for (const line of lines.value) {
      if (!line.quantity) continue
      byUom.set(line.uom, (byUom.get(line.uom) || 0) + line.quantity)
    }
    return [...byUom.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([uom, quantity]) => `${quantity} ${uom}`)
      .join(' • ')
  })

  /** The warehouse this run loads from — carried by the lines, not by the manifest. */
  const warehouseName = computed(() => {
    const codes = [...new Set(lines.value.map((line) => line.warehouseCode).filter(Boolean))]
    if (!codes.length) return ''
    if (codes.length > 1) return `${codes.length} warehouses`
    return text(getWarehouse(codes[0])?.name) || codes[0]
  })

  // `CreatedBy` holds a user id (`U0001`); later stamps hold the actor's name.
  // So the draft event falls back to the manifest's own `UserName`.
  // The shown time comes off the same Date the sort used, so order and label always agree.
  const timeline = computed(() => {
    const driver = text(record.value?.UserName)
    return workflowStamps(record.value).map((event) => ({
      ...event,
      by: isUserId(event.by) ? (driver || event.by) : event.by,
      at: (event.timestamp ? toDateTime24(event.timestamp) : '') || event.at
    }))
  })

  /** Every resource the cards read, preloaded in one place. */
  async function preload () {
    await Promise.all([restockItems, restocks].map((res) => res.reload()))
  }

  return {
    record,
    pending,
    manifestCodes,
    lines,
    ratio,
    outletGroups,
    outletNames,
    totalUnits,
    unitsLabel,
    warehouseName,
    timeline,
    preload,
    // Vocabulary passthroughs, so a card has ONE import for its data and its labels. The
    // manifest's own states and the LINE states come from their respective owners.
    progressColor,
    progressIcon,
    progressLabel,
    itemProgressColor,
    itemProgressIcon,
    itemProgressLabel
  }
}
