import { buildGoodsReceiptCompositePayload } from './poReceivingPayload.js'

export const PO_RECEIVING_RESOURCES = ['PurchaseOrders', 'PurchaseOrderItems', 'POReceivings', 'POReceivingItems', 'GoodsReceipts', 'GoodsReceiptItems', 'Procurements', 'SKUs', 'Products']

export const PO_RECEIVING_ACTIONS = {
  confirm: { action: 'Confirm', column: 'Progress', columnValue: 'CONFIRMED' },
  generate: { action: 'GenerateGRN', column: 'Progress', columnValue: 'GRN_GENERATED' },
  cancel: { action: 'Cancel', column: 'Progress', columnValue: 'CANCELLED' },
  invalidate: { action: 'Invalidate', column: 'Status', columnValue: 'Inactive' }
}

export function text(value) { return value == null ? '' : String(value).trim() }

export function responseFailed(response) {
  return !response?.success || (Array.isArray(response.data) && response.data.some(entry => entry?.success === false))
}

export function failureMessage(response, fallback) {
  const failed = Array.isArray(response?.data) ? response.data.find(entry => entry?.success === false) : null
  const errors = failed?.data?.result?.errors || response?.data?.result?.errors || []
  const details = Array.isArray(errors)
    ? errors.map((entry) => entry?.message || entry?.error || '').filter(Boolean)
    : []
  if (details.length) return details.slice(0, 3).join(' ')
  return failed?.error || failed?.message || response?.error || response?.message || fallback
}

export function batchParentCode(response, index = 0) {
  const entry = Array.isArray(response?.data) ? response.data[index] : null
  return entry?.data?.result?.parentCode || entry?.data?.result?.code || entry?.data?.code || ''
}

export function resultCode(entry = {}) {
  return entry?.data?.result?.parentCode || entry?.data?.result?.code || entry?.data?.code || ''
}

export function refreshRequest(resources = PO_RECEIVING_RESOURCES) {
  return { action: 'get', resource: resources, payload: { includeInactive: true } }
}

export function procurementProgressUpdateRequest(procurement, progress) {
  if (!procurement?.Code || text(procurement.Progress) === progress || text(procurement.Progress) === 'COMPLETED') return null
  return { action: 'update', resource: 'Procurements', payload: { code: procurement.Code, data: { Progress: progress } } }
}

export function resourceUpdateRequest(resource, code, data = {}) {
  return { action: 'update', resource, payload: { code, data } }
}

export function resourceBulkRequest(resource, records = []) {
  return { action: 'bulk', resource, payload: { targetResource: resource, records } }
}

export function compositeSaveRequest(compositePayload) {
  const { resource, code, data, children } = compositePayload || {}
  return {
    action: 'compositeSave',
    resource,
    payload: {
      ...(code ? { code } : {}),
      data,
      children: children || []
    }
  }
}

export function executeActionRequest(resource, code, actionConfig, fields = {}) {
  return {
    action: 'executeAction',
    resource,
    payload: {
      code,
      actionName: actionConfig.action,
      column: actionConfig.column,
      columnValue: actionConfig.columnValue,
      fields
    }
  }
}

export function inactivateGrnItemRequests(goodsReceiptCode, goodsReceiptItems = []) {
  const records = goodsReceiptItems
    .filter(item => text(item.GoodsReceiptCode) === text(goodsReceiptCode) && text(item.Status || 'Active') === 'Active')
    .map(item => ({ Code: item.Code, Status: 'Inactive' }))
  return records.length ? [resourceBulkRequest('GoodsReceiptItems', records)] : []
}

export function buildInvalidateGrnRequests(grn, goodsReceiptItems = [], receiving = null, procurement = null) {
  if (!grn?.Code || text(grn.Status || 'Active') !== 'Active') return []
  const requests = [
    executeActionRequest('GoodsReceipts', grn.Code, PO_RECEIVING_ACTIONS.invalidate, {}),
    ...inactivateGrnItemRequests(grn.Code, goodsReceiptItems)
  ]
  if (receiving?.Code && text(receiving.Progress) === 'GRN_GENERATED') {
    requests.push(resourceUpdateRequest('POReceivings', receiving.Code, { Progress: 'CONFIRMED' }))
  }
  const procurementUpdate = procurementProgressUpdateRequest(procurement, 'GOODS_RECEIVING')
  if (procurementUpdate) requests.push(procurementUpdate)
  return requests
}

export function buildCancelReceivingRequests(receiving, activeGrn, goodsReceiptItems = [], procurement = null, comment = '') {
  const requests = []
  if (activeGrn) requests.push(...buildInvalidateGrnRequests(activeGrn, goodsReceiptItems, receiving, procurement))
  requests.push(executeActionRequest('POReceivings', receiving.Code, PO_RECEIVING_ACTIONS.cancel, { ProgressCancelledComment: comment }))
  const procurementUpdate = procurementProgressUpdateRequest(procurement, 'PO_ISSUED')
  if (procurementUpdate) requests.push(procurementUpdate)
  return requests
}

export function buildGenerateGrnRequests(receiving, receivingItems = [], purchaseOrder = null, procurement = null) {
  const requests = [
    compositeSaveRequest(buildGoodsReceiptCompositePayload(receiving, receivingItems, purchaseOrder, procurement)),
    executeActionRequest('POReceivings', receiving.Code, PO_RECEIVING_ACTIONS.generate, {})
  ]
  const procurementUpdate = procurementProgressUpdateRequest(procurement, 'GRN_GENERATED')
  if (procurementUpdate) requests.push(procurementUpdate)
  return requests
}
