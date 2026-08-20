/**
 * OutletRestocks › CancelRestock contract — `/operation/outlet-restocks/{code}/_action/cancel-restock`.
 *
 * An `_action/:action` route resolves its canonical page key to the ACTION slug, normalized
 * through `toPascalCase(actionParam).toLowerCase()` — so `cancel-restock` resolves to
 * `cancelrestock`, this file is `CancelRestock.js`, and every placeholder beneath it
 * resolves under the `CancelRestock/` page tier (UI_MODULE_DEVELOPER_GUIDE.md §2.1).
 *
 * WHY A ROUTE AND NOT A MUTATE ACTION. Cancelling used to be a one-field `mutate` that
 * flipped `Status` to Inactive, and it was therefore only offered before approval — because
 * after approval, stock has physically left the warehouse and flipping a column does not put
 * it back. This route exists so a cancellation at ANY stage can do the thing a column flip
 * cannot: write compensating warehouse movements, settle the open lines, and land the parent
 * on what actually happened (CANCELLED, or DELIVERED when part of it already arrived).
 *
 * That is also why the review comes BEFORE the commit — the driver sees exactly which units
 * go back to which warehouse, and which are already at the outlet and stay there.
 *
 * Single step, so `PageAction.js` exposes a plain `actions` array. `reload: false` — the
 * typed reason is the page's state and reloading would discard it.
 */
export default {
  sections: ['PageHeader'],
  contents: ['CancelReview'],

  PropsPageHeader: {
    title: 'Cancel Restock Request',
    reload: false
  }
}
