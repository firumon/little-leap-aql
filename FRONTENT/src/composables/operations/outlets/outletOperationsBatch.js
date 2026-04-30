import { OUTLET_OPERATION_RESOURCES } from './outletOperationsMeta.js'

export function responseFailed(response) { return !response?.success || (Array.isArray(response.data) && response.data.some(entry => entry?.success === false)) }
export function failureMessage(response, fallback = 'Request failed.') { const failed = Array.isArray(response?.data) ? response.data.find(entry => entry?.success === false) : null; return failed?.error || failed?.message || response?.error || response?.message || fallback }
export function batchResultCode(response, index = 0) { const entry = Array.isArray(response?.data) ? response.data[index] : null; return entry?.data?.result?.parentCode || entry?.data?.result?.code || entry?.data?.code || '' }
export function refreshOutletResourcesRequest(resources = OUTLET_OPERATION_RESOURCES) { return { action: 'get', resource: resources.filter(Boolean), payload: { includeInactive: true } } }
export function compositeSaveRequest(payload = {}) { const { resource, code, data, children } = payload; return { action: 'compositeSave', resource, payload: { ...(code ? { code } : {}), data, children: children || [] } } }
export function resourceBulkRequest(resource, records = []) { return { action: 'bulk', resource, payload: { targetResource: resource, records } } }
export function resourceUpdateRequest(resource, code, data = {}) { return { action: 'update', resource, payload: { code, record: data } } }
export function resourceCreateRequest(resource, record = {}) { return { action: 'create', resource, payload: { record } } }
export function executeActionRequest(resource, code, actionConfig, fields = {}) { return { action: 'executeAction', resource, payload: { code, actionName: actionConfig.action, column: actionConfig.column, columnValue: actionConfig.columnValue, fields } } }

export const OUTLET_ACTIONS = {
  completeVisit: { action: 'Complete', column: 'Status', columnValue: 'COMPLETED' },
  postponeVisit: { action: 'Postpone', column: 'Status', columnValue: 'POSTPONED' },
  cancelVisit: { action: 'Cancel', column: 'Status', columnValue: 'CANCELLED' },
  submitRestock: { action: 'Submit', column: 'Progress', columnValue: 'PENDING_APPROVAL' },
  approveRestock: { action: 'Approve', column: 'Progress', columnValue: 'APPROVED' },
  rejectRestock: { action: 'Reject', column: 'Progress', columnValue: 'REJECTED' },
  sendBackRestock: { action: 'SendBack', column: 'Progress', columnValue: 'REVISION_REQUIRED' }
}
