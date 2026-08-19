import { useOutletIndex } from 'src/_resource/Master/Outlets/composables/useOutletIndex'
import { ACTIVITY_WINDOW_DAYS } from 'src/_resource/Master/Outlets/composables/useOutletActivity'

/**
 * Outlets › ListSwitcher — JS modifier (tier C: RESOURCE-wide).
 *
 * The resource tier, not a page folder, because TWO pages mount this switcher over the same
 * six views: the plain Outlets Index (the directory) and `operation-hub` (the intelligence
 * page). Sharing it by placement is what stops the two from drifting into two different
 * counts for the same pill (§3.1). It resolves on those two pages only — View/Add/Edit never
 * name `ListSwitcher` in their `sections`, so the tier costs them nothing.
 *
 * Six queues, the directory first and the stream queues after it:
 *
 *   1. All Outlets (default)   the whole estate, alphabetically — the reference list
 *   2. No Updates              silent across ALL five streams for longer than the window
 *   3. Recently Restocked      stock went out
 *   4. Recently Consumed       stock was counted and sold
 *   5. Recently Paid           money came back
 *   6. Recently Visited        someone was physically there
 *
 * The four "Recently …" pills and the "No Updates" pill are complements of one another over
 * one window (`ACTIVITY_WINDOW_DAYS`), so the labels state the window rather than leaving the
 * reader to guess what "recently" means.
 *
 * NO PERMISSION GATES on the pills (§9.3). Every view here filters outlets the user is
 * already authorised to read, and none of them starts an action — they are lenses on one
 * master list, not other people's work queues.
 *
 * `items` is a GETTER, not a plain array: a modifier's return is resolved once and cached, so
 * a literal would freeze at whatever the aggregate held on the first tick — usually empty,
 * since sections resolve before the fetch settles.
 *
 * All six carry counts. Unlike a transactional resource's history pills, none of these sets
 * grows without bound — every one of them is a subset of the outlet master list, so the
 * number measures coverage rather than the age of the tenant.
 */
export default function () {
  return {
    items: () => {
      const { views } = useOutletIndex()
      const v = views.value

      const view = (name, label, icon, color) => ({
        name,
        label: `${label} (${(v[name] || []).length})`,
        icon,
        color
      })

      return [
        view('AllOutlets', 'All Outlets', 'storefront', 'primary'),
        view('NoUpdates', `No Updates (${ACTIVITY_WINDOW_DAYS}d+)`, 'running_with_errors', 'negative'),
        view('RecentlyRestocked', 'Restocked', 'inventory_2', 'teal-7'),
        view('RecentlyConsumed', 'Consumed', 'point_of_sale', 'deep-orange'),
        view('RecentlyPaid', 'Paid', 'payments', 'positive'),
        view('RecentlyVisited', 'Visited', 'event_available', 'info')
      ]
    }
  }
}
