/**
 * OutletDeliveries › View — page contract.
 *
 * Stacked sections rather than a page override, so the standard breadcrumb, page transition
 * and `PageAction` resolver are all preserved. `contents` is empty: a generic record grid
 * would render `OutletRestockItemCodes` as the raw CSV it is stored as, which is the one
 * column a reader most needs resolved (§7.4).
 *
 * ── THE CARD STACK ──
 *   ManifestSummary    who is driving, to how many stops, how far along — and the ratio
 *   DeliveryTimeline   draft → in transit → completed / cancelled, as it actually happened
 *   OutletItems        the load, grouped by stop, with each line's own state
 *
 * `ManifestSummary` is also the HYDRATION POINT (§5.5, §13.5). A manifest's lines are NOT
 * its schema children — `OutletRestockItems` rows point at their parent restock, and the
 * delivery names them in a CSV — so the record loader brings none of them. The first card
 * opens the item and restock sheets once and every card below reads the same rows.
 *
 * ── NO ACTION BANNER, AND NO ACCENT CARD ──
 * §7.4 reserves the leading position and the UI's one accent tint for a card that ASKS for
 * an action. The four things a run can need — depart, deliver items, close, cancel — are all
 * `AdditionalActions` reached from the FAB cluster, each gated on its own domain predicate
 * (`canMakeInTransit`, `canDeliver`, `canComplete`, `canCancel`). The cards here REPORT; the
 * FAB is where the reader acts. A banner duplicating the FAB's visibility rule would be a
 * second copy of the eligibility logic §8.6 forbids re-deriving, so the page stays uniformly
 * neutral. (The Index's `Outlets` view spends the accent instead, on the one card in this
 * module that genuinely asks for something.)
 *
 * Every card self-guards its own loading and empty state: `sections` render outside
 * `<AqlContentWrapper>`, so none inherits its gating (§7.4, §10.4). That is why
 * `useDeliveryView` exposes `pending` — all three read it.
 *
 * The page keeps its reload control: nothing here is owned by `pageState` (§5.5).
 */
export default {
  sections: [
    'PageHeader',
    'ManifestSummary',
    'DeliveryTimeline',
    'OutletItems'
  ],
  contents: [],

  PropsPageHeader: {
    title: 'Delivery Run'
  }
}
