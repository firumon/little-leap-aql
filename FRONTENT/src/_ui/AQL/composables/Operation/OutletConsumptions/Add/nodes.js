import {
  CONSUMPTION_ROLE,
  CONSUMPTION_CONTROL,
  VISIT_COMPLETE_COMMENT as DOMAIN_VISIT_COMPLETE_COMMENT,
  VISIT_COMPLETE_COMMENT_FIELD as DOMAIN_VISIT_COMPLETE_COMMENT_FIELD
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionDraft'

// OutletConsumptions > Add pageState addresses.
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

export const ROLE = CONSUMPTION_ROLE

export const CTRL = CONSUMPTION_CONTROL

export const VISIT_COMPLETE_COMMENT = DOMAIN_VISIT_COMPLETE_COMMENT
export const VISIT_COMPLETE_COMMENT_FIELD = DOMAIN_VISIT_COMPLETE_COMMENT_FIELD

export const NEXT_VISIT_TARGET = 'nextVisit'

export const INVOICING = CONSUMPTION_CONTROL.INVOICING.header
export const RESTOCKING = CONSUMPTION_CONTROL.RESTOCKING.header
export const COUNT_FILTER = 'countFilter'

export const getCtrl = (pageState, ctrl, fallback = null) =>
  pageState.getControls(ctrl.header, fallback, ctrl.resource, ctrl.role)

export const setCtrl = (pageState, ctrl, value) =>
  pageState.setControls(ctrl.header, value, ctrl.resource, ctrl.role)

export const WIZARD_RESOURCES = [
  'Outlets', 'OutletVisits', 'OutletStorages', 'Warehouses', 'WarehouseStorages',
  'SKUs', 'Products', 'OutletReturns', 'OutletOperatingRules',
  'OutletConsumptionInvoices', 'OutletConsumptionInvoiceItems',
  'Taxes'
]

export const stepVisible = (pageState, step) =>
  step == null || Number(step) === (pageState?.meta.currentStep || 1)
