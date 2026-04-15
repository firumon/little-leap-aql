import { callGasApi } from 'src/services/gasApi'
import { useAuthStore } from 'src/stores/auth'
import {
  getResourceMeta,
  getResourceRows,
  setResourceMeta,
  upsertResourceRows
} from 'src/utils/db'

const DB_TIMEOUT_MS = 1200
const DEFAULT_SCOPE_SYNC_TTL_SEC = {
  master: 900,
  accounts: 60,
  operations: 300
}
const DEFAULT_RESOURCE_SYNC_TTL_SEC = 300
const MIN_QUEUE_WAIT_MS = 250

const masterSyncQueue = new Map()
const inFlightResourceNames = new Set()
let queueTimerId = null
let queueFlushPromise = null

async function withTimeout(promise, fallbackValue) {
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        setTimeout(() => resolve(fallbackValue), DB_TIMEOUT_MS)
      })
    ])
  } catch (error) {
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

function resolveResourceScope(resourceName) {
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

function clearQueueTimer() {
  if (queueTimerId) {
    clearTimeout(queueTimerId)
    queueTimerId = null
  }
}

async function flushMasterSyncQueue(forceAll = false, syncOptions = {}) {
  if (queueFlushPromise) {
    const result = await queueFlushPromise
    // Retry if new items were queued while we waited
    if (masterSyncQueue.size > 0) {
      return flushMasterSyncQueue(forceAll, syncOptions)
    }
    return result
  }

  queueFlushPromise = (async () => {
    const now = Date.now()
    const dueResourceNames = []

    for (const [resourceName, queued] of masterSyncQueue.entries()) {
      if (forceAll || (queued?.dueAt || 0) <= now) {
        dueResourceNames.push(resourceName)
      }
    }

    if (!dueResourceNames.length) {
      scheduleMasterSyncQueueFlush()
      return { success: true, data: {}, meta: { resources: [] } }
    }

    dueResourceNames.forEach((resourceName) => {
      masterSyncQueue.delete(resourceName)
      inFlightResourceNames.add(resourceName)
    })

    try {
      const response = await syncMasterResourcesBatch(dueResourceNames, {
        showError: syncOptions.showError === true,
        showLoading: syncOptions.showLoading === true
      })
      scheduleMasterSyncQueueFlush()
      return response
    } finally {
      dueResourceNames.forEach((name) => inFlightResourceNames.delete(name))
    }
  })().finally(() => {
    queueFlushPromise = null
  })

  return queueFlushPromise
}

function scheduleMasterSyncQueueFlush() {
  clearQueueTimer()
  if (!masterSyncQueue.size) return

  let nextDueAt = Number.POSITIVE_INFINITY
  for (const queued of masterSyncQueue.values()) {
    const dueAt = Number(queued?.dueAt || 0)
    if (dueAt > 0 && dueAt < nextDueAt) {
      nextDueAt = dueAt
    }
  }

  const waitMs = Number.isFinite(nextDueAt)
    ? Math.max(nextDueAt - Date.now(), MIN_QUEUE_WAIT_MS)
    : MIN_QUEUE_WAIT_MS
  queueTimerId = setTimeout(() => {
    flushMasterSyncQueue(false, { showError: false, showLoading: false }).catch(() => {})
  }, waitMs)
}

function queueMasterResourceSync(resourceName, dueAt, reason = '') {
  if (!resourceName) return
  if (inFlightResourceNames.has(resourceName)) return
  const normalizedDueAt = Number.isFinite(Number(dueAt)) ? Number(dueAt) : Date.now()
  const existing = masterSyncQueue.get(resourceName)
  if (!existing || normalizedDueAt < existing.dueAt) {
    masterSyncQueue.set(resourceName, {
      dueAt: normalizedDueAt,
      reason
    })
  }
  scheduleMasterSyncQueueFlush()
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

  const response = await callGasApi('getAuthorizedResources', { includeHeaders: true })
  if (response.success && Array.isArray(response.resources)) {
    const found = response.resources.find((entry) => entry?.name === resourceName)
    if (Array.isArray(found?.headers) && found.headers.length) {
      withTimeout(setResourceMeta(resourceName, { headers: found.headers }), null)
      return found.headers
    }
  }

  return []
}

function getHeaderIndexMap(headers = []) {
  const map = {}
  headers.forEach((header, index) => {
    map[header] = index
  })
  return map
}

function mapObjectsToRows(records = [], headers = []) {
  return records.map((record) => headers.map((header) => record?.[header]))
}

function normalizeCursorValue(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const timestamp = Number(value)
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return timestamp
  }

  const parsedTime = new Date(value).getTime()
  return Number.isFinite(parsedTime) ? parsedTime : null
}

function resolveSyncRows(responseData, headers) {
  if (Array.isArray(responseData?.rows)) {
    return responseData.rows
  }

  if (Array.isArray(responseData?.records)) {
    return mapObjectsToRows(responseData.records, headers)
  }

  if (Array.isArray(responseData?.data)) {
    return Array.isArray(responseData.data[0])
      ? responseData.data
      : mapObjectsToRows(responseData.data, headers)
  }

  return []
}

async function syncMasterResourcesBatch(resourceNames = [], options = {}) {
  const uniqueNames = Array.from(new Set((Array.isArray(resourceNames) ? resourceNames : []).filter(Boolean)))
  if (!uniqueNames.length) {
    return { success: true, data: {}, meta: { resources: [] } }
  }

  const showLoading = options.showLoading === true
  const showError = options.showError === true

  const headersByResource = {}
  const cursorByResource = {}

  for (const resourceName of uniqueNames) {
    const headers = await ensureHeaders(resourceName)
    if (headers.length) {
      headersByResource[resourceName] = headers
    }

    const meta = await withTimeout(getResourceMeta(resourceName), null)
    const rawCursor = meta?.lastSyncAt
    const cursor = normalizeCursorValue(rawCursor)
    if (cursor) {
      cursorByResource[resourceName] = cursor
    }
  }

  // Group resources by scope so each batch call uses the correct scope
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

    const response = await callGasApi('get', payload, {
      showLoading,
      showError
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

export function mapRowsToObjects(rows = [], headers = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return []
  }

  if (!Array.isArray(rows[0])) {
    return rows.map((entry) => ({ ...entry }))
  }

  const idx = getHeaderIndexMap(headers)
  return rows.map((row) => {
    const obj = {}
    headers.forEach((header) => {
      obj[header] = row[idx[header]]
    })
    return obj
  })
}

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
    let rawSyncCursor = meta?.lastSyncAt
    let syncCursor = normalizeCursorValue(rawSyncCursor)
    const statusIndex = headers.indexOf('Status')
    const cachedRows = await withTimeout(getResourceRows(resourceName, {
      includeInactive,
      statusIndex
    }), [])

    let effectiveCursor = syncCursor ?? null
    if (!cachedRows.length && effectiveCursor) {
      effectiveCursor = null  // IDB cold + stale cursor → force full sync
    }

    // Default behavior: IDB-first and no server call when cache exists.
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
        // We ensure that if effectiveCursor is null due to cold IDB, cursorByResource logic in syncMasterResourcesBatch won't use it, triggering full sync
        // Temporarily clear it in DB just in case? No, syncMasterResourcesBatch reads DB directly.
        // Wait, syncMasterResourcesBatch reads getResourceMeta().lastSyncAt!
        // So we need to ensure syncMasterResourcesBatch acts as full sync if cachedRows is empty.
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

    // Group by scope so each scope flushes as a separate promise.
    // This lets page-level fetches resolve as soon as their scope completes
    // instead of waiting for all scopes.
    const byScope = {}
    for (const name of resourceNames) {
      const scope = resolveResourceScope(name)
      if (!byScope[scope]) byScope[scope] = []
      byScope[scope].push(name)
    }

    // Process master first, then remaining scopes
    const scopeOrder = ['master', ...Object.keys(byScope).filter((s) => s !== 'master')]
    const mergedData = {}

    for (const scope of scopeOrder) {
      const names = byScope[scope]
      if (!names?.length) continue
      const now = Date.now()
      names.forEach((name) => queueMasterResourceSync(name, now, 'global-sync'))
      try {
        const result = await flushMasterSyncQueue(true, { showLoading: false, showError: false })
        if (result?.data) Object.assign(mergedData, result.data)
      } catch (_) { /* continue with next scope */ }
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
  return callGasApi('create', {
    scope: resolveResourceScope(resourceName),
    resource: resourceName,
    record
  }, { showLoading: true, loadingMessage: 'Creating record...', successMessage: 'Record created successfully' })
}

export async function updateMasterRecord(resourceName, code, record) {
  return callGasApi('update', {
    scope: resolveResourceScope(resourceName),
    resource: resourceName,
    code,
    record
  }, { showLoading: true, loadingMessage: 'Updating record...', successMessage: 'Record updated successfully' })
}

export async function bulkMasterRecords(targetResourceName, records) {
  return callGasApi('bulk', {
    scope: resolveResourceScope(targetResourceName),
    resource: 'BulkUploadMasters',
    callerResource: 'BulkUploadMasters',
    targetResource: targetResourceName,
    records
  }, { showLoading: false, successMessage: null, showError: false })
}

export async function compositeSave(payload) {
  return callGasApi('compositeSave', payload, {
    showLoading: true,
    loadingMessage: 'Saving...',
    successMessage: 'Saved successfully'
  })
}

export async function executeAction(resourceName, code, actionConfig, fields = {}) {
  return callGasApi('executeAction', {
    scope: resolveResourceScope(resourceName),
    resource: resourceName,
    code,
    action: actionConfig.action,
    column: actionConfig.column,
    columnValue: actionConfig.columnValue,
    fields
  }, {
    showLoading: true,
    loadingMessage: `Executing ${actionConfig.label || actionConfig.action}...`,
    successMessage: `${actionConfig.label || actionConfig.action} completed successfully`
  })
}
