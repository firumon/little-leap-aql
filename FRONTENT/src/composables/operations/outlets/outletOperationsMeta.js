export const OUTLET_RESOURCES = {
  outlets: 'Outlets', rules: 'OutletOperatingRules', visits: 'OutletVisits', restocks: 'OutletRestocks', restockItems: 'OutletRestockItems', deliveries: 'OutletDeliveries', consumption: 'OutletConsumption', consumptionItems: 'OutletConsumptionItems', movements: 'OutletMovements', storages: 'OutletStorages', skus: 'SKUs', products: 'Products', warehouses: 'Warehouses', warehouseStorages: 'WarehouseStorages'
}

export const OUTLET_OPERATION_RESOURCES = Object.values(OUTLET_RESOURCES)
export const OUTLET_DEFAULT_STORAGE = '_default'
export const OUTLET_REFERENCE_TYPES = { delivery: 'RestockDelivery', consumption: 'Consumption', adjustment: 'Adjustment' }
export const STOCK_MOVEMENT_REFERENCE_TYPES = { outletRestock: 'OutletRestock', outletDeliveryCancel: 'OutletDeliveryCancel' }
export const VISIT_STATUS_ORDER = ['PLANNED', 'COMPLETED', 'POSTPONED', 'CANCELLED', 'OTHER']
export const RESTOCK_PROGRESS_ORDER = ['DRAFT', 'PENDING_APPROVAL', 'REVISION_REQUIRED', 'APPROVED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'REJECTED', 'OTHER']
export const DELIVERY_PROGRESS_ORDER = ['SCHEDULED', 'DELIVERED', 'CANCELLED', 'OTHER']

const META = {
  PLANNED: ['Planned', 'primary'], COMPLETED: ['Completed', 'positive'], POSTPONED: ['Postponed', 'warning'], CANCELLED: ['Cancelled', 'negative'],
  DRAFT: ['Draft', 'grey'], PENDING_APPROVAL: ['Pending Approval', 'orange'], REVISION_REQUIRED: ['Revision Required', 'warning'], APPROVED: ['Approved', 'positive'], PARTIALLY_DELIVERED: ['Partially Delivered', 'info'], DELIVERED: ['Delivered', 'positive'], REJECTED: ['Rejected', 'negative'], CONFIRMED: ['Confirmed', 'positive'], SCHEDULED: ['Scheduled', 'warning']
}

export function text(value) { return value == null ? '' : String(value).trim() }
export function todayISO() { return new Date().toISOString().slice(0, 10) }
export function progressMeta(progress) { const [label, color] = META[text(progress).toUpperCase()] || [text(progress) || 'Unknown', 'grey']; return { label, color } }
export function active(row) { return text(row?.Status || 'Active') === 'Active' }
export function formatDate(value) { return text(value) ? text(value).slice(0, 10) : '' }
export function sortTime(row = {}) { const v = row.UpdatedAt || row.CreatedAt || row.ScheduledAt || row.DeliveredAt || row.Date || row.ConsumptionDate || ''; return typeof v === 'number' ? v : (Date.parse(text(v)) || 0) }
