import { todayISO, text, OUTLET_REFERENCE_TYPES, STOCK_MOVEMENT_REFERENCE_TYPES } from './outletOperationsMeta.js'
import { buildOutletMovementsFromItems, buildStockMovementsFromItems, parseItemsJSON, toNumber } from './outletStockLogic.js'
import { compositeSaveRequest, executeActionRequest, OUTLET_ACTIONS, resourceBulkRequest, resourceUpdateRequest, resourceCreateRequest } from './outletOperationsBatch.js'

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

export function buildScheduleDeliveryBatchRequests(restock = {}, restockItems = [], warehouseCode = '', itemsJSON = [], actorName = '') {
  const items = parseItemsJSON(itemsJSON)
  const now = new Date().toISOString()
  const record = { OutletRestockCode: restock.Code, OutletCode: restock.OutletCode, WarehouseCode: text(warehouseCode), ScheduledAt: now, ScheduledBy: text(actorName), ItemsJSON: JSON.stringify(items), Progress: 'SCHEDULED', Status: 'Active', AccessRegion: text(restock.AccessRegion) }
  const movements = buildStockMovementsFromItems(warehouseCode, items, STOCK_MOVEMENT_REFERENCE_TYPES.outletRestock, restock.Code, -1).map(row => ({ ...row, AccessRegion: text(restock.AccessRegion) }))
  return [resourceCreateRequest('OutletDeliveries', record), resourceBulkRequest('StockMovements', movements, ['WarehouseStorages'])]
}

export function buildDeliverDeliveryBatchRequests(odCode, od = {}, itemsJSON = [], actorName = '', restockProgress = 'DELIVERED') {
  const now = new Date().toISOString()
  const movements = buildOutletMovementsFromItems(od.OutletCode, itemsJSON, OUTLET_REFERENCE_TYPES.delivery, od.Code || odCode).map(row => ({ ...row, AccessRegion: text(od.AccessRegion) }))
  const requests = [
    executeActionRequest('OutletDeliveries', odCode, OUTLET_ACTIONS.deliverRestock, { DeliveredAt: now, DeliveredBy: text(actorName) }),
    resourceBulkRequest('OutletMovements', movements, ['OutletStorages'])
  ]
  if (text(od.OutletRestockCode)) requests.push(resourceUpdateRequest('OutletRestocks', od.OutletRestockCode, { Progress: text(restockProgress) || 'DELIVERED' }))
  return requests
}

export function buildCancelDeliveryBatchRequests(odCode, od = {}, itemsJSON = [], actorName = '', comment = '') {
  const now = new Date().toISOString()
  const movements = buildStockMovementsFromItems(od.WarehouseCode, itemsJSON, STOCK_MOVEMENT_REFERENCE_TYPES.outletDeliveryCancel, od.Code || odCode, 1).map(row => ({ ...row, AccessRegion: text(od.AccessRegion) }))
  return [
    executeActionRequest('OutletDeliveries', odCode, OUTLET_ACTIONS.cancelDelivery, { CancelledAt: now, CancelledBy: text(actorName), Comment: text(comment), ProgressCancelledComment: text(comment) }),
    resourceBulkRequest('StockMovements', movements, ['WarehouseStorages'])
  ]
}

export function restockSaveRequest(form, rows) { return compositeSaveRequest(buildRestockCompositePayload(form, rows)) }
