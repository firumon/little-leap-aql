import {
  buildConsumptionInitNodes,
  consumptionDraftDerivations
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionDraft'

const RESOURCE = 'OutletConsumptions'

// OutletConsumptions > Add - a six-step audit wizard. One content per decision;
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
    SoldReview: ['OutletConsumptionInvoices:create'],
    RestockOptions: ['OutletRestocks:create'],
    RestockItems: ['OutletRestocks:create'],
    CompleteVisit: ['OutletVisits:create'],
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
  PropsScheduleNextVisit: { step: 6 },

  // Page.vue keeps ONE pageState per Page mount and never clears it, so the nodes and
  // DERIVES of the last page visited are still here. Flush them, then mount the draft the
  // domain builds. This contract lists no columns of its own (UI_PAGE_STATE_NODES §5.7A).
  ready ({ pageState, routeInfo }) {
    const query = routeInfo.value.query || {}
    pageState.resetForResource(RESOURCE)
    // Page lifetime, not node lifetime: the consumption node is replaced whenever the
    // outlet changes or the count settles, and rules riding on it would go with it.
    pageState.derive(consumptionDraftDerivations())
    pageState.applyNodes(buildConsumptionInitNodes({
      outletCode: String(query.outletCode || '').trim(),
      visitCode: String(query.visitCode || '').trim()
    }))
  }
}
