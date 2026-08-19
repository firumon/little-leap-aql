/**
 * Outlets › View — page contract (tier CP: resource + page specific).
 *
 * One outlet, and everything that has happened at it. This is the page the now-deleted
 * legacy outlet hub was trying to be, minus the outlet picker — the reader arrives here from
 * a row on the Operation Hub, so the outlet is already chosen and the whole page is about it.
 *
 * The stack is ordered by what a reader needs first: who this outlet is, the terms it trades
 * on, what is outstanding, then the five streams in the order an outlet's life runs through
 * them, and finally what is physically on its shelves.
 *
 *   1. OutletDetails    identity — who, where, how to reach them, how long since anything moved
 *   2. OperatingRules   the commercial terms every downstream calculation uses
 *   3. SummaryStats     the four open positions, so the reader need not count rows below
 *   4. Visits           ── the five operational streams, newest first ──
 *   5. Restocks
 *   6. Returns
 *   7. Invoices
 *   8. Payments
 *   9. CurrentStock     the derived shelf balance
 *
 * ── STRICT VIEW CONTRACT ──
 * Every card RENDERS INFORMATION ONLY. Not one carries a "Plan Visit" or "New Restock"
 * button, deliberately: the four operational entry points are `AdditionalActions` FAB items,
 * where the Action subsystem owns their permission gating and `visibleWhen` rules. A button
 * inside a card would re-derive that eligibility and drift from the config contract (§8.6).
 * This is the sharpest departure from the legacy Hub, which put an action button in the empty
 * state of nearly every list.
 *
 * ── `contents: []` ──
 * The generic record grid would restate, column by column, what `OutletDetails` and
 * `OperatingRules` already say in the outlet's own vocabulary, and would surface the three
 * picture columns and the licence upload as raw rows in the middle of an operational summary.
 *
 * The trade `sections` makes is explicit (§7.4): they render outside `AqlContentWrapper`, so
 * EVERY card self-guards its own loading, empty and missing-record states. That is why the
 * page's one composable exposes `pending` and every card reads it.
 */
export default {
  sections: [
    'PageHeader',
    'OutletDetails',
    'OperatingRules',
    'SummaryStats',
    'Visits',
    'Restocks',
    'Returns',
    'Invoices',
    'Payments',
    'CurrentStock'
  ],
  contents: [],

  PropsPageHeader: {
    title: (record) => (record?.Name || record?.name || 'Outlet'),
    subtitle: 'Visits, restocks, returns, invoices, payments and stock in one place',
    reload: true
  }
}
