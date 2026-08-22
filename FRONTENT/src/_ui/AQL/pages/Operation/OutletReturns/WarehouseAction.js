/**
 * OutletReturns › WarehouseAction contract —
 * `/operation/outlet-returns/{code}/_action/warehouse-action`.
 *
 * An `_action/:action` route resolves its canonical page key to the ACTION slug, normalized
 * through `toPascalCase(actionParam).toLowerCase()` — so `warehouse-action` resolves to
 * `warehouseaction`, this file is `WarehouseAction.js` (never `warehouse-action.js`), and
 * every placeholder beneath it resolves under the `WarehouseAction/` page tier
 * (UI_MODULE_DEVELOPER_GUIDE.md §2.1).
 *
 *   single step   disposition + its detail   →   [ Cancel ] [ Confirm Action ]
 *
 * ── WHY A ROUTE AND NOT THE TWO `mutate` ACTIONS IT REPLACES ──
 * `GAS/syncAppResources.gs` previously declared `Stock` and `Dispose` as one-field `mutate`
 * actions that flipped `WarehouseAction` and nothing else. Neither could do the things
 * confirming a receipt actually requires: write the positive `StockMovements` row that puts
 * the units back on a warehouse shelf, stamp the right one of the two actor/timestamp pairs,
 * and re-evaluate whether the return is now COMPLETE — which depends on the OTHER track, a
 * column a single-column mutate cannot read. This route does all four in one atomic batch.
 *
 * It is also why the outcome is stated BEFORE the commit: the operator sees how many units
 * land in which warehouse, and whether this closes the return or leaves it waiting on an
 * invoice credit.
 *
 * `WarehouseActionCard` is the HYDRATION POINT (§5.5): an `_action` route has no
 * `Create`/`Update` content to seed the node, so the card's `onMounted` seeds the control
 * fields the sticky bar reads back and preloads the master rows its context lines need.
 *
 * `reload: false` — the typed disposal reason is the page's state, and reloading would
 * discard it (§5.5).
 */
export default {
  sections: ['PageHeader'],
  contents: ['WarehouseActionCard'],

  PropsPageHeader: {
    title: 'Confirm Warehouse Action',
    reload: false
  }
}
