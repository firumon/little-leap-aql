import { todayISO, text } from './outletOperationsMeta.js'
import { buildOutletMovementForDelivery, computeRestockProgressFromItems } from './outletStockLogic.js'
import { batchRef, compositeSaveRequest, resourceBulkRequest, resourceUpdateRequest } from './outletOperationsBatch.js'

function deliveredStamp(actorName = '', comment = '') {
  const now = new Date().toISOString()
  return { ProgressDeliveredAt: now, ProgressDeliveredBy: text(actorName), ProgressDeliveredComment: text(comment) }
}

export function buildOdCreateBatchRequests(odRecord = {}, selectedOrsiRows = []) {
  return [compositeSaveRequest({
    resource: 'OutletDeliveries',
    data: {
      Date: text(odRecord.Date) || todayISO(),
      UserName: text(odRecord.UserName),
      Progress: 'DRAFT',
      Status: 'Active',
      AccessRegion: text(odRecord.AccessRegion)
    },
    children: [{
      resource: 'OutletDeliveryItems',
      records: selectedOrsiRows.map(row => ({
        _action: 'create',
        data: {
          OutletRestockItemCode: text(row.Code),
          Progress: 'IN_TRANSIT',
          Status: 'Active',
          AccessRegion: text(row.AccessRegion || odRecord.AccessRegion)
        }
      }))
    }]
  })]
}

export function buildOdDeliverBatchRequests(odiRow = {}, odRow = {}, orsiRow = {}, context = {}, actorName = '', comment = '') {
  const allOdis = context.odiRows || []
  const allOrsis = context.orsiRows || []
  const restock = context.restock || {}
  const odCode = text(odRow.Code)
  const now = new Date().toISOString()
  const nextOdis = allOdis.map(row => text(row.Code) === text(odiRow.Code) ? { ...row, Progress: 'DELIVERED' } : row)
  const nextOrsis = allOrsis.map(row => text(row.Code) === text(orsiRow.Code) ? { ...row, Progress: 'DELIVERED' } : row)
  const allDelivered = nextOdis.filter(row => text(row.Status || 'Active') === 'Active').every(row => text(row.Progress) === 'DELIVERED')
  const odProgress = allDelivered ? 'COMPLETED' : 'IN_TRANSIT'
  const odComment = allDelivered ? `All items of this delivery got delivered at ${new Date(now).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}.` : 'Some of items of this delivery got delivered.'
  return [
    resourceUpdateRequest('OutletDeliveryItems', odiRow.Code, { Progress: 'DELIVERED', ...deliveredStamp(actorName, comment) }, ['OutletDeliveryItems']),
    resourceUpdateRequest('OutletRestockItems', orsiRow.Code, { Progress: 'DELIVERED', ...deliveredStamp(actorName, comment) }, ['OutletRestockItems']),
    resourceBulkRequest('OutletMovements', [buildOutletMovementForDelivery(orsiRow, restock, odCode)], ['OutletStorages']),
    resourceUpdateRequest('OutletDeliveries', odCode, {
      Progress: odProgress,
      ...(odProgress === 'IN_TRANSIT'
        ? { ProgressInTransitAt: now, ProgressInTransitBy: text(actorName), ProgressInTransitComment: odComment }
        : { ProgressCompletedAt: now, ProgressCompletedBy: text(actorName), ProgressCompletedComment: odComment })
    }, ['OutletDeliveries']),
    resourceUpdateRequest('OutletRestocks', restock.Code, { Progress: computeRestockProgressFromItems(nextOrsis) }, ['OutletRestocks'])
  ]
}

export function buildOdCancelBatchRequests(odRow = {}, odiRows = [], orsiRows = [], actorName = '', comment = '') {
  const now = new Date().toISOString()
  const odiRecords = odiRows.map(row => ({ Code: row.Code, Status: 'Inactive' })).filter(row => text(row.Code))
  const orsiRecords = orsiRows.map(row => ({ Code: row.Code, Progress: 'ALLOCATED' })).filter(row => text(row.Code))
  return [
    resourceBulkRequest('OutletDeliveryItems', odiRecords, ['OutletDeliveryItems']),
    resourceBulkRequest('OutletRestockItems', orsiRecords, ['OutletRestockItems']),
    resourceUpdateRequest('OutletDeliveries', odRow.Code, {
      Progress: 'CANCELLED',
      CancelledAt: now,
      CancelledBy: text(actorName),
      CancelledComment: text(comment),
      Status: 'Active'
    }, ['OutletDeliveries'])
  ]
}

export function outletDeliveryCodeRef() { return batchRef('OutletDeliveries.latest.code') }
