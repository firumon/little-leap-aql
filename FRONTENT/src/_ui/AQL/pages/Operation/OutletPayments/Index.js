/**
 * OutletPayments › Index — page contract (tier CP: resource + page specific).
 *
 * The page answers collection questions in descending order of urgency, and the section stack
 * is that order: what is LATE and what came in today (`MetricCards`), how much of today's
 * overdue obligation has been recovered (`LinearProgress`), then the work itself
 * (`FilterInput`, `ListSwitcher`, `List`). Both widgets hide themselves when they have nothing
 * to say, so a tenant with a clear book sees a bare list rather than a wall of zeroes.
 *
 * ── EVERY LIST VIEW IS A `.vue` OVERRIDE ──
 * There are no `PropsList<View>` blocks here, and that is deliberate. All six views render
 * from the Layer 2 aggregate (`useOutletPaymentIndex`) rather than from the resolver's raw
 * records — and four of them render INVOICES, which are not this resource's rows at all. A
 * list built from the raw payment records could not show an open invoice, and one built from
 * raw invoice rows would show `OUT00001` and a balance that ignores every payment against it.
 * Reading the aggregate is what keeps every view stating the same number for the same document
 * (CORE_ARCHITECTURE_RULES §6 — Enrich Once, Then Project).
 *
 * Once a view reads the aggregate it needs a template rather than a prop bag, so each is its
 * own file: `Index/List<ViewName>.vue`. The two shared row shapes they use live in
 * `Index/usePaymentRowPresets.js`, so a document reads identically whichever pill you arrived
 * through (UI_MODULE_DEVELOPER_GUIDE.md §8.4).
 */
export default {
  sections: [
    'PageHeader',
    'MetricCards',
    // The day's collections, directly under the standing position they are measured against.
    // Hides itself when there was nothing overdue to collect this morning.
    'LinearProgress',
    'FilterInput',
    'ListSwitcher'
  ],
  contents: ['List'],

  PropsPageHeader: {
    title: 'Outlet Payments',
    subtitle: 'Track collections and settle consumption invoices',
    reload: true
  }
}
