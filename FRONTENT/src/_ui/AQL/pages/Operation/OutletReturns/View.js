/**
 * OutletReturns › View — page contract.
 *
 * Stacked sections rather than a page override, so the standard breadcrumb, page transition
 * and `PageAction` resolver are all preserved. `contents` is empty: a generic record grid
 * would restate what these four cards already say in the workflow's own vocabulary, and it
 * would render the two flag columns as the raw `'TRUE'`/`'FALSE'` strings they are stored
 * as (§7.4).
 *
 * ── THE CARD STACK ──
 *   ReturnIdentity     who, what outlet, when, current state
 *   ReturnedItem       what physically came back, and what it is worth
 *   CommercialStatus   track 1 — is the outlet owed a credit, and have they had it
 *   WarehouseStatus    track 2 — did stock leave the shelf, and what became of it
 *   ReturnTimeline     the audit history that actually exists on this sheet
 *
 * The two status cards are the reason this page exists: a return is COMPLETED only when
 * every track it flagged is resolved, so a reader's first question is always "which half is
 * still open?". They sit adjacent and share one component (`TrackStatusCard`) so the two
 * answers are legible side by side rather than in two different card grammars.
 *
 * ── NO ACTION BANNER, AND NO ACCENT CARD ──
 * §7.4 reserves the leading position and the UI's one accent tint for a card that ASKS for
 * an action. The three things a return can need — confirm the warehouse action, mark the
 * credit settled, cancel — are all `AdditionalActions` reached from the FAB cluster, each
 * gated on its own domain predicate (`canConfirmWarehouseAction`, `canMarkInvoiceAdjusted`,
 * `canCancel`). The status cards REPORT which track is open; the FAB is where the reader
 * acts on it. Adding a banner that duplicated the FAB's own visibility rule would be a
 * second copy of the eligibility logic §8.6 forbids re-deriving, so the page stays
 * uniformly neutral.
 *
 * Every card self-guards its own loading and empty state: `sections` render outside
 * `<AqlContentWrapper>`, so none of them inherits its gating (§7.4, §10.4). That is why
 * `useReturnView` exposes `pending` — all five read it.
 *
 * The page keeps its reload control: nothing here is owned by `pageState` (§5.5).
 */
export default {
  sections: [
    'PageHeader',
    'ReturnIdentity',
    'ReturnedItem',
    'CommercialStatus',
    'WarehouseStatus',
    'ReturnTimeline'
  ],
  contents: [],

  PropsPageHeader: {
    title: 'Outlet Return'
  }
}
