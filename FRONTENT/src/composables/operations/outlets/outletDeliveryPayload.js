import { todayISO, text } from './outletOperationsMeta.js'
import { buildOutletMovementForDelivery, computeRestockProgressFromItems } from './outletStockLogic.js'
import { resourceBulkRequest, resourceUpdateRequest, resourceCreateRequest } from './outletOperationsBatch.js'

function deliveredStamp(actorName = '', comment = '') {
  const now = new Date().toISOString()
  return { ProgressDeliveredAt: now, ProgressDeliveredBy: text(actorName), ProgressDeliveredComment: text(comment) }
}

export function buildOdCreateBatchRequests(odRecord = {}, selectedOrsiRows = []) {
  const codes = selectedOrsiRows.map(row => text(row.Code))
  return [
    resourceCreateRequest('OutletDeliveries', {
      Date: text(odRecord.Date) || todayISO(),
      UserName: text(odRecord.UserName),
      Progress: 'DRAFT',
      Status: 'Active',
      OutletRestockItemCodes: codes.join(','),
      AccessRegion: text(odRecord.AccessRegion)
    }, ['OutletDeliveries'])
  ]
}

export function buildOdDeliverBatchRequests(odRow = {}, deliveredOrsiCodes = [], context = {}, actorName = '', comment = '') {
  const allOrsis = context.orsiRows || []
  const allRestocks = context.restocks || [context.restock || {}]
  const odCode = text(odRow.Code)
  const deliveredSet = new Set(deliveredOrsiCodes.map(text))
  const now = new Date().toISOString()
  const odCodes = (text(odRow.OutletRestockItemCodes) || '').split(',').filter(Boolean).map(c => c.trim())

  const nextOrsis = allOrsis.map(row =>
    deliveredSet.has(text(row.Code))
      ? { ...row, Progress: 'DELIVERED' }
      : row
  )
  const allDelivered = odCodes.every(code =>
    nextOrsis.some(r => text(r.Code) === code && text(r.Progress) === 'DELIVERED')
  )
  const odProgress = allDelivered ? 'COMPLETED' : 'IN_TRANSIT'

  const movements = deliveredOrsiCodes
    .map(code => allOrsis.find(r => text(r.Code) === text(code)))
    .filter(Boolean)
    .map(orsi => {
      const restock = allRestocks.find(r => text(r.Code) === text(orsi.OutletRestockCode)) || {}
      return buildOutletMovementForDelivery(orsi, restock, odCode)
    })

  return [
    resourceBulkRequest('OutletRestockItems',
      deliveredOrsiCodes.map(code => ({
        Code: text(code),
        Progress: 'DELIVERED',
        ...deliveredStamp(actorName, comment)
      })),
      ['OutletRestockItems']
    ),
    ...(movements.length ? [resourceBulkRequest('OutletMovements', movements, ['OutletStorages'])] : []),
    resourceUpdateRequest('OutletDeliveries', odCode, {
      Progress: odProgress,
      ...(odProgress === 'IN_TRANSIT'
        ? { ProgressInTransitAt: now, ProgressInTransitBy: text(actorName), ProgressInTransitComment: `Delivered ${deliveredOrsiCodes.length} of ${odCodes.length} items` }
        : { ProgressCompletedAt: now, ProgressCompletedBy: text(actorName), ProgressCompletedComment: `All ${odCodes.length} items delivered` })
    }, ['OutletDeliveries']),
    ...allRestocks.map(restock => {
      const restockOrsis = nextOrsis.filter(r => text(r.OutletRestockCode) === text(restock.Code))
      if (!restockOrsis.length) return null
      return resourceUpdateRequest('OutletRestocks', text(restock.Code), {
        Progress: computeRestockProgressFromItems(restockOrsis)
      }, ['OutletRestocks'])
    }).filter(Boolean)
  ]
}

export function buildOdCancelBatchRequests(odRow = {}, allOrsis = [], actorName = '', comment = '') {
  const now = new Date().toISOString()
  const odCodes = (text(odRow.OutletRestockItemCodes) || '').split(',').filter(Boolean).map(c => c.trim())
  const orsiRecords = odCodes.map(code => {
    const orsi = allOrsis.find(r => text(r.Code) === code)
    if (!orsi || text(orsi.Progress) === 'DELIVERED') return null
    return { Code: code, Progress: 'ALLOCATED' }
  }).filter(Boolean)
  return [
    resourceBulkRequest('OutletRestockItems', orsiRecords, ['OutletRestockItems']),
    resourceUpdateRequest('OutletDeliveries', text(odRow.Code), {
      Progress: 'CANCELLED',
      CancelledAt: now,
      CancelledBy: text(actorName),
      CancelledComment: text(comment),
      Status: 'Active'
    }, ['OutletDeliveries'])
  ]
}
