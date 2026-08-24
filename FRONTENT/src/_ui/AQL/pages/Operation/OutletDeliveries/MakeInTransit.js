/**
 * OutletDeliveries › MakeInTransit contract —
 * `/operation/outlet-deliveries/{code}/_action/make-in-transit`.
 *
 * `make-in-transit` normalizes to `makeintransit`, so this file is `MakeInTransit.js` and
 * every placeholder beneath it resolves under the `MakeInTransit/` page tier (§2.1).
 *
 *   single step   confirmation + optional note   →   [ Cancel ] [ Mark In Transit ]
 *
 * ── WHY A ROUTE FOR A ONE-COLUMN CHANGE ──
 * It could have been a `mutate` action, and deliberately is not. Departing is the point at
 * which a run stops being re-plannable — cancelling is DRAFT-only — so the page states that
 * consequence, with the item count, before the coordinator commits. A confirm dialog reading
 * "Mark in transit?" would hide exactly the fact worth knowing.
 *
 * `DepartConfirm` is the HYDRATION POINT (§5.5): it seeds the comment control field and
 * opens the sheets its context lines are resolved from.
 *
 * `reload: false` — consistent with every other transactional route in the module (§5.5).
 */
export default {
  sections: ['PageHeader'],
  contents: ['DepartConfirm'],

  PropsPageHeader: {
    title: 'Dispatch Delivery',
    reload: false
  }
}
