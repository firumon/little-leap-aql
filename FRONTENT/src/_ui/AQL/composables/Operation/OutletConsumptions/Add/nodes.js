import { RESTOCK_CONTROL } from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'

// OutletConsumptions > Add - the pageState addresses the wizard writes.
// Constants and two one-line accessors. No state, no injects, no computeds: the nodes
// hold the answers and Layer 2 does the domain work, so there is nothing else to keep.

export const NODE = {
  CONSUMPTION: 'OutletConsumptions',
  ITEMS: 'OutletConsumptionItems',
  RETURNS: 'OutletReturns',
  RESTOCKS: 'OutletRestocks',
  RESTOCK_ITEMS: 'OutletRestockItems',
  INVOICES: 'OutletConsumptionInvoices',
  INVOICE_ITEMS: 'OutletConsumptionInvoiceItems',
  VISITS: 'OutletVisits',
  STOCK_MOVEMENTS: 'StockMovements',
  OUTLET_MOVEMENTS: 'OutletMovements'
}

// The next visit is its own record beside the consumption, so it needs its own role. The
// outlet ledger's two legs name theirs in the ledger domain itself (OUTLET_ROLE).
export const ROLE = { NEXT: 'next' }

// Working state only - never a sheet column. Addressed by the node whose editing session
// it belongs to, except the two page-level ones that must outlive their node.
export const CTRL = {
  DIRECT_RESTOCK: { header: RESTOCK_CONTROL.DIRECT, resource: NODE.RESTOCKS },
  WAREHOUSE: { header: RESTOCK_CONTROL.WAREHOUSE, resource: NODE.RESTOCKS },
  MARK_DELIVERED: { header: RESTOCK_CONTROL.DELIVER, resource: NODE.RESTOCKS },
  DISCOUNT_TYPE: { header: 'DiscountType', resource: NODE.INVOICES },
  DISCOUNT_VALUE: { header: 'DiscountValue', resource: NODE.INVOICES },
  INVOICE_COMMENT: { header: 'InvoiceComment', resource: NODE.INVOICES },
  ADJUSTED_RETURNS: { header: 'AdjustedReturnCodes' },
  COMPLETE_VISIT: { header: 'CompleteVisit' },
  SCHEDULE_NEXT: { header: 'ScheduleNextVisit' },
  NEXT_VISIT_DAYS: { header: 'NextVisitDays' },
  NEXT_VISIT_COMMENT: { header: 'NextVisitComment' }
}

// One literal for both the toggle that queues the action and the submit that rebuilds it.
export const VISIT_COMPLETE_COMMENT = 'Completed along with consumption'

// The action system DERIVES a field's storage header from its column and outcome, so the
// authored `Comment` on OutletVisits' Complete lands as `ProgressCompletedComment`. That
// derived header is the one address on the queued entry — binding a screen to the short
// authored name instead would write a second, stray key beside the real one.
export const VISIT_COMPLETE_COMMENT_FIELD = 'ProgressCompletedComment'

// The Complete action's own target for the visit it schedules next.
export const NEXT_VISIT_TARGET = 'nextVisit'

// Page-level, not on the invoice node: the answer must outlive the node it is about.
export const INVOICING = 'invoicing'
export const RESTOCKING = 'restocking'

export const getCtrl = (pageState, ctrl, fallback = null) =>
  pageState.getControls(ctrl.header, fallback, ctrl.resource, ctrl.role)

export const setCtrl = (pageState, ctrl, value) =>
  pageState.setControls(ctrl.header, value, ctrl.resource, ctrl.role)

// Every resource the six steps read. Step 1 loads them all so no later card fetches.
export const WIZARD_RESOURCES = [
  'Outlets', 'OutletVisits', 'OutletStorages', 'Warehouses', 'WarehouseStorages',
  'SKUs', 'Products', 'OutletReturns', 'OutletOperatingRules',
  // Step 5 offers a past invoice as the source of a returned SKU, and reads the rate it
  // was billed at off that invoice's line.
  'OutletConsumptionInvoices', 'OutletConsumptionInvoiceItems',
  // Opened for the INVOICE, not for anything rendered: an unloaded `Taxes` makes the tax
  // resolver find no components and quietly return zero.
  'Taxes'
]

// A step renders only on its own step number. `step: null` means always.
export const stepVisible = (pageState, step) =>
  step == null || Number(step) === (pageState?.meta.currentStep || 1)
