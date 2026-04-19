import { useAuthStore } from 'src/stores/auth'
import { executeGasApi } from 'src/services/GasApiService'
import {
  getResourceMeta,
  getResourceRows,
  setResourceMeta,
  upsertResourceRows
} from 'src/services/IndexedDbService'
import {
  mapRowsToObjects,
  normalizeCursorValue,
  resolveSyncRows
} from 'src/services/ResourceMapperService'
import { createResourceSyncQueue } from 'src/services/ResourceSyncQueueService'

const DB_TIMEOUT_MS = 1200
const DEFAULT_SCOPE_SYNC_TTL_SEC = {
  master: 900,
  accounts: 60,
  operations: 300
}
const DEFAULT_RESOURCE_SYNC_TTL_SEC = 300

async function withTimeout(promise, fallbackValue) {
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        setTimeout(() => resolve(fallbackValue), DB_TIMEOUT_MS)
      })
    ])
  } catch {
    return fallbackValue
  }
}

function getAuthorizedResourceFromStore(resourceName) {
  const auth = useAuthStore()
  const resources = Array.isArray(auth.authorizedResources)
    ? auth.authorizedResources
    : auth.authorizedResources?.value

  if (!Array.isArray(resources)) return null
  return resources.find((entry) => entry?.name === resourceName) || null
}

function getAuthorizedSyncableResources() {
  const auth = useAuthStore()
  const resources = Array.isArray(auth.authorizedResources)
    ? auth.authorizedResources
    : auth.authorizedResources?.value

  if (!Array.isArray(resources)) return []
  return resources.filter((entry) => {
    const scope = (entry?.scope || '').toString().trim().toLowerCase()
    return ['master', 'operation', 'accounts'].includes(scope) &&
      entry?.permissions?.canRead !== false && entry?.name && entry?.functional !== true
  })
}

export function resolveResourceScope(resourceName) {
  const resource = getAuthorizedResourceFromStore(resourceName)
  return (resource?.scope || 'master').toString().trim().toLowerCase()
}

function getResourceSyncTtlSec(resourceName) {
  const auth = useAuthStore()
  const appConfig = auth?.appConfigMap || auth?.appConfig || {}
  const scopeSyncConfig = auth?.scopeSyncConfig || {}
  const resource = getAuthorizedResourceFromStore(resourceName)
  const scope = (resource?.scope || '').toString().trim().toLowerCase()
  const scopePascal = scope ? `${scope.charAt(0).toUpperCase()}${scope.slice(1)}` : ''
  const scopeConfigKeyLower = `${scope}syncttl`
  const scopeConfigKeyCamel = `${scope}SyncTTL`
  const scopeConfigKeyPascal = `${scopePascal}SyncTTL`
  const scopeTtlFromConfig = Number(
    appConfig?.[scopeConfigKeyLower]
    ?? appConfig?.[scopeConfigKeyCamel]
    ?? appConfig?.[scopeConfigKeyPascal]
    ?? scopeSyncConfig?.[scopeConfigKeyCamel]
    ?? scopeSyncConfig?.[scopeConfigKeyPascal]
  )
  if (Number.isFinite(scopeTtlFromConfig) && scopeTtlFromConfig > 0) {
    return Math.floor(scopeTtlFromConfig)
  }

  const scopeTtl = DEFAULT_SCOPE_SYNC_TTL_SEC[scope]
  if (Number.isFinite(scopeTtl) && scopeTtl > 0) {
    return scopeTtl
  }
  return DEFAULT_RESOURCE_SYNC_TTL_SEC
}

export async function ensureHeaders(resourceName) {
  const meta = await withTimeout(getResourceMeta(resourceName), null)
  if (Array.isArray(meta?.headers) && meta.headers.length) {
    return meta.headers
  }

  const storeResource = getAuthorizedResourceFromStore(resourceName)
  if (Array.isArray(storeResource?.headers) && storeResource.headers.length) {
    withTimeout(setResourceMeta(resourceName, {
      headers: storeResource.headers
    }), null)
    return storeResource.headers
  }

  const response = await executeGasApi('getAuthorizedResources', { includeHeaders: true })
  if (response.success && Array.isArray(response.resources)) {
    const found = response.resources.find((entry) => entry?.name === resourceName)
    if (Array.isArray(found?.headers) && found.headers.length) {
      withTimeout(setResourceMeta(resourceName, { headers: found.headers }), null)
      return found.headers
    }
  }

  return []
}

