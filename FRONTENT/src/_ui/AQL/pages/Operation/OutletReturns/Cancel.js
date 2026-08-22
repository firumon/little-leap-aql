/**
 * OutletReturns › Cancel contract — `/operation/outlet-returns/{code}/_action/cancel`.
 *
 * An `_action/:action` route resolves its canonical page key to the ACTION slug, normalized
 * through `toPascalCase(actionParam).toLowerCase()` — `cancel` resolves to `cancel`, so this
 * file is `Cancel.js` (UI_MODULE_DEVELOPER_GUIDE.md §2.1).
 *
 *   single step   reversal preview + reason   →   [ Cancel ] [ Cancel Return ]
 *
 * ── WHY A ROUTE AND NOT THE `mutate` ACTION IT REPLACES ──
 * `GAS/syncAppResources.gs` declared `Cancel` as a one-field `mutate` that flipped
 * `Progress` to CANCELLED and collected a comment. That cannot do the thing cancelling a
 * return actually requires: write the compensating `OutletMovements` row that undoes the
 * shelf movement the return wrote when it was logged. Without it, cancelling a return left
 * the outlet's stock balance permanently wrong in whichever direction the original return
 * moved it.
 *
 * That is also why the reversal is previewed BEFORE the commit. A cancellation's ledger
 * effect is counter-intuitive: a return the outlet was CREDITED for added stock to the
 * shelf, so cancelling it takes stock back OFF. Showing the direction, in units, is what
 * stops a reader cancelling the wrong record.
 *
 * ── ON THE CANCELLATION REASON ──
 * Mandatory, and honestly labelled. `OutletReturns` declares no comment column, and GAS
 * silently drops payload keys that are not sheet headers, so the reason does not yet
 * persist. It is still required and still sent — see `Cancel/CancelConfirm.vue`.
 *
 * `CancelConfirm` is the HYDRATION POINT (§5.5): it seeds the reason control field and
 * preloads the master rows its context lines resolve names from.
 *
 * `reload: false` — the typed reason is the page's state and reloading would discard it.
 */
export default {
  sections: ['PageHeader'],
  contents: ['CancelConfirm'],

  PropsPageHeader: {
    title: 'Cancel Return',
    reload: false
  }
}
