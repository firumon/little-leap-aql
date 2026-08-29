/**
 * Generic GAS resource request builders and response helpers.
 *
 * Pure Layer 1 utilities (store-free) for building canonical GAS request
 * envelopes and inspecting batch responses.
 */

import { batchRef, batchRefList, isBatchRef, textOrRef, normalizeCodeOrRef } from 'src/utils/appHelpers'
export { batchRef, batchRefList, isBatchRef, textOrRef, normalizeCodeOrRef }

export function responseFailed (response) {
  return !response?.success || (Array.isArray(response.data) && response.data.some(entry => entry?.success === false))
}

export function failureMessage (response, fallback = 'Request failed.') {
  const failed = Array.isArray(response?.data) ? response.data.find(entry => entry?.success === false) : null
  return failed?.error || failed?.message || response?.error || response?.message || fallback
}

export function batchResultCode (response, index = 0) {
  const entry = Array.isArray(response?.data) ? response.data[index] : null
  return entry?.data?.result?.parentCode || entry?.data?.result?.code || entry?.data?.code || ''
}

export function compositeSaveRequest (payload = {}) {
  const { resource, code, data, children } = payload
  return {
    action: 'compositeSave',
    resource,
    payload: { ...(code ? { code: textOrRef(code) } : {}), data, children: children || [] }
  }
}

export function resourceBulkRequest (resource, records = [], cursorResources = []) {
  return {
    action: 'bulk',
    resource,
    payload: { targetResource: resource, records, ...(cursorResources.length ? { lastUpdatedAtResources: [resource, ...cursorResources] } : {}) }
  }
}

export function resourceUpdateRequest (resource, code, data = {}, cursorResources = []) {
  return {
    action: 'update',
    resource,
    payload: { code: textOrRef(code), record: data, ...(cursorResources.length ? { lastUpdatedAtResources: [resource, ...cursorResources] } : {}) }
  }
}

export function resourceCreateRequest (resource, record = {}, cursorResources = []) {
  return {
    action: 'create',
    resource,
    payload: { record, ...(cursorResources.length ? { lastUpdatedAtResources: [resource, ...cursorResources] } : {}) }
  }
}

export function resourceGetRequest (resources = [], payload = {}) {
  const names = Array.isArray(resources) ? resources.filter(Boolean) : [resources].filter(Boolean)
  return { action: 'get', resource: names, payload }
}

export function executeActionRequest (resource, code, actionConfig = {}, data = {}) {
  const fields = data.fields || (data.Comment !== undefined ? data : {})
  const targetFields = data.targets || data.targetFields || null
  const columnValue = data.columnValue || actionConfig.columnValue || ''

  return {
    action: 'executeAction',
    resource,
    payload: {
      code: textOrRef(code),
      actionName: actionConfig.action || actionConfig.actionName || '',
      column: actionConfig.column || 'Progress',
      columnValue,
      fields,
      ...(targetFields && Object.keys(targetFields).length ? { targetFields } : {})
    }
  }
}
