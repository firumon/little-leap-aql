import {
  CONSUMPTION_ROLE,
  CONSUMPTION_CONTROL,
  VISIT_COMPLETE_COMMENT as DOMAIN_VISIT_COMPLETE_COMMENT,
  VISIT_COMPLETE_COMMENT_FIELD as DOMAIN_VISIT_COMPLETE_COMMENT_FIELD
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionDraft'

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

// Relayed from the domain, never restated: the derive rules address the same names.
export const ROLE = CONSUMPTION_ROLE

// Working state only - never a sheet column. Owned by the domain; relayed here so the
// cards keep one import.
export const CTRL = CONSUMPTION_CONTROL

export const VISIT_COMPLETE_COMMENT = DOMAIN_VISIT_COMPLETE_COMMENT
export const VISIT_COMPLETE_COMMENT_FIELD = DOMAIN_VISIT_COMPLETE_COMMENT_FIELD

// The Complete action's own target for the visit it schedules next.
export const NEXT_VISIT_TARGET = 'nextVisit'

// Page-level, not on the invoice node: the answer must outlive the node it is about.
export const INVOICING = CONSUMPTION_CONTROL.INVOICING.header
export const RESTOCKING = CONSUMPTION_CONTROL.RESTOCKING.header

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