async function syncMasterResourcesBatch(resourceNames = [], options = {}) {
  const uniqueNames = Array.from(new Set((Array.isArray(resourceNames) ? resourceNames : []).filter(Boolean)))
  if (!uniqueNames.length) {
    return { success: true, data: {}, meta: { resources: [] } }
  }

  const headersByResource = {}
  const cursorByResource = {}

  for (const resourceName of uniqueNames) {
    const headers = await ensureHeaders(resourceName)
    if (headers.length) {
      headersByResource[resourceName] = headers
    }

    const meta = await withTimeout(getResourceMeta(resourceName), null)
    const cursor = normalizeCursorValue(meta?.lastSyncAt)
    if (cursor) {
      cursorByResource[resourceName] = cursor
    }
  }

  const byScope = {}
  for (const name of uniqueNames) {
    const scope = resolveResourceScope(name)
    if (!byScope[scope]) byScope[scope] = []
    byScope[scope].push(name)
  }

  const mergedResponseData = {}
  let anyFailed = false
  let failMessage = ''

  for (const [scope, scopeNames] of Object.entries(byScope)) {
    const scopeCursors = {}
    for (const name of scopeNames) {
      if (cursorByResource[name]) scopeCursors[name] = cursorByResource[name]
    }

    const payload = {
      scope,
      resources: scopeNames,
      includeInactive: true,
      ...(Object.keys(scopeCursors).length
        ? { lastUpdatedAtByResource: scopeCursors }
        : {})
    }

    const response = await executeGasApi('get', payload, {
      showLoading: options.showLoading === true,
      showError: options.showError === true
    })

    if (!response.success) {
      anyFailed = true
      failMessage = response.message || `Failed to sync ${scope} resources`
      continue
    }

    const scopeData = (response && typeof response.data === 'object' && response.data !== null)
      ? response.data
      : {}
    Object.assign(mergedResponseData, scopeData)
  }

  if (anyFailed && !Object.keys(mergedResponseData).length) {
    return {
      success: false,
      message: failMessage || 'Failed to sync resources',
      data: {},
      meta: {}
    }
  }

  const responseData = mergedResponseData

  for (const resourceName of uniqueNames) {
    const resourceResponse = responseData[resourceName]
    if (!resourceResponse || resourceResponse.success === false) {
      continue
    }

    const headers = headersByResource[resourceName] || await ensureHeaders(resourceName)
    if (!headers.length) {
      continue
    }

    const deltaRows = resolveSyncRows(resourceResponse, headers)
    if (deltaRows.length) {
      await withTimeout(upsertResourceRows(resourceName, headers, deltaRows), 0)
    }

    const nextSyncCursor = resourceResponse?.meta?.lastSyncAt || Date.now()
    await withTimeout(setResourceMeta(resourceName, {
      headers,
      lastSyncAt: nextSyncCursor,
      hasHydratedOnce: true
    }), null)
  }

  return {
    success: true,
    data: responseData,
    meta: { resources: uniqueNames }
  }
}

const resourceSyncQueue = createResourceSyncQueue({ syncBatch: syncMasterResourcesBatch })

export const queueMasterResourceSync = resourceSyncQueue.queueMasterResourceSync
export const flushMasterSyncQueue = resourceSyncQueue.flushMasterSyncQueue
export { mapRowsToObjects }

