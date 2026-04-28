/**
 * ResourceRecordsService — LEGACY compatibility wrapper
 * NOW: Delegates to ResourceFetchService (no store dependency)
 * Provides backward compatibility for existing code
 */

import { useAuthStore } from 'src/stores/auth'
import { createResourceSyncQueue } from 'src/services/ResourceSyncQueueService'
import {
  syncResourcesBatch,
  resolveResourceScope,
  fetchResourceRecords as fetchFromService,
  fetchResourceRecordsBatch as fetchBatchFromService,
  mapRowsToObjects
} from 'src/services/ResourceFetchService'
import {
  createRecord as createFromService,
  updateRecord as updateFromService,
  bulkRecords as bulkFromService,
  compositeSave as compositeSaveFromService,
  executeAction as executeFromService
} from 'src/services/ResourceCrudService'
import { standardizeResponse } from './_logger'

// Wrapper to inject store context into ResourceFetchService
function getContextFromStore() {
  const auth = useAuthStore()
  return {
    authorizedResources: Array.isArray(auth.authorizedResources)
      ? auth.authorizedResources
      : auth.authorizedResources?.value || [],
    appConfig: auth?.appConfigMap || auth?.appConfig || {}
  }
}

// Queue setup — delegates to ResourceFetchService
const syncBatchAdapter = async (resourceNames, options) => {
  const context = getContextFromStore()
  const response = await syncResourcesBatch(
    resourceNames,
    context.authorizedResources,
    context.appConfig,
    options
  )
  // Adapt new response format to old queue expectations
  return {
    success: response.success,
    data: response.data || {},
    message: response.error || response.message
  }
}

const resourceSyncQueue = createResourceSyncQueue({ syncBatch: syncBatchAdapter })

export const queueResourceSync = resourceSyncQueue.queueResourceSync
export const flushResourceSyncQueue = resourceSyncQueue.flushResourceSyncQueue

// Legacy exports for backward compatibility
export function getLegacyResourceScope(resourceName) {
  const context = getContextFromStore()
  return resolveResourceScope(resourceName, context.authorizedResources)
}

export { mapRowsToObjects }

export async function fetchResourceRecords(resourceName, options = {}) {
  const context = getContextFromStore()
  const response = await fetchFromService(
    resourceName,
    context.authorizedResources,
    context.appConfig,
    options
  )

  const normalized = standardizeResponse(response.success, {
    headers: response.data?.headers || [],
    rows: response.data?.rows || [],
    records: response.data?.records || [],
    meta: response.data?.meta || {},
    stale: !response.success
  }, response.error || '')

  return {
    ...normalized,
    stale: normalized.data?.stale || false,
    headers: normalized.data?.headers || [],
    rows: normalized.data?.rows || [],
    records: normalized.data?.records || [],
    meta: normalized.data?.meta || {}
  }
}

export async function fetchResources(resourceNames = [], options = {}) {
  const context = getContextFromStore()
  const response = await fetchBatchFromService(
    resourceNames,
    context.authorizedResources,
    context.appConfig,
    options
  )

  const resources = response.data?.resources || {}
  return {
    ...response,
    resources,
    synced: response.data?.synced || []
  }
}

export async function syncAllResources() {
  const context = getContextFromStore()
  const syncableResources = (context.authorizedResources || []).filter((entry) => {
    const scope = (entry?.scope || '').toString().trim().toLowerCase()
    return ['master', 'operation', 'accounts'].includes(scope) &&
      entry?.permissions?.canRead !== false && entry?.name && entry?.functional !== true
  })

  if (!syncableResources.length) {
    return standardizeResponse(true, { resources: [], recordsByResource: {}, lastSyncAt: Date.now() })
  }

  const resourceNames = syncableResources.map((r) => r.name).filter(Boolean)
  if (!resourceNames.length) {
    return standardizeResponse(true, { resources: [], recordsByResource: {}, lastSyncAt: Date.now() })
  }

  const directSync = await syncResourcesBatch(
    resourceNames,
    context.authorizedResources,
    context.appConfig,
    { showLoading: false, showError: false }
  )

  if (!directSync.success) {
    return standardizeResponse(false, {
      resources: resourceNames,
      recordsByResource: {},
      lastSyncAt: Date.now()
    }, directSync.error || directSync.message || 'Global sync failed')
  }

  return standardizeResponse(true, {
    resources: resourceNames,
    recordsByResource: {},
    summary: directSync.data || {},
    lastSyncAt: Date.now()
  })
}

export async function createRecord(resourceName, record) {
  const context = getContextFromStore()
  return createFromService(resourceName, record, context.authorizedResources)
}

export async function updateRecord(resourceName, code, record) {
  const context = getContextFromStore()
  return updateFromService(resourceName, code, record, context.authorizedResources)
}

export async function bulkRecords(targetResourceName, records) {
  const context = getContextFromStore()
  return bulkFromService(targetResourceName, records, context.authorizedResources)
}

export async function compositeSave(payload) {
  return compositeSaveFromService(payload)
}

export async function executeAction(resourceName, code, actionConfig, fields = {}) {
  const context = getContextFromStore()
  return executeFromService(resourceName, code, actionConfig, fields, context.authorizedResources)
}
