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

function getCursorStorageKey(resourceName) {
  return `master-sync-cursor::${resourceName}`
}

function getLocalSyncCursor(resourceName) {
  try {
    return localStorage.getItem(getCursorStorageKey(resourceName)) || ''
  } catch (error) {
    return ''
  }
}

function setLocalSyncCursor(resourceName, cursor) {
  try {
    if (!cursor) return
    localStorage.setItem(getCursorStorageKey(resourceName), cursor)
  } catch (error) {
    // no-op
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
    return queueFlushPromise
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

    dueResourceNames.forEach((resourceName) => masterSyncQueue.delete(resourceName))
    const response = await syncMasterResourcesBatch(dueResourceNames, {
      showError: syncOptions.showError === true,
      showLoading: syncOptions.showLoading === true
    })
    scheduleMasterSyncQueueFlush()
    return response
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

async function ensureHeaders(resourceName) {
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
    const rawCursor = meta?.lastSyncAt || getLocalSyncCursor(resourceName)
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
    setLocalSyncCursor(resourceName, nextSyncCursor)
  }

  return {
    success: true,
    data: responseData,
    meta: response?.meta || {}
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

export async function fetchMasterRecords(resourceName, options = {}) {
  try {
    const includeInactive = options.includeInactive === true
    const forceSync = options.forceSync === true
    const syncWhenCacheExists = options.syncWhenCacheExists === true
    const headers = await ensureHeaders(resourceName)
    if (!headers.length) {
      return { success: false, message: `Headers unavailable for ${resourceName}`, headers: [], rows: [], records: [] }
    }

    const meta = await withTimeout(getResourceMeta(resourceName), null)
    const rawSyncCursor = meta?.lastSyncAt || getLocalSyncCursor(resourceName)
    const syncCursor = normalizeCursorValue(rawSyncCursor)
    const statusIndex = headers.indexOf('Status')
    const cachedRows = await withTimeout(getResourceRows(resourceName, {
      includeInactive,
      statusIndex
    }), [])

    // Default behavior: IDB-first and no server call when cache exists.
    if (!forceSync && !syncWhenCacheExists && cachedRows.length > 0) {
      return {
        success: true,
        stale: false,
        message: '',
        headers,
        rows: cachedRows,
        records: mapRowsToObjects(cachedRows, headers),
        meta: { resource: resourceName, source: 'cache', lastSyncAt: syncCursor || null }
      }
    }

    let stale = false
    let staleMessage = ''
    if (forceSync || syncWhenCacheExists || !cachedRows.length) {
      const hasHydratedOnce = meta?.hasHydratedOnce === true || !!syncCursor
      const ttlMs = getResourceSyncTtlSec(resourceName) * 1000
      const nextEligibleSyncAt = syncCursor ? syncCursor + ttlMs : 0
      const now = Date.now()
      const shouldImmediateSync = forceSync
        || !cachedRows.length
        || !hasHydratedOnce
        || !syncCursor
        || now >= nextEligibleSyncAt

      queueMasterResourceSync(
        resourceName,
        shouldImmediateSync ? now : nextEligibleSyncAt,
        shouldImmediateSync ? (forceSync ? 'force' : 'due-or-cold') : 'ttl-defer'
      )

      if (shouldImmediateSync) {
        const batchSyncResponse = await flushMasterSyncQueue(true, {
          showError: !syncWhenCacheExists || !cachedRows.length,
          showLoading: forceSync || (!syncWhenCacheExists && !cachedRows.length)
        })
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
    const effectiveRows = freshRows.length ? freshRows : cachedRows

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
        lastSyncAt: normalizeCursorValue((await withTimeout(getResourceMeta(resourceName), null))?.lastSyncAt) || syncCursor || null
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

    return syncMasterResourcesBatch(resourceNames, {
      showLoading: false,
      showError: false
    })
  } catch (error) {
    return {
      success: false,
      message: error?.message || 'Failed to sync master resources',
      data: {},
      meta: {}
    }
  }
}

export function clearAllSyncCursors() {
  try {
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('master-sync-cursor::')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))
  } catch (error) {
    // no-op
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
