/**
 * Top selling products across non-cancelled consumption invoice items.
 * Ranks SKUs by line value (Total) with billed quantity in the caption.
 *
 * Reads:
 *   OutletConsumptionInvoiceItems: OutletConsumptionInvoiceCode, SKU, Qty, Total, Status
 *   OutletConsumptionInvoices: Code, Date, Progress, Status
 *   SKUs + Products (through useSkuResource): product name and variants per SKU
 *
 * Exposes:
 *   loading            - true while InvoiceItems or Invoices is loading and has no rows
 *   liveLineCount      - total count of live lines belonging to non-cancelled invoices
 *   topSellingProducts - top 8 SKUs by line Total inside chosen range, with skuLabelText names and qty caption
 *   range              - ref holding chosen range word
 *   controls           - array containing range control
 *
 * Controls:
 *   range: menu picker, $last7Days / $last30Days / $last90Days / $thisMonth / $lastMonth,
 *          changes the window topSellingProducts counts in
 */

import { ref, computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import { dataControl } from 'src/composables/data/useDataControls'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { isActiveRow } from './_shared'

const RANGES = ['$last7Days', '$last30Days', '$last90Days', '$thisMonth', '$lastMonth']

export default function useInvoiceLineData () {
  const { rows, indexOf, isLoading, remember } = useRecord()
  const { inRange, rangeLabel, topN } = useDataContext()
  const { skuLabelText } = useSkuResource()

  const sumTo = (map, key, n) => map.set(key, (map.get(key) || 0) + n)

  return remember('useInvoiceLineData', () => {
    const loading = computed(() =>
      (isLoading('OutletConsumptionInvoiceItems') && rows('OutletConsumptionInvoiceItems').length === 0) ||
      (isLoading('OutletConsumptionInvoices') && rows('OutletConsumptionInvoices').length === 0)
    )

    // Index parent invoices by Code to check status and date in O(1)
    const parentInvoiceMap = computed(() => {
      const map = new Map()
      for (const [code, bucket] of indexOf('OutletConsumptionInvoices', 'Code')) {
        const inv = bucket[0]
        if (!inv) continue
        const status = String(inv.Status || 'Active').trim().toUpperCase()
        const progress = String(inv.Progress || '').trim().toUpperCase()
        if (status === 'ACTIVE' && progress !== 'CANCELLED') {
          map.set(code, inv)
        }
      }
      return map
    })

    const liveLines = computed(() => {
      const parents = parentInvoiceMap.value
      return rows('OutletConsumptionInvoiceItems').filter((r) =>
        isActiveRow(r) && parents.has(String(r.OutletConsumptionInvoiceCode || '').trim())
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

    const topSellingProducts = computed(() => {
      const totals = new Map()
      const quantities = new Map()
      const parents = parentInvoiceMap.value

      for (const line of liveLines.value) {
        const invCode = String(line.OutletConsumptionInvoiceCode || '').trim()
        const parent = parents.get(invCode)
        if (!parent || !inRange(parent.Date, range.value)) continue

        const sku = String(line.SKU || '').trim()
        if (!sku) continue

        const lineTotal = Number(line.Total) || 0
        const lineQty = Number(line.Qty) || 0

        sumTo(totals, sku, lineTotal)
        sumTo(quantities, sku, lineQty)
      }

      return topN(totals, 8).map((it) => {
        const totalQty = quantities.get(it.label) || 0
        return {
          label: skuLabelText(it.label),
          value: Number(it.value.toFixed(2)),
          caption: `${totalQty} ${totalQty === 1 ? 'unit' : 'units'}`
        }
      })
    })

    return {
      loading,
      liveLineCount,
      topSellingProducts,
      range,
      controls
    }
  })
}
