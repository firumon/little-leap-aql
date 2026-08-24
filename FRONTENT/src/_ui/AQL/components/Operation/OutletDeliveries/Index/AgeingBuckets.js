import { restockItemRows, restockRows } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryRows'
import {
  AGE_BANDS,
  ageBandOf,
  daysSince,
  settledAt
} from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'
import { availableAllocatedItems } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryAllocation'

/**
 * OutletDeliveries › Index › AgeingBuckets — JS modifier (tier CP: resource + page).
 *
 * How long allocated stock has been sitting unloaded. This IS a queue where elapsed time
 * means human friction — units are committed out of a warehouse, in nobody's inventory, and
 * waiting for somebody to plan a van (§9.2's ageing-queue rule). Unlike the returns module,
 * where a wait tracks the billing calendar and nobody can act on it, every day counted here
 * is a day somebody could have loaded a vehicle.
 *
 * ── THE TIMESTAMP ──
 * Measured from `ProgressAllocatedAt` — the moment the line entered THIS queue — not from
 * the restock's creation date, which includes however long approval took and would blame
 * logistics for a delay upstream of them (§9.2's timestamp-precedence rule). Falls back
 * through the domain's `settledAt` chain so a line whose stamp was never written still ages
 * rather than reading as brand new.
 *
 * ── THE BAND TABLE IS IMPORTED, NOT WRITTEN HERE ──
 * `AGE_BANDS` and `ageBandOf` come from the vocabulary file, so this widget's red band and a
 * queue row's red chip are the same threshold by construction (§9.2, §4.5). Two array
 * literals would be a scale that splits the first time either is tuned.
 *
 * ── THE PERMISSION GATE ──
 * "Nine days waiting" is an instruction to whoever can dispatch a van and merely an anxiety
 * to anyone who cannot. Gated on `create` — the permission that lets a user start the run
 * that clears this queue — and the read is taken INSIDE the closure, because a modifier
 * resolves before the auth payload lands and a permission read taken then would latch a
 * false for the page's life (§9.2 rule 5, §3.3).
 *
 * Empty buckets are KEPT and dimmed by the section itself: the bands are a fixed scale and
 * "0 in 7+ days" is the reassuring half of the reading.
 */
const RESOURCE = 'OutletDeliveries'

const text = (value) => (value == null ? '' : String(value).trim())

export default function (props, { resourceRecord, resourceConfig }) {
  return {
    title: 'Allocated Stock Ageing',
    items: () => {
      // Inside the closure — see the note above.
      if (resourceConfig?.allowed?.({ [RESOURCE]: 'create' }) !== true) return []

      const deliveries = resourceRecord?.records?.value || []
      const waiting = availableAllocatedItems(restockItemRows(), deliveries)
      if (!waiting.length) return []

      // Parent restock rows, indexed once, for the age fallback.
      const restockByCode = new Map()
      for (const row of restockRows()) {
        const code = text(row?.Code)
        if (code) restockByCode.set(code, row)
      }

      const counts = new Map(AGE_BANDS.map((band) => [band.label, 0]))
      let counted = 0

      for (const row of waiting) {
        const parent = restockByCode.get(text(row?.OutletRestockCode))
        const stamp = text(row?.ProgressAllocatedAt) || settledAt(parent || {})
        const band = ageBandOf(daysSince(stamp))
        // A row with no readable age is left UNCOUNTED rather than dumped into the freshest
        // or the oldest bucket — that is why `ageBandOf` returns null (§4.5).
        if (!band) continue
        counts.set(band.label, counts.get(band.label) + 1)
        counted++
      }

      if (!counted) return []

      return AGE_BANDS.map((band) => ({
        label: band.label,
        caption: band.caption,
        color: band.color,
        count: counts.get(band.label) || 0
      }))
    }
  }
}
