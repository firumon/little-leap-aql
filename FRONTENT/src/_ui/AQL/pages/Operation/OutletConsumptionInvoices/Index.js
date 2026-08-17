/**
 * OutletConsumptionInvoices › Index — page contract (tier CP: resource + page specific).
 *
 * The page answers two questions in descending order of urgency, and the section stack is
 * that order: what is LATE (`MetricCards`), how old the book is (`AgeingBuckets`), then the
 * work itself (`FilterInput`, `ListSwitcher`, `List`). Both widgets hide themselves when
 * they have nothing to say, so a tenant with no invoices sees a bare list rather than a wall
 * of zeroes.
 *
 * ── EVERY LIST VIEW IS A `.vue` OVERRIDE ──
 * There are no `PropsList<View>` blocks here, and that is deliberate. All nine views render
 * from the Layer 2 aggregate (`useInvoiceIndex`) rather than from the resolver's raw records:
 * a raw row carries an outlet CODE and no derived balance, so a list built from it shows
 * `OUT00001` and a figure that disagrees with the same invoice one pill away. Reading the
 * aggregate is what keeps every view stating the same number for the same invoice
 * (CORE_ARCHITECTURE_RULES §6 — Enrich Once, Then Project).
 *
 * Once a view reads the aggregate it needs a template rather than a prop bag, so each is its
 * own file: `Index/List<ViewName>.vue`. The shared row shape they use lives in
 * `Index/useInvoiceRowPresets.js`, so an invoice reads identically whichever pill you
 * arrived through (UI_MODULE_DEVELOPER_GUIDE.md §8.4).
 */
export default {
  sections: [
    'PageHeader',
    'MetricCards',
    // The day's work, directly under the standing position it is measured against. Hides
    // itself when there was nothing overdue to collect this morning.
    'LinearProgress',
    'AgeingBuckets',
    'FilterInput',
    'ListSwitcher'
  ],
  contents: ['List'],

  PropsPageHeader: {
    title: 'Consumption Invoices',
    subtitle: 'Generate and manage consumption invoices',
    reload: true
  }
}
