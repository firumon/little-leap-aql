export const OUTLET_RESOURCES = {
  outlets: 'Outlets',
  rules: 'OutletOperatingRules',
  visits: 'OutletVisits',
  restocks: 'OutletRestocks',
  restockItems: 'OutletRestockItems',
  deliveries: 'OutletDeliveries',
  consumptions: 'OutletConsumptions',
  consumptionItems: 'OutletConsumptionItems',
  consumptionInvoices: 'OutletConsumptionInvoices',
  consumptionInvoiceItems: 'OutletConsumptionInvoiceItems',
  movements: 'OutletMovements',
  storages: 'OutletStorages',
  skus: 'SKUs',
  products: 'Products',
  priceLists: 'PriceList',
  priceListItems: 'PriceListItems',
  warehouses: 'Warehouses',
  warehouseStorages: 'WarehouseStorages'
}

export const OUTLET_OPERATION_RESOURCES = Object.values(OUTLET_RESOURCES)
export const OUTLET_DEFAULT_STORAGE = '_default'
export const OUTLET_REFERENCE_TYPES = { delivery: 'RestockDelivery', consumption: 'Consumption', adjustment: 'Adjustment' }
export const STOCK_MOVEMENT_REFERENCE_TYPES = { outletRestock: 'OutletRestock' }
export const VISIT_PROGRESS_ORDER = ['PLANNED', 'COMPLETED', 'POSTPONED', 'CANCELLED', 'OTHER']
export const RESTOCK_PROGRESS_ORDER = ['DRAFT', 'PENDING_APPROVAL', 'REVISION_REQUIRED', 'APPROVED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'REJECTED', 'OTHER']
export const RESTOCK_ITEM_PROGRESS_ORDER = ['PENDING', 'ALLOCATED', 'DELIVERED', 'CANCELLED', 'OTHER']
export const DELIVERY_PROGRESS_ORDER = ['IN_TRANSIT', 'DRAFT', 'COMPLETED', 'CANCELLED', 'OTHER']
export const CONSUMPTION_PROGRESS_ORDER = ['PENDING_INVOICE_GENERATION', 'INVOICE_GENERATED', 'CANCELLED', 'OTHER']

const META = {
  PLANNED: ['Planned', 'primary'],
  COMPLETED: ['Completed', 'positive'],
  CANCELLED: ['Cancelled', 'negative'],
  POSTPONED: ['Postponed', 'warning'],
  DRAFT: ['Draft', 'grey'],
  PENDING_APPROVAL: ['Pending Approval', 'orange'],
  REVISION_REQUIRED: ['Revision Required', 'warning'],
  APPROVED: ['Approved', 'positive'],
  PARTIALLY_DELIVERED: ['Partially Delivered', 'info'],
  REJECTED: ['Rejected', 'negative'],
  PENDING: ['Pending', 'orange'],
  ALLOCATED: ['Allocated', 'primary'],
  IN_TRANSIT: ['In Transit', 'primary'],
  DELIVERED: ['Delivered', 'positive'],
  PENDING_INVOICE_GENERATION: ['Pending Invoice Generation', 'warning'],
  INVOICE_GENERATED: ['Invoice Generated', 'positive'],
  PENDING_PAYMENT: ['Pending Payment', 'warning'],
  PARTIALLY_PAID: ['Partially Paid', 'info'],
  PAID: ['Paid', 'positive'],
  SUBMITTED: ['Submitted', 'primary']
}

export function text(value) { return value == null ? '' : String(value).trim() }
export function todayISO() { return new Date().toISOString().slice(0, 10) }
export function progressMeta(progress) { const [label, color] = META[text(progress).toUpperCase()] || [text(progress) || 'Unknown', 'grey']; return { label, color } }
export function active(row) { return text(row?.Status || 'Active') === 'Active' }
export function visitProgress(row = {}) { return text(row.Progress || row.Status).toUpperCase() }
export function formatDate(value) { return text(value) ? text(value).slice(0, 10) : '' }
export function sortTime(row = {}) { const v = row.UpdatedAt || row.CreatedAt || row.ProgressCompletedAt || row.ProgressInTransitAt || row.ProgressDeliveredAt || row.Date || ''; return typeof v === 'number' ? v : (Date.parse(text(v)) || 0) }
