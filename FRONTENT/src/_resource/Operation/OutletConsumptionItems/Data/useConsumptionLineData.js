/**
 * Consumed products across active and non-cancelled outlet consumptions.
 * Ranks SKUs by consumed quantity inside the chosen range.
 *
 * Reads:
 *   OutletConsumptionItems: OutletConsumptionCode, SKU, Qty, Status
 *   OutletConsumptions: Code, Date, Progress, Status
 *   SKUs + Products (through useSkuResource): product name and variants per SKU
 *
 * Exposes:
 *   loading             - true while ConsumptionItems or Consumptions is loading and has no rows
 *   liveLineCount       - total count of live lines belonging to active, non-cancelled consumptions
 *   topConsumedProducts - top 8 SKUs by consumed Qty inside chosen range, with skuLabelText names
 *   range               - ref holding chosen range word
 *   controls            - array containing range control
 *
 * Controls:
 *   range: menu picker, $last7Days / $last30Days / $last90Days / $thisMonth / $lastMonth,
 *          changes the window topConsumedProducts counts in
 */

import { ref, computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import { dataControl } from 'src/composables/data/useDataControls'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { isActiveRow } from './_shared'

const RANGES = ['$last7Days', '$last30Days', '$last90Days', '$thisMonth', '$lastMonth']

export default function useConsumptionLineData () {
  const { rows, indexOf, isLoading, remember } = useRecord()
  const { inRange, rangeLabel, topN } = useDataContext()
  const { skuLabelText } = useSkuResource()

  const sumTo = (map, key, n) => map.set(key, (map.get(key) || 0) + n)

  return remember('useConsumptionLineData', () => {
    const loading = computed(() =>
      (isLoading('OutletConsumptionItems') && rows('OutletConsumptionItems').length === 0) ||
      (isLoading('OutletConsumptions') && rows('OutletConsumptions').length === 0)
    )

    // Index parent consumptions by Code to check status and date in O(1)
    const parentConsumptionMap = computed(() => {
      const map = new Map()
      for (const [code, bucket] of indexOf('OutletConsumptions', 'Code')) {
        const c = bucket[0]
        if (!c) continue
        const status = String(c.Status || 'Active').trim().toUpperCase()
        const progress = String(c.Progress || '').trim().toUpperCase()
        if (status === 'ACTIVE' && progress !== 'CANCELLED') {
          map.set(code, c)
        }
      }
      return map
    })

    const liveLines = computed(() => {
      const parents = parentConsumptionMap.value
      return rows('OutletConsumptionItems').filter((r) =>
        isActiveRow(r) && parents.has(String(r.OutletConsumptionCode || '').trim())
      )
    })

    const liveLineCount = computed(() => liveLines.value.length)

    const range = ref('$last30Days')
    const controls = [
      dataControl('range', {
        type: 'menu',
        options: RANGES.map((value) => ({ label: rangeLabel(value), value })),
        value: range
      })
    ]

    const topConsumedProducts = computed(() => {
      const quantities = new Map()
      const parents = parentConsumptionMap.value

      for (const line of liveLines.value) {
        const parentCode = String(line.OutletConsumptionCode || '').trim()
        const parent = parents.get(parentCode)
        if (!parent || !inRange(parent.Date, range.value)) continue

        const sku = String(line.SKU || '').trim()
        if (!sku) continue

        const lineQty = Number(line.Qty) || 0
        sumTo(quantities, sku, lineQty)
      }

      return topN(quantities, 8).map((it) => ({
        label: skuLabelText(it.label),
        value: it.value
      }))
    })

    return {
      loading,
      liveLineCount,
      topConsumedProducts,
      range,
      controls
    }
  })
}
