import {
  recentPreset,
  pendingPreset,
  inTransitPreset,
  completedPreset,
  cancelledPreset
} from 'src/_ui/AQL/composables/Operation/OutletDeliveries/Index/useDeliveryRowPresets'

/**
 * OutletDeliveries › Index — page contract (tier CP: resource + page specific).
 *
 * The logistics coordinator's and driver's operational dashboard. It answers, in descending
 * order of urgency (§9.1's 4-stage formula):
 *
 *   1. MetricCards     what needs loading, where, and what has landed today
 *   2. LinearProgress  how far today's runs have got
 *   3. AgeingBuckets   how long allocated stock has been waiting — dispatcher-gated
 *   4. FilterInput / ListSwitcher / List — the work itself
 *
 * Every widget hides itself when it has nothing to report, so a tenant with no deliveries
 * sees a bare list rather than a wall of zeroes.
 *
 * ── THE SIX LIST VIEWS ──
 *   Recent     (default)  the last 50 live runs, drafts included. Newest first.
 *   Pending               DRAFT manifests — loaded, not departed. Oldest first.
 *   InTransit             on the road. Oldest first.
 *   Outlets               NOT a manifest list — the unassigned allocation queue. See below.
 *   Completed             settled runs, newest first.
 *   Cancelled             abandoned runs, newest first.
 *
 * Five of the six are plain prop bags and therefore live here as `Props<Identity>` blocks
 * rather than standalone `List<View>.js` files (§5.3). Each is a FUNCTION, so it is
 * evaluated with the live props bag on every read and receives the active view's
 * already-filtered `items` — which is what lets it re-filter and re-sort them. A static
 * object could not see the rows, and a JS modifier (resolved once, then cached) would
 * freeze them at whatever the store held on first render.
 *
 * ── WHY `Outlets` IS A `.vue` AND NOT A PROP BAG ──
 * It renders `OutletRestockItems` lines, not `OutletDeliveries` rows: the backlog waiting
 * for a van. `APP.Resources.ListViews` filters one resource's own rows and cannot express
 * that join, so the pill exists only to select the view and `Index/ListOutlets.vue` renders
 * its own set (§7.1). It carries no `Props` block here because it takes no rows from the
 * resolver.
 *
 * ── NO ROW ACTION CLUSTER ──
 * No view carries a `btn`, so `contents/List.vue`'s default click handler opens the View
 * page and the whole row stays the tap target — the larger target on a phone. Marking items
 * delivered needs the driver to pick WHICH items, which is a page, not a row tap (§7.3
 * rule 4: an action where the user must inspect items first is off the row).
 *
 * The page keeps its reload control: nothing here is owned by `pageState` (§5.5).
 */
export default {
  sections: [
    'PageHeader',
    // Renders NOTHING. It is the only thing on this page that runs in a component setup, so
    // it is the only place the item and restock sheets the widgets below read can be
    // opened — a JS modifier has no lifecycle and can only read the cache. Without it the
    // widgets would show "nothing waiting" on a cold cache, which is the most dangerous
    // thing this Index could say wrongly (§9.2, "empty is not 'not yet loaded'"). See
    // `Index/PreloadRows.vue`.
    'PreloadRows',
    'MetricCards',
    'LinearProgress',
    'AgeingBuckets',
    'FilterInput',
    'ListSwitcher'
  ],
  contents: ['List'],

  PropsPageHeader: {
    title: 'Outlet Deliveries'
  },

  PropsListRecent: (props) => recentPreset(props.items),
  PropsListPending: (props) => pendingPreset(props.items),
  PropsListInTransit: (props) => inTransitPreset(props.items),
  PropsListCompleted: (props) => completedPreset(props.items),
  PropsListCancelled: (props) => cancelledPreset(props.items)
}
