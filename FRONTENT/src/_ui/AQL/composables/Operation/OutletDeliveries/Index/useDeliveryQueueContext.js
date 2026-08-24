import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { availableAllocatedItems } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryAllocation'
import {
  daysSince,
  ageColor,
  settledAt
} from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

/**
 * OutletDeliveries › Index › the unassigned queue — the Core-composable relay for the
 * `Outlets` list view (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `Index/`, the page tier (§6.2). Its only consumer is `Index/ListOutlets.vue`,
 * which no other page resolves.
 *
 * It calls no `inject()`. It exists because §6 admits no exception for "generic reads that
 * carry no resource content": `useRecord` and `useResourceNav` are Core Composables and a
 * `.vue` file may not import one directly. This relay is where those imports legally live.
 *
 * ── WHAT THIS VIEW ACTUALLY SHOWS ──
 * Not `OutletDeliveries` rows at all: the lines that are ALLOCATED and not yet on any live
 * run — the backlog a coordinator plans the next van from. `APP.Resources.ListViews` filters
 * one resource's own rows and cannot express a join, which is why the pill's sheet filter is
 * irrelevant here and the override renders its own set (§7.1).
 *
 * WHICH lines qualify is Layer 2's answer (`availableAllocatedItems`), never re-derived
 * here. This file only groups and labels them.
 */
export function useDeliveryQueueContext () {
  const nav = useResourceNav()
  const ui = useAQLConfig()

  const restockItems = useRecord('OutletRestockItems')
  const restocks = useRecord('OutletRestocks')
  const deliveries = useRecord('OutletDeliveries')
  const outlets = useRecord('Outlets')
  const skus = useRecord('SKUs')
  const products = useRecord('Products')

  const { getOutlet } = useOutletResource()
  const { skuLabelText } = useSkuResource()

  const text = (value) => (value == null ? '' : String(value).trim())
  const asRow = (value) => (value && typeof value === 'object' ? value : {})
  const ageRank = (group) => (Number.isFinite(group.oldestDays) ? group.oldestDays : -1)

  /** Parent restock → the row itself, in one pass. A line's route to an outlet and a date. */
  const restockByCode = computed(() => {
    const map = new Map()
    for (const raw of restocks.items.value) {
      const row = asRow(raw)
      const code = text(row.Code)
      if (code) map.set(code, row)
    }
    return map
  })

  /**
   * The free lines, grouped by outlet and aged.
   *
   * Age is measured from `ProgressAllocatedAt` — the moment stock was committed and started
   * waiting for a van — falling back through the domain's own `settledAt` chain so a line
   * whose stamp was never written still ages rather than reading as brand new (§7.2).
   */
  const outletGroups = computed(() => {
    const available = availableAllocatedItems(restockItems.items.value, deliveries.items.value)
    const byRestock = restockByCode.value
    const groups = new Map()

    for (const raw of available) {
      const row = asRow(raw)
      const parent = byRestock.get(text(row.OutletRestockCode))
      const outletCode = text(parent?.OutletCode)
      const key = outletCode || '__unresolved'

      if (!groups.has(key)) {
        groups.set(key, {
          outletCode,
          outletName: text(getOutlet(outletCode)?.Name) || outletCode || 'Unresolved outlet',
          city: text(getOutlet(outletCode)?.City),
          items: []
        })
      }

      const days = daysSince(text(row.ProgressAllocatedAt) || settledAt(parent || {}))
      groups.get(key).items.push({
        ...row,
        skuLabel: text(skuLabelText(text(row.SKU))) || text(row.SKU),
        quantity: Math.abs(Number(row.Quantity) || 0),
        restockCode: text(row.OutletRestockCode),
        days,
        ageColor: ageColor(days)
      })
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        itemCount: group.items.length,
        unitCount: group.items.reduce((sum, row) => sum + row.quantity, 0),
        // The group takes its worst line's age: an outlet with one week-old line is a
        // week-old problem, whatever else was allocated this morning. Stays NaN when no
        // line has a readable stamp, so an unknown age never renders as "today".
        oldestDays: group.items.reduce(
          (max, row) => (!Number.isFinite(row.days) ? max : Math.max(Number.isFinite(max) ? max : 0, row.days)), NaN)
      }))
      // Oldest backlog first — the same work order the manifest lists use. An unknown age
      // sorts last rather than poisoning the comparison with NaN.
      .sort((a, b) => ageRank(b) - ageRank(a) || a.outletName.localeCompare(b.outletName))
  })

  const totals = computed(() => ({
    outlets: outletGroups.value.length,
    items: outletGroups.value.reduce((sum, group) => sum + group.itemCount, 0),
    units: outletGroups.value.reduce((sum, group) => sum + group.unitCount, 0)
  }))

  async function preload () {
    await Promise.all(
      [restockItems, restocks, deliveries, outlets, skus, products].map((res) => res.reload()))
  }

  return { nav, ui, outletGroups, totals, preload, ageColor }
}