export async function fetchResourceRecords(resourceName, options = {}) {
  try {
    const includeInactive = options.includeInactive === true
    const forceSync = options.forceSync === true
    const syncWhenCacheExists = options.syncWhenCacheExists === true
    const headers = await ensureHeaders(resourceName)
    if (!headers.length) {
      return { success: false, message: `Headers unavailable for ${resourceName}`, headers: [], rows: [], records: [] }
    }

    const meta = await withTimeout(getResourceMeta(resourceName), null)
    const syncCursor = normalizeCursorValue(meta?.lastSyncAt)
    const statusIndex = headers.indexOf('Status')
    const cachedRows = await withTimeout(getResourceRows(resourceName, {
      includeInactive,
      statusIndex
    }), [])

    let effectiveCursor = syncCursor ?? null
    if (!cachedRows.length && effectiveCursor) {
      effectiveCursor = null
    }

    if (!forceSync && !syncWhenCacheExists && cachedRows.length > 0) {
      return {
        success: true,
        stale: false,
        message: '',
        headers,
        rows: cachedRows,
        records: mapRowsToObjects(cachedRows, headers),
        meta: { resource: resourceName, source: 'cache', lastSyncAt: effectiveCursor || null }
      }
    }

    let stale = false
    let staleMessage = ''
    let immediateSyncedRows = []
    if (forceSync || syncWhenCacheExists || !cachedRows.length) {
      const hasHydratedOnce = meta?.hasHydratedOnce === true || !!effectiveCursor
      const ttlMs = getResourceSyncTtlSec(resourceName) * 1000
      const nextEligibleSyncAt = effectiveCursor ? effectiveCursor + ttlMs : 0
      const now = Date.now()
      const shouldImmediateSync = forceSync
        || !cachedRows.length
        || !hasHydratedOnce
        || !effectiveCursor
        || now >= nextEligibleSyncAt

      queueMasterResourceSync(
        resourceName,
        shouldImmediateSync ? now : nextEligibleSyncAt,
        shouldImmediateSync ? (forceSync ? 'force' : 'due-or-cold') : 'ttl-defer'
      )

      if (shouldImmediateSync) {
        if (!cachedRows.length && syncCursor) {
          await setResourceMeta(resourceName, { lastSyncAt: null })
        }

        const batchSyncResponse = await flushMasterSyncQueue(true, {
          showError: !syncWhenCacheExists || !cachedRows.length,
          showLoading: forceSync || (!syncWhenCacheExists && !cachedRows.length)
        })
        const resourceSyncPayload = batchSyncResponse?.data?.[resourceName]
        if (resourceSyncPayload && resourceSyncPayload.success !== false) {
          immediateSyncedRows = resolveSyncRows(resourceSyncPayload, headers)
        }
        if (!batchSyncResponse.success) {
          stale = true
          staleMessage = batchSyncResponse.message || `Failed to sync ${resourceName}`
        }
      }
    }

    const freshRows = await withTimeout(getResourceRows(resourceName, {
      includeInactive,
      statusIndex
    }), [])
    const effectiveRows = freshRows.length
      ? freshRows
      : (immediateSyncedRows.length ? immediateSyncedRows : cachedRows)

    return {
      success: !stale || effectiveRows.length > 0,
      stale,
      message: staleMessage,
      headers,
      rows: effectiveRows,
      records: mapRowsToObjects(effectiveRows, headers),
      meta: {
        resource: resourceName,
        source: effectiveRows.length ? (freshRows.length ? 'cache+sync' : 'cache') : 'sync',
        lastSyncAt: normalizeCursorValue((await withTimeout(getResourceMeta(resourceName), null))?.lastSyncAt) || effectiveCursor || null
      }
    }
  } catch (error) {
    return {
      success: false,
      message: error?.message || `Failed to load ${resourceName}`,
      headers: [],
      rows: [],
      records: []
    }
  }
}

export async function syncAllMasterResources() {
  try {
    const masterResources = getAuthorizedSyncableResources()

    if (!masterResources.length) {
      return { success: true, data: {}, meta: { resources: [], lastSyncAt: Date.now() } }
    }

    const resourceNames = masterResources
      .map((resource) => (resource?.name || '').toString().trim())
      .filter(Boolean)
    if (!resourceNames.length) {
      return { success: true, data: {}, meta: { resources: [], lastSyncAt: Date.now() } }
    }

    const byScope = {}
    for (const name of resourceNames) {
      const scope = resolveResourceScope(name)
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

    return { success: true, data: mergedData, meta: { resources: resourceNames, lastSyncAt: Date.now() } }
  } catch (error) {
    return {
      success: false,
      message: error?.message || 'Failed to sync master resources',
      data: {},
      meta: {}
    }
  }
}

export async function createMasterRecord(resourceName, record) {
  return executeGasApi('create', {
    scope: resolveResourceScope(resourceName),
    resource: resourceName,
    record
  })
}

export async function updateMasterRecord(resourceName, code, record) {
  return executeGasApi('update', {
    scope: resolveResourceScope(resourceName),
    resource: resourceName,
    code,
    record
  })
}

export async function bulkMasterRecords(targetResourceName, records) {
  return executeGasApi('bulk', {
    scope: resolveResourceScope(targetResourceName),
    resource: 'BulkUploadMasters',
    callerResource: 'BulkUploadMasters',
    targetResource: targetResourceName,
    records
  })
}

export async function compositeSave(payload) {
  return executeGasApi('compositeSave', payload)
}

export async function executeAction(resourceName, code, actionConfig, fields = {}) {
  return executeGasApi('executeAction', {
    scope: resolveResourceScope(resourceName),
    resource: resourceName,
    code,
    action: actionConfig.action,
    column: actionConfig.column,
    columnValue: actionConfig.columnValue,
    fields
  })
}
