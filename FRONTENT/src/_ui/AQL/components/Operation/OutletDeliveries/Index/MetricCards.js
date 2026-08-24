import { restockItemRows, restockRows } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryRows'
import {
  isActiveRow,
  isActive,
  ITEM_DELIVERED
} from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'
import { availableAllocatedItems } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryAllocation'

/**
 * OutletDeliveries › Index › MetricCards — JS modifier (tier CP: resource + page).
 *
 * Four counts, each an OPEN QUEUE SOMEONE OWNS, so every card answers "is there work for me
 * right now?" (§9.2's actionable-queue constraint). Completed and cancelled run totals are
 * history and belong to the list pills, not here.
 *
 * The four deliberately measure different THINGS rather than slicing one number:
 *
 *   Waiting to Load    lines allocated and not on any live run — the raw backlog
 *   Outlets Waiting    how many stops that backlog spans — a hundred lines across two
 *                      outlets is a different day's work from a hundred across forty
 *   Delivered Today    what has actually landed today — the only same-day reading here
 *   Active Runs        manifests in play (DRAFT + IN_TRANSIT)
 *
 * ── WHY THIS MODIFIER READS OTHER RESOURCES ──
 * Two of the four are about `OutletRestockItems`, not about this resource's own rows, and
 * `resourceRecord` only carries `OutletDeliveries`. The rows come from the Layer 2 accessor
 * (`useDeliveryRows`), NOT from `useRecord` — a modifier runs outside any component setup,
 * and `useRecord` calls `useQuasar()`, which needs one. That distinction is the whole reason
 * the accessor exists; see its docblock. The rows are read here and handed straight to
 * Layer 2's predicate, so no eligibility is decided locally.
 *
 * `items` is FUNCTION-VALUED because a JS modifier is invoked ONCE, at resolve time, and its
 * return is cached. A plain array would freeze at whatever the store held on that first tick
 * — usually empty, since the page resolves its sections before the fetch settles.
 *
 * Counted from the store's full row sets, never from `filteredRecords`: these cards are the
 * reason to switch views, so they must not change when a view is switched (§9.2 rule 4).
 */
const text = (value) => (value == null ? '' : String(value).trim())

export default function (props, { resourceRecord }) {
  const todayISO = () => new Date().toISOString().slice(0, 10)

  return {
    items: () => {
      const deliveries = resourceRecord?.records?.value || []
      const itemRows = restockItemRows()
      const parentRows = restockRows()

      // WHICH lines are unassigned is Layer 2's answer, not this widget's.
      const waiting = availableAllocatedItems(itemRows, deliveries)

      // Line → outlet, through its parent restock. One indexed pass, because a `.find()`
      // per line would be O(n×m) over the two largest sheets (ARCHITECTURE RULES §6).
      const outletByRestock = new Map()
      for (const row of parentRows) {
        const code = text(row?.Code)
        if (code) outletByRestock.set(code, text(row?.OutletCode))
      }

      const outlets = new Set()
      for (const row of waiting) {
        const outletCode = outletByRestock.get(text(row?.OutletRestockCode))
        if (outletCode) outlets.add(outletCode)
      }

      const today = todayISO()
      let deliveredToday = 0
      for (const row of itemRows) {
        if (!row || text(row.Progress) !== ITEM_DELIVERED) continue
        // The stamp is a datetime; the day is its leading 10 characters.
        if (text(row.ProgressDeliveredAt).slice(0, 10) === today) deliveredToday++
      }

      let activeRuns = 0
      for (const row of deliveries) {
        if (isActiveRow(row) && isActive(row)) activeRuns++
      }

      // All-or-nothing guard, the widget's last statement before the return (§9.2 rule 2).
      // One live figure keeps the whole set on screen; the zeroes beside it are then real
      // context rather than noise.
      if (!waiting.length && !outlets.size && !deliveredToday && !activeRuns) return []

      return [
        { label: 'Waiting to Load', number: waiting.length, color: 'warning' },
        { label: 'Outlets Waiting', number: outlets.size, color: 'primary' },
        { label: 'Delivered Today', number: deliveredToday, color: 'positive' },
        { label: 'Active Runs', number: activeRuns, color: 'info' }
      ]
    }
  }
}
