/**
 * OutletConsumptions › View — page contract (tier CP: resource + page specific).
 *
 * Stacked sections rather than a page override, so the standard breadcrumb, page
 * transition and `PageAction` resolver are all preserved. `contents` is empty: the generic
 * record grid would only restate what `ConsumptionHeader` already says in the workflow's
 * own vocabulary, and would surface every raw stamp column alongside it (§7.4).
 *
 * The stack is ordered by what the reader came to learn, narrowing outward from the record
 * to its context:
 *
 *   1. ConsumptionHeader     what this audit is and where it stands
 *   2. ConsumedItems         what it found had sold
 *   3. RestockDetails        what is being sent back, and how far along that is
 *   4. InvoiceDetails        what it was billed as
 *   5. Returns               what came off the shelf
 *   6. RecentConsumptions    how it compares to the last few visits here
 *
 * Cards 3 and 4 hide themselves entirely when there is no restock or no invoice, which is
 * the normal state immediately after an audit. Card 5 is ALWAYS present, including its
 * empty state: this is the page a dispute over a return gets settled on, and "no returns
 * were recorded" is part of the answer rather than an absence of one.
 *
 * NO ACCENT CARD. At most one card per page may break the neutral shell, and only one that
 * ASKS for an action rather than reporting one (§7.4) — every card here reports. The one
 * action this page offers, cancellation, is a `CancelConsumption` FAB gated by
 * `AdditionalActions`, and it opens its own route rather than a dialog on this page,
 * because the cascade it performs needs a mandatory reason and a confirmation of what else
 * it will reject.
 *
 * `reload: false` is NOT set here — unlike Add, this page's data is owned by the record
 * store rather than by `pageState`, so refreshing it discards nothing (§5.5).
 */
export default {
  sections: [
    'PageHeader',
    'ConsumptionHeader',
    'ConsumedItems',
    'RestockDetails',
    'InvoiceDetails',
    'Returns',
    'RecentConsumptions'
  ],
  contents: [],

  // Declarative gating (useSectionResolver). A section that renders ANOTHER resource's
  // rows is hidden from a role that cannot read that resource; the rest render as before.
  permissions: {
    RestockDetails: ['OutletRestocks:read'],
    InvoiceDetails: ['OutletConsumptionInvoices:read'],
    Returns: ['OutletReturns:read']
  },

  PropsPageHeader: { title: 'Outlet Consumption' },
  PropsConsumptionHeader: { title: 'Consumption Details' },
  PropsConsumedItems: { title: 'Consumed Items' },
  PropsRestockDetails: { title: 'Restock' },
  PropsInvoiceDetails: { title: 'Invoice' },
  PropsReturns: { title: 'Returns' },
  PropsRecentConsumptions: { title: 'Recent Consumptions Here' }
}
