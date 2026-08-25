// OutletConsumptions › Add — a six-step audit wizard. One content per decision;
// the button table per step lives in `Add/PageAction.js`.
export default {
  sections: ['PageHeader'],
  contents: [
    'Context',
    'StockCount',
    'SoldReview',
    'RestockOptions',
    'RestockItems',
    'PendingReturns',
    'VisitSummary',
    'CompleteVisit',
    'ScheduleNextVisit'
  ],

  // Declarative gating (useContentResolver). Each leg claims the SAME action its Layer 2
  // builder claims at submit time, so a role never sees a control it would be refused.
  permissions: {
    RestockOptions: ['OutletRestocks:create'],
    RestockItems: ['OutletRestocks:create'],
    PendingReturns: ['OutletReturns:read'],
    CompleteVisit: ['OutletVisits:complete'],
    ScheduleNextVisit: ['OutletVisits:create']
  },

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
  PropsVisitSummary: { step: 6 },
  PropsCompleteVisit: { step: 6 },
  PropsScheduleNextVisit: { step: 6 }
}
