import { OUTLET_DEFAULT_STORAGE, active, text } from './outletOperationsMeta.js'

export function toNumber(value) { const number = Number(value); return Number.isFinite(number) ? number : 0 }
export function storageName(value) { return text(value) || OUTLET_DEFAULT_STORAGE }
export function parseStorageAllocations(value) { try { const rows = JSON.parse(text(value) || '[]'); return Array.isArray(rows) ? rows.map(row => ({ storage_name: text(row.storage_name), quantity: toNumber(row.quantity) })).filter(row => row.storage_name || row.quantity > 0) : [] } catch (_) { return [] } }
export function stringifyStorageAllocations(rows = []) { return JSON.stringify(rows.map(row => ({ storage_name: text(row.storage_name), quantity: toNumber(row.quantity) })).filter(row => row.storage_name || row.quantity > 0)) }
export function deliveredQtyForSku(deliveries = [], restockCode, sku) {
  return deliveries.filter(active).filter(row => text(row.OutletRestockCode) === text(restockCode)).reduce((total, delivery) => {
    try {
      const items = JSON.parse(delivery.DeliveredItemsJSON || '[]')
      return total + items.filter(item => text(item.sku) === text(sku)).reduce((sum, item) => sum + toNumber(item.qty), 0)
    } catch (_) { return total }
  }, 0)
}
export function remainingDeliveryQty(item = {}, deliveries = [], restockCode = item.OutletRestockCode) { return Math.max(0, toNumber(item.Quantity) - deliveredQtyForSku(deliveries, restockCode, item.SKU)) }
export function currentOutletStockQty(storages = [], outletCode, store, sku) { const match = storages.find(row => active(row) && text(row.OutletCode) === text(outletCode) && storageName(row.StorageName) === storageName(store) && text(row.SKU) === text(sku)); return toNumber(match?.Quantity) }
export function sumBy(rows = [], field) { return rows.reduce((total, row) => total + toNumber(row[field]), 0) }

function validationResult(errors = [], warnings = []) { return { valid: errors.length === 0, errors, warnings } }
function duplicateSkuErrors(rows = [], qtyField = 'Quantity') { const seen = new Set(); const errors = []; rows.filter(active).filter(row => toNumber(row[qtyField]) > 0).forEach((row) => { const sku = text(row.SKU); if (!sku) errors.push('SKU is required.'); else if (seen.has(sku)) errors.push(`Duplicate SKU ${sku}.`); seen.add(sku) }); return errors }

export function restockEditableProgress(progress) { return ['DRAFT', 'REVISION_REQUIRED'].includes(text(progress) || 'DRAFT') }

export function validateRestockDraft(form = {}, rows = []) {
  const activeRows = rows.filter(active).filter(row => toNumber(row.Quantity) > 0)
  const errors = []
  const warnings = []
  if (form.Code && !restockEditableProgress(form.Progress)) errors.push(`Restock ${form.Code} cannot be edited while progress is ${text(form.Progress) || 'blank'}.`)
  if (!text(form.OutletCode)) errors.push('Outlet is required.')
  if (!text(form.Date)) errors.push('Date is required.')
  if (!text(form.RequestedUser)) errors.push('Requested user is required.')
  if (!activeRows.length) errors.push('At least one requested item is required.')
  rows.filter(active).forEach(row => { if (text(row.SKU) && toNumber(row.Quantity) <= 0) errors.push(`Quantity must be greater than 0 for ${row.SKU}.`) })
  errors.push(...duplicateSkuErrors(rows, 'Quantity'))
  return validationResult(errors, warnings)
}

export function validateRestockApproval(restock = {}, rows = []) {
  const errors = []
  const warnings = []
  if (!text(restock?.Code)) errors.push('Restock code is required for approval.')
  if (text(restock?.Progress) !== 'PENDING_APPROVAL') errors.push('Only pending approval restocks can be approved.')
  if (!rows.filter(active).length) errors.push('At least one item is required for approval.')
  rows.filter(active).forEach(row => { const allocated = sumBy(parseStorageAllocations(row.StorageAllocationJSON), 'quantity'); if (allocated !== toNumber(row.Quantity)) errors.push(`Storage allocation must equal requested quantity for ${row.SKU}.`) })
  return validationResult(errors, warnings)
}

export function validateDelivery(restock = {}, restockItems = [], deliveryRows = [], deliveries = []) {
  const errors = []
  if (!restock) errors.push('Restock is required.')
  if (!['APPROVED', 'PARTIALLY_DELIVERED'].includes(text(restock?.Progress))) errors.push('Delivery requires an approved or partially delivered restock.')
  const positives = deliveryRows.filter(row => toNumber(row.DeliveryQty) > 0)
  if (!positives.length) errors.push('At least one positive delivery quantity is required.')
  positives.forEach(row => { const source = restockItems.find(item => text(item.Code) === text(row.OutletRestockItemCode || row.Code) || text(item.SKU) === text(row.SKU)); if (!source) errors.push(`Restock item not found for ${row.SKU}.`); else if (toNumber(row.DeliveryQty) > remainingDeliveryQty(source, deliveries, restock.Code)) errors.push(`Delivery exceeds remaining quantity for ${row.SKU}.`); else if (toNumber(row.DeliveryQty) > toNumber(row.AllocatedQty || row.Quantity)) errors.push(`Delivery exceeds allocated storage quantity for ${row.SKU} at ${row.StorageName}.`) })
  return validationResult(errors, [])
}

export function validateConsumption(form = {}, rows = [], storages = []) {
  const errors = []
  if (!text(form.OutletCode)) errors.push('Outlet is required.')
  const positives = rows.filter(row => toNumber(row.ConsumedQty) > 0)
  if (!positives.length) errors.push('At least one positive consumption quantity is required.')
  errors.push(...duplicateSkuErrors(rows, 'ConsumedQty'))
  positives.forEach(row => { const available = currentOutletStockQty(storages, form.OutletCode, row.StorageName, row.SKU); if (toNumber(row.ConsumedQty) > available) errors.push(`Consumption exceeds available stock for ${row.SKU}.`) })
  return validationResult(errors, [])
}

export function deliveryRowsForItem(item = {}, deliveryRows = []) {
  const itemCode = text(item.Code)
  const keyedRows = deliveryRows.filter(row => itemCode && (text(row.Code).split(':')[0] === itemCode || text(row.OutletRestockItemCode) === itemCode))
  if (keyedRows.length) return keyedRows
  return deliveryRows.filter(row => !text(row.Code) && !text(row.OutletRestockItemCode) && text(row.SKU) === text(item.SKU))
}

export function deliverySummary(items = [], deliveryRows = []) {
  const activeItems = items.filter(active)
  const deliveredNow = sumBy(deliveryRows, 'DeliveryQty')
  const requested = sumBy(activeItems, 'Quantity')
  const deliveredBefore = activeItems.reduce((total, item) => total + toNumber(item.DeliveredBefore), 0)
  const deliveredAfter = deliveredBefore + deliveredNow
  return { requested, deliveredNow, deliveredAfter, progress: deliveredAfter >= requested ? 'DELIVERED' : 'PARTIALLY_DELIVERED' }
}
