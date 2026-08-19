/**
 * Outlets › Operation Hub — page contract for the `operation-hub` sub-route
 * (tier CP: resource + page specific).
 *
 * Route: `/master/outlets/operation-hub` — a `resource` sub-route, so `usePageResolver`
 * folds its `:pageSlug` through `toPascalCase().toLowerCase()` into the page key
 * `operationhub`, exactly as it folds an action slug. That single key is what files this
 * contract here and every widget below it under `components/Master/Outlets/OperationHub/`.
 * The hyphen is why the fold exists: a raw `operation-hub` key could never match a
 * PascalCase folder in the lowercased Vite glob registry.
 *
 * This is the outlet intelligence centre, and the replacement for the dead
 * `pages/Master/Outlets/OperationHubPage.vue` the menu entry used to be aimed at. That page
 * asked the user to pick one outlet before it could say anything at all; this one answers the
 * estate-wide questions first and lets the reader drill into a single outlet from a row.
 *
 * The section stack is descending operational urgency (UI_MODULE_DEVELOPER_GUIDE.md §9.1):
 *
 *   1. `MetricCards`        how many outlets are on the books, and how many are live
 *   2. `DistributionBars`   where they are — province / city / area, reader's choice
 *   3. `PendingMetrics`     PENDINGS — the three queues someone has to clear today
 *   4. `VisitMetrics`       VISITS   — the week just gone and the week ahead
 *   5. `RecentUpdates`      how much of the estate is actually transacting
 *   6. `FilterInput` + `ListSwitcher` + `List`   the work itself
 *
 * Every widget returns `[]` when it has nothing to report, so a fresh tenant sees a clean
 * outlet list rather than a wall of zeroes (§9.2 rule 2).
 *
 * ── THIS CONTRACT DECLARES EVERYTHING, INCLUDING THE LIST ──
 * `sections`/`contents` REPLACE the base contract's arrays rather than extending them, and a
 * sub-route's Stage-A base is `pages/Master/resource.js` — so `contents: ['List']` is
 * restated here deliberately. Dropping it would leave the hub with widgets and no work queue.
 *
 * ── WHAT LIVES HERE, AND WHAT LIVES A TIER UP ──
 * Only the five widgets are page-scoped. The switcher and its six `List<View>.vue` views sit
 * at the RESOURCE tier (`components/Master/Outlets/`) because the plain Outlets Index resolves
 * the same six views from the same Layer 2 aggregate — sharing them by placement is what stops
 * the two pages from drifting into two different answers for "when was this outlet last paid"
 * (§3.1). The relay composable follows them up the ladder for the same reason (§6.2).
 *
 * ── EVERY LIST VIEW IS A `.vue` OVERRIDE ──
 * There are no `PropsList<View>` blocks here, deliberately. All six views render from the
 * Layer 2 aggregate (`useOutletIndex`) rather than from the resolver's raw records, because
 * five of the six are defined by events in OTHER resources — an outlet row cannot state when
 * it was last paid, and a filter over the Outlets sheet cannot find out. Reading one
 * aggregate is what keeps every pill stating the same age for the same outlet
 * (CORE_ARCHITECTURE_RULES §6 — Enrich Once, Then Project).
 *
 * The three widget sections in the middle are thin `.vue` shells over the framework
 * `MetricCards` / `LinearProgress` bases — the page needs three separately-titled metric
 * rows, and a placeholder identity resolves exactly once per page, so each row needs its own
 * name. Nothing about the widgets themselves is reinvented (§9.2).
 */
export default {
  sections: [
    'PageHeader',
    'MetricCards',
    'DistributionBars',
    'PendingMetrics',
    'VisitMetrics',
    'RecentUpdates',
    'FilterInput',
    'ListSwitcher'
  ],
  contents: ['List'],

  PropsPageHeader: {
    title: 'Outlet Hub',
    subtitle: 'Coverage, pending work, and account activity across every outlet',
    reload: true
  }
}
