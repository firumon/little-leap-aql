/**
 * ResourceRecordsService — LEGACY compatibility wrapper
 * NOW: Delegates to ResourceFetchService (no store dependency)
 * Provides backward compatibility for existing code
 */

import { useAuthStore } from 'src/stores/auth'
import { createResourceSyncQueue } from 'src/services/ResourceSyncQueueService'
import {
  syncMasterResourcesBatch,
  resolveResourceScope,
  fetchResourceRecords as fetchFromService,
  mapRowsToObjects
} from 'src/services/ResourceFetchService'
import {
  createMasterRecord as createFromService,
  updateMasterRecord as updateFromService,
  bulkMasterRecords as bulkFromService,
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
  const response = await syncMasterResourcesBatch(
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

export const queueMasterResourceSync = resourceSyncQueue.queueMasterResourceSync
export const flushMasterSyncQueue = resourceSyncQueue.flushMasterSyncQueue

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

export async function syncAllMasterResources() {
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

  const byScope = {}
  for (const name of resourceNames) {
    const scope = resolveResourceScope(name, context.authorizedResources)
    if (!byScope[scope]) byScope[scope] = []
    byScope[scope].push(name)
  }

  const scopeOrder = ['master', ...Object.keys(byScope).filter((scope) => scope !== 'master')]
  const mergedData = {}

  for (const scope of scopeOrder) {
    const names = byScope[scope]
    if (!names?.length) continue
    const now = Date.now()
    names.forEach((name) => queueMasterResourceSync(name, now, 'global-sync'))
    try {
      const result = await flushMasterSyncQueue(true, { showLoading: false, showError: false })
      if (result?.data) Object.assign(mergedData, result.data)
    } catch {
      // continue with next scope
    }
  }

  return standardizeResponse(true, {
    resources: resourceNames,
    recordsByResource: mergedData,
    lastSyncAt: Date.now()
  })
}

export async function createMasterRecord(resourceName, record) {
  const context = getContextFromStore()
  return createFromService(resourceName, record, context.authorizedResources)
}

export async function updateMasterRecord(resourceName, code, record) {
  const context = getContextFromStore()
  return updateFromService(resourceName, code, record, context.authorizedResources)
}

export async function bulkMasterRecords(targetResourceName, records) {
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
