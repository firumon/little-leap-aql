import {
  buildConsumptionInitNodes,
  consumptionDraftDerivations
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionDraft'

const RESOURCE = 'OutletConsumptions'

// OutletConsumptions > Add - a six-step audit wizard.
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
    'ConsumedItems',
    'CompleteVisit',
    'ScheduleNextVisit'
  ],

  // Declarative gating (useContentResolver).
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
  PropsConsumedItems: { step: 6 },
  PropsCompleteVisit: { step: 6 },
  PropsScheduleNextVisit: { step: 6 },

  ready ({ pageState, routeInfo }) {
    const query = routeInfo.value.query || {}
    pageState.resetForResource(RESOURCE)
    pageState.derive(consumptionDraftDerivations())
    pageState.applyNodes(buildConsumptionInitNodes({
      outletCode: String(query.outletCode || '').trim(),
      visitCode: String(query.visitCode || '').trim()
    }))
  }
}
