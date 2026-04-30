import { todayISO, text, OUTLET_REFERENCE_TYPES } from './outletOperationsMeta.js'
import { deliverySummary, toNumber } from './outletStockLogic.js'
import { compositeSaveRequest, resourceBulkRequest, resourceUpdateRequest, resourceCreateRequest } from './outletOperationsBatch.js'

export function buildRestockCompositePayload(form = {}, rows = [], code = form.Code) {
  return {
    resource: 'OutletRestocks',
    code,
    data: {
      Date: text(form.Date) || todayISO(), OutletCode: text(form.OutletCode), RequestedUser: text(form.RequestedUser), ApprovedUser: text(form.ApprovedUser), Progress: text(form.Progress) || 'DRAFT', ProgressSubmittedComment: text(form.ProgressSubmittedComment), ProgressRevisionRequiredComment: text(form.ProgressRevisionRequiredComment), ProgressApprovedComment: text(form.ProgressApprovedComment), ProgressRejectedComment: text(form.ProgressRejectedComment), Status: text(form.Status || 'Active'), AccessRegion: text(form.AccessRegion)
    },
    children: [{ resource: 'OutletRestockItems', records: rows.map(row => ({ _action: row._delete || row.Status === 'Inactive' ? 'deactivate' : (row.Code ? 'update' : 'create'), ...(row.Code ? { _originalCode: row.Code } : {}), data: { SKU: text(row.SKU), Quantity: toNumber(row.Quantity), StorageAllocationJSON: text(row.StorageAllocationJSON), Status: text(row.Status || 'Active') } })) }]
  }
}

export function buildDeliveryCreateRequest(restock = {}, form = {}, deliveryRows = []) {
  const rows = deliveryRows.filter(row => toNumber(row.DeliveryQty) > 0)
  const deliveryItems = rows.map(row => ({ sku: text(row.SKU), qty: toNumber(row.DeliveryQty) }))
  const deliveryRecord = { OutletRestockCode: restock.Code, OutletCode: restock.OutletCode, DeliveryDate: text(form.DeliveryDate) || todayISO(), DeliveredByUserCode: text(form.DeliveredByUserCode), DeliveredItemsJSON: JSON.stringify(deliveryItems), Progress: 'CONFIRMED', Remarks: text(form.Remarks), Status: 'Active', AccessRegion: text(restock.AccessRegion) }
  return resourceCreateRequest('OutletDeliveries', deliveryRecord)
}

export function buildDeliveryPostRequests(deliveryCode, restock = {}, restockItems = [], form = {}, deliveryRows = []) {
  const rows = deliveryRows.filter(row => toNumber(row.DeliveryQty) > 0)
  const summary = deliverySummary(restockItems, rows)
  const movements = rows.map(row => ({ OutletCode: restock.OutletCode, StorageName: text(row.StorageName) || '_default', SKU: row.SKU, QtyChange: toNumber(row.DeliveryQty), ReferenceType: OUTLET_REFERENCE_TYPES.delivery, ReferenceCode: deliveryCode, ReferenceItemCode: text(row.OutletRestockItemCode) || text(row.Code).split(':')[0], MovementDate: text(form.DeliveryDate) || todayISO(), Status: 'Active', AccessRegion: text(restock.AccessRegion) }))
  return [resourceBulkRequest('OutletMovements', movements), resourceUpdateRequest('OutletRestocks', restock.Code, { Progress: summary.progress })]
}

export function buildDeliveryBatchRequests(restock = {}, restockItems = [], form = {}, deliveryRows = []) {
  return [buildDeliveryCreateRequest(restock, form, deliveryRows), ...buildDeliveryPostRequests('__DELIVERY_CODE__', restock, restockItems, form, deliveryRows)]
}

export function restockSaveRequest(form, rows) { return compositeSaveRequest(buildRestockCompositePayload(form, rows)) }
