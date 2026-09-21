/**
 * Volume and trend metrics for outlet returns: returned monetary value, reasons breakdown,
 * most returned products, busiest returning outlets, warehouse outcome split, and daily trends.
 * Cancelled returns are excluded throughout.
 *
 * Reads:
 *   OutletReturns: Date, SKU, Qty, Price, Reason, OutletCode, WarehouseAction,
 *                  WarehouseActionCompleted, Status, Progress
 *   SKUs + Products (through useSkuResource): product name and variants per SKU
 *   Outlets (through useOutletResource): Code, Name
 *
 * Exposes:
 *   loading               - true while OutletReturns is loading and has no rows
 *   nonCancelledCount     - total active non-cancelled returns (base count for dashboard items)
 *   thisMonthValue        - return money value for returns dated this month
 *   lastMonthValue        - return money value for returns dated last month
 *   returnsByReason       - returned quantity split by reason label
 *   topReturnedProducts   - top 8 SKUs by returned quantity, with formatted money caption
 *   topOutlets            - top 8 outlets by returns in chosen range, with outlet names
 *   range                 - ref holding chosen range word
 *   controls              - array containing range control
 *   warehouseOutcome      - returned units completed by warehouse, split into Stocked and Disposed
 *   warehouseOutcomeUnits - total units completed with a warehouse action
 *   returnsPerDay         - 30 daily points of return counts over the last 30 days
 *
 * Controls:
 *   range: menu picker, $last7Days / $last30Days / $last90Days / $thisMonth / $lastMonth,
 *          changes the window topOutlets counts in
 */

import { ref, computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import { dataControl } from 'src/composables/data/useDataControls'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useCurrency } from 'src/composables/useCurrency'
import {
  isActiveRow,
  isCancelled,
  warehouseActionCompleted,
  reasonLabel,
  returnValueOf,
  STOCKED,
  DISPOSED
} from './_shared'

const DAY = 24 * 60 * 60 * 1000
const dayKey = (t) => new Date(t).toISOString().slice(0, 10)
const RANGES = ['$last7Days', '$last30Days', '$last90Days', '$thisMonth', '$lastMonth']

export default function useReturnVolumeData () {
  const { rows, isLoading, remember } = useRecord()
  const { daysSince, inRange, rangeLabel, topN } = useDataContext()
  const { skuLabelText } = useSkuResource()
  const { getOutlet } = useOutletResource()
  const { _C } = useCurrency()

  const sumTo = (map, key, n) => map.set(key, (map.get(key) || 0) + n)

  return remember('useReturnVolumeData', () => {
    const loading = computed(() => isLoading('OutletReturns') && rows('OutletReturns').length === 0)

    const active = computed(() => rows('OutletReturns').filter(isActiveRow))
    const nonCancelled = computed(() => active.value.filter((r) => !isCancelled(r)))
    const nonCancelledCount = computed(() => nonCancelled.value.length)

    const thisMonthValue = computed(() => {
      let sum = 0
      for (const r of nonCancelled.value) {
        if (inRange(r.Date, '$thisMonth')) sum += returnValueOf(r)
      }
      return Math.round(sum * 100) / 100
    })

    const lastMonthValue = computed(() => {
      let sum = 0
      for (const r of nonCancelled.value) {
        if (inRange(r.Date, '$lastMonth')) sum += returnValueOf(r)
      }
      return Math.round(sum * 100) / 100
    })

    const returnsByReason = computed(() => {
      const map = new Map()
      for (const r of nonCancelled.value) {
        const reason = r.Reason || 'OTHER'
        sumTo(map, reason, Number(r.Qty) || 0)
      }
      return [...map.entries()]
        .filter(([, q]) => q > 0)
        .map(([reason, q]) => ({ label: reasonLabel(reason), value: q }))
        .sort((a, b) => b.value - a.value)
    })

    const topReturnedProducts = computed(() => {
      const amounts = new Map()
      const moneys = new Map()
      for (const r of nonCancelled.value) {
        const sku = r.SKU
        sumTo(amounts, sku, Number(r.Qty) || 0)
        sumTo(moneys, sku, returnValueOf(r))
      }
      return topN(amounts, 8).map((it) => ({
        label: skuLabelText(it.label),
        value: it.value,
        caption: _C(moneys.get(it.label) || 0, true)
      }))
    })

    const range = ref('$last30Days')

    const topOutlets = computed(() => {
      const counts = new Map()
      for (const r of nonCancelled.value) {
        if (!inRange(r.Date, range.value)) continue
        sumTo(counts, r.OutletCode, 1)
      }
      return topN(counts, 8, (code) => getOutlet(code)?.name || code)
    })

    const controls = [
      dataControl('range', {
        type: 'menu',
        options: RANGES.map((value) => ({ label: rangeLabel(value), value })),
        value: range
      })
    ]

    const warehouseOutcome = computed(() => {
      let stocked = 0
      let disposed = 0
      for (const r of nonCancelled.value) {
        if (!warehouseActionCompleted(r)) continue
        const action = String(r.WarehouseAction || '').trim()
        const q = Number(r.Qty) || 0
        if (action === STOCKED) stocked += q
        else if (action === DISPOSED) disposed += q
      }
      return [
        { label: 'Stocked', value: stocked },
        { label: 'Disposed', value: disposed }
      ]
    })

    const warehouseOutcomeUnits = computed(() =>
      warehouseOutcome.value.reduce((sum, item) => sum + item.value, 0))

    const returnsPerDay = computed(() => {
      const now = Date.now()
      const days = new Map()
      for (let d = 29; d >= 0; d--) days.set(dayKey(now - d * DAY), 0)
      for (const r of nonCancelled.value) {
        const age = daysSince(r.Date)
        if (age === null || age < 0) continue
        const key = dayKey(now - age * DAY)
        if (days.has(key)) days.set(key, days.get(key) + 1)
      }
      return [...days.entries()].map(([x, y]) => ({ x, y }))
    })

    return {
      loading,
      nonCancelledCount,
      thisMonthValue,
      lastMonthValue,
      returnsByReason,
      topReturnedProducts,
      topOutlets,
      range,
      controls,
      warehouseOutcome,
      warehouseOutcomeUnits,
      returnsPerDay
    }
  })
}
