/**
 * OutletConsumptions › Add — page contract (tier CP: resource + page specific).
 *
 * A six-step audit wizard. Each split is there for one of the two sanctioned reasons
 * (§13.6) — a later step needs data the earlier one collected, or the two ask the user to
 * think about genuinely different things:
 *
 *   step 1  Context        outlet, planned visit, and whether stock is being carried
 *   step 2  StockCount     the physical count — needs the outlet from step 1
 *   step 3  SoldReview     what sold, how it is priced, which earlier audits bundle in
 *                          — needs the count from step 2
 *   step 4  RestockReview  replenishment and, for a direct restock, the transfer
 *                          — pre-filled from step 2's sales
 *   step 5  PendingReturns unsettled returns to credit — SKIPPED when there are none
 *   step 6  VisitOptions   read-only summary, visit completion, next visit
 *
 * The BUTTON table for each step lives in `Add/PageAction.js`'s own docblock, which is
 * where navigation is decided; the step ASSIGNMENT lives here, which is where it is
 * declared. Two halves of one flow, each documented where it is owned (§5.5).
 *
 * `PropsPageHeader: { reload: false }` — this page's data is owned by `pageState`, and
 * reloading mid-count would discard the counts the officer has walked the shelves to
 * collect, with no way to undo it.
 *
 * NO EDIT PAGE for this resource, so unlike the restock module no card here is shared with
 * one: a consumption is an immutable record of what was physically on a shelf at a moment
 * in time. Correcting a miscount is a fresh audit, not a rewrite of the old one — which is
 * also why the cancellation cascade writes no reversing stock movements.
 */
export default {
  sections: ['PageHeader'],
  contents: [
    'Context',
    'StockCount',
    'SoldReview',
    'RestockReview',
    'PendingReturns',
    'VisitOptions'
  ],

  PropsPageHeader: {
    title: 'Record Outlet Consumption',
    reload: false
  },

  // Each step carries its own `gutter`, one notch looser than the page default.
  //
  // A wizard step is a stack of input CARDS, not the read-mostly section stack an Index or
  // View page renders, and at the page's own `xs` the discount row and the comment box
  // beneath it sat flush against each other. Declared here rather than as a `q-gutter-y-md`
  // class inside each card, because vertical spacing between siblings belongs to the
  // container and travels through this one token (§10.2) — hardcoding it per card is the
  // per-module divergence the visual contract forbids.
  PropsContext: { step: 1 },
  PropsStockCount: { step: 2 },
  PropsSoldReview: { step: 3 },
  PropsRestockReview: { step: 4 },
  PropsPendingReturns: { step: 5 },
  PropsVisitOptions: { step: 6 }
}
