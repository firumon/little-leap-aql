import { restockItemRows } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryRows'
import {
  isActiveRow,
  isActive,
  ITEM_DELIVERED,
  orsisForDelivery
} from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

/**
 * OutletDeliveries › Index › LinearProgress — JS modifier (tier CP: resource + page).
 *
 * One bar: how much of what is currently OUT has landed.
 *
 * ── THE DENOMINATOR IS THE COMMITTED OBLIGATION, NOT ALL TIME ──
 * §9.2 forbids an all-time total on an Index, and it also requires a ratio's denominator to
 * cover only records that incurred a real obligation. Both point at the same set here: the
 * lines on manifests that are currently DRAFT or IN_TRANSIT. Those units have left a
 * warehouse and are owed to an outlet — that is the obligation. Completed runs are settled
 * history and would only ever push the bar towards 100% as the sheet ages; cancelled runs
 * never became a delivery commitment at all.
 *
 * So the bar reads "of the work on the road right now, how much is done" — a figure that
 * genuinely moves during a shift, and drops back to nothing when every run closes. That is
 * why the widget correctly disappears on a day with no active runs rather than showing a
 * triumphant empty 100%.
 *
 * `title` is omitted deliberately: a single-ratio bar has exactly one thing to name, and
 * naming it as a section heading AND as the bar's own label reads as two headings for one
 * number (§9.2).
 *
 * `items` is function-valued — a JS modifier resolves once and is cached, so only a closure
 * re-reads the store.
 */
const text = (value) => (value == null ? '' : String(value).trim())

export default function (props, { resourceRecord }) {
  return {
    items: () => {
      const deliveries = resourceRecord?.records?.value || []

      // The line-up of every run currently in play.
      const codes = new Set()
      for (const row of deliveries) {
        if (!isActiveRow(row) || !isActive(row)) continue
        for (const code of orsisForDelivery(row)) codes.add(code)
      }
      if (!codes.size) return []

      // One indexed pass over the item sheet, then O(1) reads — never a lookup per code.
      const progressByCode = new Map()
      for (const row of restockItemRows()) {
        const code = text(row?.Code)
        if (code) progressByCode.set(code, text(row?.Progress))
      }

      let delivered = 0
      for (const code of codes) {
        if (progressByCode.get(code) === ITEM_DELIVERED) delivered++
      }

      return [{
        label: 'Items delivered on active runs',
        value: delivered,
        max: codes.size,
        unit: 'items',
        color: delivered === codes.size ? 'positive' : 'info'
      }]
    }
  }
}
