// OutletConsumptions › Add — page contract.
//
// A six-step audit wizard. One content per thing the user is deciding, each listed here
// with its own step (UI_CONTENT_SYSTEM §6):
//
//   step 1  Context         outlet, planned visit, whether stock is carried
//   step 2  StockCount      the physical count
//   step 3  SoldReview      what sold, pricing, bundled earlier audits
//   step 4  RestockOptions  restock on/off, direct or approval, delivered now
//           RestockItems    the restock lines, add drawer, coverage warning
//   step 5  PendingReturns  unsettled returns to credit — SKIPPED when there are none
//   step 6  VisitOptions    read-only summary, visit completion, next visit
//
// The button table per step lives in `Add/PageAction.js`; the step assignment lives here.
//
// `reload: false` — the counts are owned by `pageState`, and a reload mid-count would
// discard shelf work with no undo. There is NO edit page: a consumption is immutable, so
// correcting a miscount is a fresh audit.
export default {
  sections: ['PageHeader'],
  contents: [
    'Context',
    'StockCount',
    'SoldReview',
    'RestockOptions',
    'RestockItems',
    'PendingReturns',
    'VisitOptions'
  ],

  PropsPageHeader: {
    title: 'Record Outlet Consumption',
    reload: false
  },

  PropsContext: { step: 1 },
  PropsStockCount: { step: 2 },
  PropsSoldReview: { step: 3 },
  PropsRestockOptions: { step: 4 },
  PropsRestockItems: { step: 4 },
  PropsPendingReturns: { step: 5 },
  PropsVisitOptions: { step: 6 }
}
