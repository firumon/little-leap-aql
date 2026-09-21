/**
 * The lines inside approved outlet restocks: what was asked for, what is kept
 * aside in a warehouse, what is still short of stock, and what reached the outlet.
 * Only lines of restocks at APPROVED, PARTIALLY_DELIVERED or DELIVERED count.
 * Lines of drafts, waiting, rejected or cancelled restocks mean nothing yet.
 *
 * Line states: PENDING = approved but no stock found yet (short),
 * ALLOCATED = stock kept aside, not sent yet, DELIVERED, CANCELLED.
 *
 * Reads:
 *   OutletRestockItems: OutletRestockCode, SKU, Quantity, Progress, Status,
 *                       WarehouseCode, ProgressAllocatedAt
 *   OutletRestocks: Code, Progress (to pick the approved restocks)
 *   SKUs + Products (through useSkuResource): product name and variants per SKU
 *   Warehouses (through useWarehouseResource): Code, Name
 *
 * Exposes:
 *   loading              - true while OutletRestockItems is loading and has no rows
 *   lineCount            - live lines (not cancelled) of approved restocks
 *   lineMix              - those lines split into Short, Kept aside, Delivered
 *   shortCount           - PENDING lines of restocks still owed (APPROVED, PARTIALLY_DELIVERED)
 *   shortSkus            - top 8 products short of stock, by quantity, caption = line count
 *   allocatedCount       - ALLOCATED lines (kept aside, not sent)
 *   allocatedByWarehouse - top 8 warehouses by kept-aside quantity, with warehouse names
 *   allocatedWait        - ALLOCATED lines in 4 age bands, age from ProgressAllocatedAt
 *   topSkus              - top 8 products by approved quantity, caption = delivered quantity
 *   askedVsDelivered     - two series for the top 6 products: approved and delivered quantity
 *   controls             - none
 *
 * Product names: a product with one SKU shows its name only. A product with many
 * SKUs shows "Product · variants". A SKU with no product shows its code.
 *
 * Controls:
 *   none
 */

import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useWarehouseResource } from 'src/_resource/Master/Warehouses/composables/useWarehouseResource'
import {
  ITEM_PENDING,
  ITEM_ALLOCATED,
  ITEM_CANCELLED,
  DELIVERED,
  AWAITING_DELIVERY,
  isActiveRow,
  bandCounts
} from './_shared'

const APPROVED_STATES = [...AWAITING_DELIVERY, DELIVERED]
const lineState = (r) => String(r.Progress || ITEM_PENDING).trim().toUpperCase()
const qty = (r) => Number(r.Quantity) || 0

export default function useRestockLineData () {
  const { rows, indexOf, isLoading, remember } = useRecord()
  const { daysSince, topN } = useDataContext()
  const { skuLabelText } = useSkuResource()
  const { getWarehouse } = useWarehouseResource()

  const sumTo = (map, key, n) => map.set(key, (map.get(key) || 0) + n)

  return remember('useRestockLineData', () => {
    const loading = computed(() => isLoading('OutletRestockItems') && rows('OutletRestockItems').length === 0)

    const parentState = computed(() => {
      const map = new Map()
      for (const [code, bucket] of indexOf('OutletRestocks', 'Code')) {
        map.set(code, String(bucket[0]?.Progress || '').trim().toUpperCase())
      }
      return map
    })

    const lines = computed(() => rows('OutletRestockItems').filter((r) =>
      isActiveRow(r) &&
      lineState(r) !== ITEM_CANCELLED &&
      APPROVED_STATES.includes(parentState.value.get(r.OutletRestockCode))))
    const lineCount = computed(() => lines.value.length)

    const short = computed(() => lines.value.filter((r) =>
      lineState(r) === ITEM_PENDING && AWAITING_DELIVERY.includes(parentState.value.get(r.OutletRestockCode))))
    const allocated = computed(() => lines.value.filter((r) => lineState(r) === ITEM_ALLOCATED))
    const delivered = computed(() => lines.value.filter((r) => lineState(r) === DELIVERED))

    const lineMix = computed(() => [
      { label: 'Short of stock', value: short.value.length },
      { label: 'Kept aside', value: allocated.value.length },
      { label: 'Delivered', value: delivered.value.length }
    ])

    const shortCount = computed(() => short.value.length)
    const shortSkus = computed(() => {
      const amount = new Map()
      const count = new Map()
      for (const r of short.value) {
        sumTo(amount, r.SKU, qty(r))
        sumTo(count, r.SKU, 1)
      }
      return topN(amount, 8).map((it) => {
        const n = count.get(it.label) || 0
        return {
          label: skuLabelText(it.label),
          value: it.value,
          caption: `${n} ${n === 1 ? 'line' : 'lines'}`
        }
      })
    })

    const allocatedCount = computed(() => allocated.value.length)
    const allocatedByWarehouse = computed(() => {
      const amount = new Map()
      for (const r of allocated.value) sumTo(amount, r.WarehouseCode, qty(r))
      return topN(amount, 8, (code) => getWarehouse(code)?.name || code)
    })
    const allocatedWait = computed(() => bandCounts(allocated.value.map((r) => daysSince(r.ProgressAllocatedAt))))

    const askedBySku = computed(() => {
      const map = new Map()
      for (const r of lines.value) sumTo(map, r.SKU, qty(r))
      return map
    })
    const deliveredBySku = computed(() => {
      const map = new Map()
      for (const r of delivered.value) sumTo(map, r.SKU, qty(r))
      return map
    })

    const topSkus = computed(() => topN(askedBySku.value, 8).map((it) => ({
      label: skuLabelText(it.label),
      value: it.value,
      caption: `${deliveredBySku.value.get(it.label) || 0} delivered`
    })))

    const askedVsDelivered = computed(() => {
      const top = topN(askedBySku.value, 6).map((it) => it.label)
      return [
        { name: 'Approved', items: top.map((k) => ({ label: skuLabelText(k), value: askedBySku.value.get(k) || 0 })) },
        { name: 'Delivered', items: top.map((k) => ({ label: skuLabelText(k), value: deliveredBySku.value.get(k) || 0 })) }
      ]
    })

    const controls = []

    return {
      loading,
      lineCount,
      lineMix,
      shortCount,
      shortSkus,
      allocatedCount,
      allocatedByWarehouse,
      allocatedWait,
      topSkus,
      askedVsDelivered,
      controls
    }
  })
}
