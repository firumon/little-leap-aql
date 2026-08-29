import { consumptionNode } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionPayload'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { INVOICING, RESTOCKING, NODE } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'
import { ledgerDerive } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useLedgerPreview'

const allowed = (resource, action) => useResourceConfig(resource).allowed(action) === true

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

  // Seeds the consumption node from the URL.
  ready ({ pageState, routeInfo }) {
    const query = routeInfo.value.query || {}
    // The two page toggles start where the role's permissions leave them: a user who
    // cannot create the record must never see its section switched on.
    pageState.setControls(INVOICING, allowed(NODE.INVOICES, 'create'))
    pageState.setControls(RESTOCKING, allowed(NODE.RESTOCKS, 'create'))
    // Both ledgers follow the answers on their own. Declared here, not in a step card:
    // only the page contract has a lifetime that outlives the steps (§14).
    pageState.derive(ledgerDerive())
    pageState.applyNodes(consumptionNode({
      OutletCode: String(query.outletCode || '').trim(),
      OutletVisitCode: String(query.visitCode || '').trim(),
    }, [], {}))
  }
}
