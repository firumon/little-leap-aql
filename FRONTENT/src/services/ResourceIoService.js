import { executeGasApi } from 'src/services/GasApiService'
import {
  getResourceMeta,
  getResourceRows,
  setResourceMeta,
  upsertResourceRows
} from 'src/services/IndexedDbService'
import {
  authorizedResourcesSet,
  dbInitialize,
  draftDelete,
  draftGet,
  draftSave,
  metaGet,
  metaGetAll,
  metaSet,
  rowsGet,
  rowsUpsert,
  storagesClear
} from 'src/services/IndexedDbCacheService'
import {
  mapRowsToObjects,
  normalizeCursorValue,
  resolveSyncRows
} from 'src/utils/appHelpers'
import { createLogger, standardizeResponse } from './_logger'

const DB_TIMEOUT_MS = 1200
const DEFAULT_RESOURCE_SYNC_TTL_SEC = 300
const MIN_QUEUE_WAIT_MS = 250

const logger = createLogger('ResourceIoService')
const resourceSyncQueue = new Map()
const inFlightResourceNames = new Set()
let queueTimerId = null
let queueFlushPromise = null
let queuedSyncHandler = null

export async function withTimeout(promise, fallbackValue) {
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

function normalizeName(value) {
  return (value || '').toString().trim()
}

function getConfigNumber(appConfig = {}, keys = []) {
  for (const key of keys) {
    const parsed = Number(appConfig?.[key])
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed)
    }
  }
  return null
}

export function getResourceSyncTtl(resourceName, authorizedResources = [], appConfig = {}) {
  const resource = authorizedResources.find((entry) => entry?.name === resourceName)
  const scope = normalizeName(resource?.scope).toLowerCase()
  const scopePascal = scope ? `${scope.charAt(0).toUpperCase()}${scope.slice(1)}` : ''

  return getConfigNumber(appConfig, [
    resource?.syncTTL,
    resource?.SyncTTL,
    `${scope}syncttl`,
    `${scope}SyncTTL`,
    `${scopePascal}SyncTTL`
  ]) || DEFAULT_RESOURCE_SYNC_TTL_SEC
}

export function getCacheRefreshedAt(meta = {}) {
  return normalizeCursorValue(meta?.lastFetchAt)
    || normalizeCursorValue(meta?.cacheRefreshedAt)
    || normalizeCursorValue(meta?.syncedAt)
    || null
}

export function isWithinTtl(refreshedAt, ttlMs) {
  return !!refreshedAt && ttlMs > 0 && Date.now() < refreshedAt + ttlMs
}

function resolveHeadersFromContext(resourceName, meta = {}, authorizedResources = []) {
  if (Array.isArray(meta?.headers) && meta.headers.length) {
    return meta.headers
  }

  const storeResource = authorizedResources.find((entry) => entry?.name === resourceName)
  return Array.isArray(storeResource?.headers) ? storeResource.headers : []
}

export async function readCachedResourcePayload(resourceName, authorizedResources = [], source = 'cache') {
  const meta = await withTimeout(getResourceMeta(resourceName), null)
  const headers = resolveHeadersFromContext(resourceName, meta, authorizedResources)
  const rows = await withTimeout(getResourceRows(resourceName), [])

  return {
    headers,
    rows,
    records: headers.length ? mapRowsToObjects(rows, headers) : [],
    meta: {
      resource: resourceName,
      source,
      skipped: source === 'syncing-skip',
      lastSyncAt: normalizeCursorValue(meta?.lastSyncAt) || null,
      lastFetchAt: getCacheRefreshedAt(meta)
    }
  }
}

export async function ensureHeaders(resourceName, authorizedResources = []) {
  try {
    const meta = await withTimeout(getResourceMeta(resourceName), null)
    if (Array.isArray(meta?.headers) && meta.headers.length) {
      logger.debug('Headers from cache', { resource: resourceName })
      return standardizeResponse(true, meta.headers)
    }

    const storeResource = authorizedResources.find((entry) => entry?.name === resourceName)
    if (Array.isArray(storeResource?.headers) && storeResource.headers.length) {
      logger.debug('Headers from store', { resource: resourceName })
      withTimeout(setResourceMeta(resourceName, {
        headers: storeResource.headers
      }), null)
      return standardizeResponse(true, storeResource.headers)
    }

    const response = await executeGasApi('getAuthorizedResources', { includeHeaders: true })
    if (response.success && Array.isArray(response.data?.result?.resources)) {
      const found = response.data.result.resources.find((entry) => entry?.name === resourceName)
      if (Array.isArray(found?.headers) && found.headers.length) {
        logger.debug('Headers from API', { resource: resourceName })
        withTimeout(setResourceMeta(resourceName, { headers: found.headers }), null)
        return standardizeResponse(true, found.headers)
      }
    }

    logger.warn('No headers found', { resource: resourceName })
    return standardizeResponse(false, [], 'Headers unavailable')
  } catch (error) {
    logger.error('Headers ensure failed', { resource: resourceName, error: error.message })
    return standardizeResponse(false, [], error.message)
  }
}

async function buildLastUpdatedAtByResource(resourceNames = []) {
  const uniqueNames = Array.from(new Set((Array.isArray(resourceNames) ? resourceNames : [])
    .map(normalizeName)
    .filter(Boolean)))

  const cursorMap = {}
  for (const resourceName of uniqueNames) {
    try {
      const meta = await getResourceMeta(resourceName)
      const cursor = normalizeCursorValue(meta?.lastSyncAt)
      cursorMap[resourceName] = cursor || null
    } catch {
      cursorMap[resourceName] = null
    }
  }

  return cursorMap
}

function collectBatchCursorResources(requests = []) {
  const names = []
  requests.forEach((request) => {
    const resourceSelector = Array.isArray(request?.resource) ? request.resource : [request?.resource]
    resourceSelector.filter(Boolean).forEach((name) => names.push(name))
    const payloadCursorResources = request?.payload?.lastUpdatedAtResources
    if (Array.isArray(payloadCursorResources)) {
      payloadCursorResources.filter(Boolean).forEach((name) => names.push(name))
    }
  })
  return Array.from(new Set(names))
}

async function persistBatchResourcePayload(resourceName, resourceData = {}) {
  if (!resourceName || !Array.isArray(resourceData?.rows)) return

  const responseHeaders = Array.isArray(resourceData.headers) && resourceData.headers.length
    ? resourceData.headers
    : []
  const meta = await getResourceMeta(resourceName)
  const metaHeaders = Array.isArray(meta?.headers) && meta.headers.length ? meta.headers : []
  const headers = responseHeaders.length ? responseHeaders : metaHeaders

  if (resourceData.rows.length && headers.length) {
    await rowsUpsert(resourceName, headers, resourceData.rows)
  }

  if (resourceData.meta && typeof resourceData.meta === 'object') {
    await metaSet(resourceName, {
      ...(headers.length ? { headers } : {}),
      lastSyncAt: normalizeCursorValue(resourceData.meta.lastSyncAt) || Date.now(),
      lastFetchAt: Date.now(),
      hasHydratedOnce: true
    })
  }
}

export async function syncResourcesBatch(resourceNames = [], authorizedResources = [], appConfig = {}, options = {}) {
  let syncNames = []
  try {
    const uniqueNames = Array.from(new Set((Array.isArray(resourceNames) ? resourceNames : []).filter(Boolean)))
    if (!uniqueNames.length) {
      return standardizeResponse(true, {}, 'No resources to sync')
    }

    const resourceStatus = options.resourceStatus || null
    syncNames = typeof resourceStatus?.filterAvailableResources === 'function'
      ? resourceStatus.filterAvailableResources(uniqueNames)
      : uniqueNames
    const skipped = uniqueNames.filter((resourceName) => !syncNames.includes(resourceName))

    if (!syncNames.length) {
      logger.info('Batch sync skipped; resources already syncing', { resources: skipped.length })
      return standardizeResponse(true, {
        resourceCount: 0,
        synced: [],
        skipped
      }, 'Resources already syncing')
    }

    resourceStatus?.markSyncStarted?.(syncNames)
    logger.info('Syncing batch', { resources: syncNames.length, skipped: skipped.length })

    const headersByResource = {}
    const cursorByResource = {}
    const unavailableResources = []

    for (const resourceName of syncNames) {
      const headersResp = await ensureHeaders(resourceName, authorizedResources)
      if (headersResp.success && headersResp.data.length) {
        headersByResource[resourceName] = headersResp.data
        resourceStatus?.setHeaders?.(resourceName, headersResp.data)
      } else {
        unavailableResources.push(resourceName)
      }

      const meta = await withTimeout(getResourceMeta(resourceName), null)
      const cursor = normalizeCursorValue(meta?.lastSyncAt)
      if (cursor) {
        cursorByResource[resourceName] = cursor
      }
    }

    const payload = {
      resource: syncNames,
      ...(Object.keys(cursorByResource).length
        ? { lastUpdatedAtByResource: cursorByResource }
        : {})
    }

    logger.debug('Fetching resources', { count: syncNames.length })
    const response = await executeGasApi('get', payload, {
      showLoading: options.showLoading === true,
      showError: options.showError === true
    })

    if (!response.success) {
      const failMessage = response.message || 'Failed to sync resources'
      logger.error('Sync failed', { error: failMessage })
      resourceStatus?.markSyncFailed?.(syncNames, failMessage)
      return standardizeResponse(false, {}, failMessage)
    }

    const mergedResponseData = (response?.data?.resources && typeof response.data.resources === 'object')
      ? response.data.resources
      : {}
    const metaByResource = {}
    const completedResources = []

    for (const resourceName of syncNames) {
      const resourceResponse = mergedResponseData[resourceName]
      const headers = headersByResource[resourceName] || (await ensureHeaders(resourceName, authorizedResources)).data
      if (!headers.length) {
        if (!unavailableResources.includes(resourceName)) {
          unavailableResources.push(resourceName)
        }
        continue
      }
      const unavailableIndex = unavailableResources.indexOf(resourceName)
      if (unavailableIndex !== -1) {
        unavailableResources.splice(unavailableIndex, 1)
      }

      const deltaRows = resolveSyncRows(resourceResponse, headers)
      if (deltaRows.length) {
        logger.debug('Upserting rows', { resource: resourceName, count: deltaRows.length })
        await withTimeout(upsertResourceRows(resourceName, headers, deltaRows), 0)
      }

      const nextMeta = {
        headers,
        lastSyncAt: resourceResponse?.meta?.lastSyncAt || Date.now(),
        lastFetchAt: Date.now(),
        hasHydratedOnce: true
      }
      await withTimeout(setResourceMeta(resourceName, nextMeta), null)
      metaByResource[resourceName] = nextMeta
      completedResources.push(resourceName)
    }

    if (completedResources.length) {
      resourceStatus?.markSyncFinished?.(completedResources, metaByResource)
    }
    if (unavailableResources.length) {
      resourceStatus?.markSyncFailed?.(unavailableResources, 'Headers unavailable')
    }

    logger.info('Batch sync completed', { resources: syncNames.length, skipped: skipped.length })
    return standardizeResponse(true, {
      resourceCount: completedResources.length,
      synced: completedResources,
      skipped
    }, 'Batch sync completed')
  } catch (error) {
    logger.error('Batch sync error', { error: error.message })
    if (syncNames.length) {
      options.resourceStatus?.markSyncFailed?.(syncNames, error.message)
    }
    return standardizeResponse(false, {}, error.message)
  }
}

export async function fetchResourceRecords(resourceName, authorizedResources = [], appConfig = {}, options = {}) {
  try {
    logger.debug('Fetching resource records', { resource: resourceName })

    const resourceStatus = options.resourceStatus || null
    if (resourceStatus?.isSyncing?.(resourceName)) {
      logger.debug('Skipping fetch; resource already syncing', { resource: resourceName })
      const cached = await readCachedResourcePayload(resourceName, authorizedResources, 'syncing-skip')
      return standardizeResponse(true, cached, 'Resource already syncing')
    }

    const headersResp = await ensureHeaders(resourceName, authorizedResources)
    if (!headersResp.success || !headersResp.data.length) {
      logger.warn('Headers not available', { resource: resourceName })
      return standardizeResponse(false, {
        headers: [],
        rows: [],
        records: []
      }, `Headers unavailable for ${resourceName}`)
    }

    const headers = headersResp.data
    resourceStatus?.setHeaders?.(resourceName, headers)

    const meta = await withTimeout(getResourceMeta(resourceName), null)
    resourceStatus?.applyResourceMeta?.(resourceName, meta || {})
    const syncCursor = normalizeCursorValue(meta?.lastSyncAt)
    const cacheRefreshedAt = getCacheRefreshedAt(meta)
    const cachedRows = await withTimeout(getResourceRows(resourceName), [])

    const hasHydratedOnce = meta?.hasHydratedOnce === true
    let effectiveCursor = syncCursor ?? null
    if (!cachedRows.length && effectiveCursor && !hasHydratedOnce) {
      effectiveCursor = null
    }

    const ttlSec = getResourceSyncTtl(resourceName, authorizedResources, appConfig)
    const ttlMs = ttlSec * 1000
    const emptyCacheThrottleMs = Math.max(0, ttlMs / 10)
    const emptyCacheFreshEnough =
      !cachedRows.length &&
      hasHydratedOnce &&
      cacheRefreshedAt &&
      emptyCacheThrottleMs > 0 &&
      isWithinTtl(cacheRefreshedAt, emptyCacheThrottleMs)

    if (emptyCacheFreshEnough) {
      logger.debug('Returning recently hydrated empty cache', { resource: resourceName })
      return standardizeResponse(true, {
        headers,
        rows: [],
        records: [],
        meta: { resource: resourceName, source: 'cache-empty', lastSyncAt: effectiveCursor, lastFetchAt: cacheRefreshedAt }
      })
    }

    const populatedCacheFreshEnough =
      cachedRows.length > 0 &&
      isWithinTtl(cacheRefreshedAt, ttlMs)

    if (cachedRows.length > 0 && populatedCacheFreshEnough) {
      logger.debug('Returning cached rows', { resource: resourceName, count: cachedRows.length })
      return standardizeResponse(true, {
        headers,
        rows: cachedRows,
        records: mapRowsToObjects(cachedRows, headers),
        meta: { resource: resourceName, source: 'cache', lastSyncAt: effectiveCursor || null, lastFetchAt: cacheRefreshedAt }
      })
    }

    let stale = false
    let staleMessage = ''

    const hasUsableHydration = hasHydratedOnce || !!effectiveCursor
    const isManualReload = options.forceSync === true
    const shouldImmediateSync = !hasUsableHydration || isManualReload

    logger.debug('Determining sync strategy', { resource: resourceName, shouldSync: shouldImmediateSync })

    if (shouldImmediateSync) {
      if (!cachedRows.length && syncCursor) {
        await setResourceMeta(resourceName, { lastSyncAt: null })
      }

      const batchSyncResponse = await syncResourcesBatch([resourceName], authorizedResources, appConfig, {
        showError: !cachedRows.length,
        showLoading: !cachedRows.length,
        forceSync: isManualReload,
        resourceStatus
      })

      if (!batchSyncResponse.success) {
        stale = true
        staleMessage = batchSyncResponse.error || `Failed to sync ${resourceName}`
      }
    }

    const freshRows = await withTimeout(getResourceRows(resourceName), [])
    const effectiveRows = freshRows.length ? freshRows : cachedRows
    const latestMeta = await withTimeout(getResourceMeta(resourceName), null)

    logger.debug('Fetch completed', { resource: resourceName, rowCount: effectiveRows.length, stale })

    return standardizeResponse(!stale || effectiveRows.length > 0, {
      headers,
      rows: effectiveRows,
      records: mapRowsToObjects(effectiveRows, headers),
      meta: {
        resource: resourceName,
        source: effectiveRows.length ? (freshRows.length ? 'cache+sync' : 'cache') : 'sync',
        lastSyncAt: normalizeCursorValue(latestMeta?.lastSyncAt) || effectiveCursor || null,
        lastFetchAt: getCacheRefreshedAt(latestMeta) || cacheRefreshedAt
      }
    }, staleMessage)
  } catch (error) {
    logger.error('Fetch failed', { resource: resourceName, error: error.message })
    return standardizeResponse(false, {
      headers: [],
      rows: [],
      records: []
    }, error.message)
  }
}

export async function fetchResourceRecordsBatch(resourceNames = [], authorizedResources = [], appConfig = {}, options = {}) {
  try {
    const uniqueNames = Array.from(new Set((Array.isArray(resourceNames) ? resourceNames : [resourceNames]).filter(Boolean)))
    if (!uniqueNames.length) {
      return standardizeResponse(true, { resources: {}, synced: [] }, 'No resources requested')
    }

    const resourceStatus = options.resourceStatus || null
    let skipped = resourceStatus
      ? uniqueNames.filter((resourceName) => resourceStatus.isSyncing(resourceName))
      : []
    const availableNames = uniqueNames.filter((resourceName) => !skipped.includes(resourceName))
    const now = Date.now()
    const stateByResource = {}
    const syncNames = []
    let syncedNames = []
    const resources = {}
    const errors = []

    for (const resourceName of skipped) {
      resources[resourceName] = await readCachedResourcePayload(resourceName, authorizedResources, 'syncing-skip')
    }

    for (const resourceName of availableNames) {
      const headersResp = await ensureHeaders(resourceName, authorizedResources)
      if (!headersResp.success || !headersResp.data.length) {
        const message = `Headers unavailable for ${resourceName}`
        errors.push(message)
        resources[resourceName] = {
          headers: [],
          rows: [],
          records: [],
          meta: { resource: resourceName, source: 'unavailable', stale: true }
        }
        continue
      }

      const headers = headersResp.data
      resourceStatus?.setHeaders?.(resourceName, headers)
      const meta = await withTimeout(getResourceMeta(resourceName), null)
      resourceStatus?.applyResourceMeta?.(resourceName, meta || {})
      const syncCursor = normalizeCursorValue(meta?.lastSyncAt)
      const cacheRefreshedAt = getCacheRefreshedAt(meta)
      const cachedRows = await withTimeout(getResourceRows(resourceName), [])

      const hasHydratedOnce = meta?.hasHydratedOnce === true
      let effectiveCursor = syncCursor ?? null
      if (!cachedRows.length && effectiveCursor && !hasHydratedOnce) {
        effectiveCursor = null
      }

      const ttlSec = getResourceSyncTtl(resourceName, authorizedResources, appConfig)
      const ttlMs = ttlSec * 1000
      const emptyCacheThrottleMs = Math.max(0, ttlMs / 10)
      const emptyCacheFreshEnough =
        !cachedRows.length &&
        hasHydratedOnce &&
        cacheRefreshedAt &&
        emptyCacheThrottleMs > 0 &&
        now < cacheRefreshedAt + emptyCacheThrottleMs

      const hasUsableHydration = hasHydratedOnce || !!effectiveCursor
      const isManualReload = options.forceSync === true
      const shouldSync = !hasUsableHydration || isManualReload

      if (shouldSync) {
        syncNames.push(resourceName)
      }

      stateByResource[resourceName] = {
        headers,
        cachedRows,
        syncCursor,
        effectiveCursor,
        cacheRefreshedAt,
        hasHydratedOnce,
        emptyCacheFreshEnough
      }
    }

    if (syncNames.length) {
      for (const resourceName of syncNames) {
        const state = stateByResource[resourceName]
        if (!state?.cachedRows?.length && state?.syncCursor && !state.hasHydratedOnce) {
          await withTimeout(setResourceMeta(resourceName, { lastSyncAt: null }), null)
        }
      }

      const syncResponse = await syncResourcesBatch(syncNames, authorizedResources, appConfig, {
        showError: options.showError === true,
        showLoading: options.showLoading === true,
        forceSync: options.forceSync === true,
        resourceStatus
      })

      if (!syncResponse.success) {
        errors.push(syncResponse.error || syncResponse.message || 'Failed to sync resources')
      } else {
        syncedNames = Array.isArray(syncResponse.data?.synced) ? syncResponse.data.synced : []
        const syncSkipped = Array.isArray(syncResponse.data?.skipped) ? syncResponse.data.skipped : []
        skipped = Array.from(new Set([...skipped, ...syncSkipped]))
      }
    }

    for (const resourceName of availableNames) {
      const state = stateByResource[resourceName]
      if (!state) continue

      const meta = await withTimeout(getResourceMeta(resourceName), null)
      const freshRows = await withTimeout(getResourceRows(resourceName), [])
      const rows = freshRows.length ? freshRows : state.cachedRows
      const lastSyncAt = normalizeCursorValue(meta?.lastSyncAt) || state.effectiveCursor || null
      const lastFetchAt = getCacheRefreshedAt(meta) || state.cacheRefreshedAt || null

      resources[resourceName] = {
        headers: state.headers,
        rows,
        records: mapRowsToObjects(rows, state.headers),
        meta: {
          resource: resourceName,
          source: state.emptyCacheFreshEnough
            ? 'cache-empty'
            : (syncedNames.includes(resourceName) ? 'sync' : 'cache'),
          lastSyncAt,
          lastFetchAt
        }
      }
    }

    return standardizeResponse(errors.length === 0, {
      resources,
      synced: syncedNames,
      skipped
    }, errors.join('; '))
  } catch (error) {
    logger.error('Batch fetch failed', { error: error.message })
    return standardizeResponse(false, { resources: {}, synced: [] }, error.message)
  }
}

export async function createRecord(resourceName, record) {
  try {
    logger.debug('Creating record', { resource: resourceName })
    const lastUpdatedAtByResource = await buildLastUpdatedAtByResource([resourceName])
    const response = await executeGasApi('create', {
      resource: resourceName,
      record,
      lastUpdatedAtByResource
    })
    if (response.success) {
      logger.info('Record created', { resource: resourceName })
    }
    return response
  } catch (error) {
    logger.error('Create failed', { resource: resourceName, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function updateRecord(resourceName, code, record) {
  try {
    logger.debug('Updating record', { resource: resourceName, code })
    const lastUpdatedAtByResource = await buildLastUpdatedAtByResource([resourceName])
    const response = await executeGasApi('update', {
      resource: resourceName,
      code,
      record,
      lastUpdatedAtByResource
    })
    if (response.success) {
      logger.info('Record updated', { resource: resourceName, code })
    }
    return response
  } catch (error) {
    logger.error('Update failed', { resource: resourceName, code, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function bulkRecords(targetResourceName, records) {
  try {
    logger.debug('Bulk upload', { resource: targetResourceName, count: records?.length || 0 })
    const lastUpdatedAtByResource = await buildLastUpdatedAtByResource([targetResourceName])
    const response = await executeGasApi('bulk', {
      resource: targetResourceName,
      targetResource: targetResourceName,
      records,
      lastUpdatedAtByResource
    })
    if (response.success) {
      logger.info('Bulk upload success', { resource: targetResourceName })
    }
    return response
  } catch (error) {
    logger.error('Bulk upload failed', { resource: targetResourceName, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function compositeSave(payload) {
  try {
    const parentResource = normalizeName(payload?.resource)
    const childResources = Array.isArray(payload?.children)
      ? payload.children.map((entry) => normalizeName(entry?.resource)).filter(Boolean)
      : []
    const lastUpdatedAtByResource = await buildLastUpdatedAtByResource([parentResource, ...childResources])
    logger.debug('Composite save', { resource: parentResource, childResources: childResources.length })
    const response = await executeGasApi('compositeSave', {
      ...payload,
      lastUpdatedAtByResource
    })
    if (response.success) {
      logger.info('Composite save success')
    }
    return response
  } catch (error) {
    logger.error('Composite save failed', { error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function executeAction(resourceName, code, actionConfig, fields = {}) {
  try {
    logger.debug('Executing action', { resource: resourceName, action: actionConfig.action, code })
    const lastUpdatedAtByResource = await buildLastUpdatedAtByResource([resourceName])
    const response = await executeGasApi('executeAction', {
      resource: resourceName,
      code,
      actionName: actionConfig.action,
      column: actionConfig.column,
      columnValue: actionConfig.columnValue,
      fields,
      lastUpdatedAtByResource
    })
    if (response.success) {
      logger.info('Action executed', { resource: resourceName, action: actionConfig.action })
    }
    return response
  } catch (error) {
    logger.error('Action failed', { resource: resourceName, error: error.message })
    return standardizeResponse(false, null, error.message)
  }
}

export async function runBatchRequests(requests = []) {
  try {
    const resourceNames = collectBatchCursorResources(requests)
    const lastUpdatedAtByResource = await buildLastUpdatedAtByResource(resourceNames)
    const scopedRequests = requests.map((request) => {
      const payload = { ...(request.payload || {}) }
      delete payload.lastUpdatedAtResources
      return {
        ...request,
        payload: { ...payload, lastUpdatedAtByResource }
      }
    })

    const response = await executeGasApi('batch', { requests: scopedRequests })
    const responses = Array.isArray(response?.data?.result?.responses)
      ? response.data.result.responses
      : []
    const resourcePayload = response?.data?.resources && typeof response.data.resources === 'object'
      ? response.data.resources
      : {}

    for (const [resourceName, resourceData] of Object.entries(resourcePayload)) {
      await persistBatchResourcePayload(resourceName, resourceData)
    }

    return {
      success: response?.success === true,
      data: responses,
      resources: resourcePayload,
      error: response?.success === true ? null : (response?.error || response?.message || 'Batch request failed'),
      message: response?.message || ''
    }
  } catch (error) {
    logger.error('Batch request failed', { error: error.message })
    return standardizeResponse(false, [], error.message)
  }
}

export async function generateReport(payload = {}) {
  return executeGasApi('generateReport', payload)
}

function clearQueueTimer() {
  if (queueTimerId) {
    clearTimeout(queueTimerId)
    queueTimerId = null
  }
}

function scheduleResourceSyncQueueFlush() {
  clearQueueTimer()
  if (!resourceSyncQueue.size) return

  let nextDueAt = Number.POSITIVE_INFINITY
  for (const queued of resourceSyncQueue.values()) {
    const dueAt = Number(queued?.dueAt || 0)
    if (dueAt > 0 && dueAt < nextDueAt) {
      nextDueAt = dueAt
    }
  }

  const waitMs = Number.isFinite(nextDueAt)
    ? Math.max(nextDueAt - Date.now(), MIN_QUEUE_WAIT_MS)
    : MIN_QUEUE_WAIT_MS
  queueTimerId = setTimeout(() => {
    flushResourceSyncQueue({ showError: false, showLoading: false }).catch(() => {})
  }, waitMs)
}

export function registerQueuedSyncHandler(syncHandler) {
  queuedSyncHandler = typeof syncHandler === 'function' ? syncHandler : null
}

export function queueResourceSync(resourceName, dueAt, reason = '') {
  if (!resourceName) return
  if (inFlightResourceNames.has(resourceName)) return
  const normalizedDueAt = Number.isFinite(Number(dueAt)) ? Number(dueAt) : Date.now()
  const existing = resourceSyncQueue.get(resourceName)
  if (!existing || normalizedDueAt < existing.dueAt) {
    resourceSyncQueue.set(resourceName, {
      dueAt: normalizedDueAt,
      reason
    })
  }
  scheduleResourceSyncQueueFlush()
}

export async function flushResourceSyncQueue(syncOptions = {}) {
  if (queueFlushPromise) {
    const result = await queueFlushPromise
    if (resourceSyncQueue.size > 0) {
      return flushResourceSyncQueue(syncOptions)
    }
    return result
  }

  queueFlushPromise = (async () => {
    const now = Date.now()
    const dueResourceNames = []

    for (const [resourceName, queued] of resourceSyncQueue.entries()) {
      if ((queued?.dueAt || 0) <= now) {
        dueResourceNames.push(resourceName)
      }
    }

    if (!dueResourceNames.length) {
      scheduleResourceSyncQueueFlush()
      return { success: true, data: {}, meta: { resources: [] } }
    }

    dueResourceNames.forEach((resourceName) => {
      resourceSyncQueue.delete(resourceName)
      inFlightResourceNames.add(resourceName)
    })

    try {
      if (!queuedSyncHandler) {
        return standardizeResponse(false, {}, 'Resource sync handler is not registered')
      }
      const response = await queuedSyncHandler(dueResourceNames, {
        showError: syncOptions.showError === true,
        showLoading: syncOptions.showLoading === true
      })
      scheduleResourceSyncQueueFlush()
      return response
    } finally {
      dueResourceNames.forEach((name) => inFlightResourceNames.delete(name))
    }
  })().finally(() => {
    queueFlushPromise = null
  })

  return queueFlushPromise
}

export async function initializeDb() {
  return dbInitialize()
}

export async function setAuthorizedResources(resources = [], resetCursors = false) {
  return authorizedResourcesSet(resources, resetCursors)
}

export async function clearAllStorage() {
  return storagesClear()
}

export async function getAllResourceMetaCached() {
  return metaGetAll()
}

export async function getResourceMetaCached(resource) {
  return metaGet(resource)
}

export async function setResourceMetaCached(resource, meta) {
  return metaSet(resource, meta)
}

export async function getResourceRowsCached(resource, options = {}) {
  return rowsGet(resource, options)
}

export async function upsertResourceRowsCached(resource, headers = [], rows = []) {
  return rowsUpsert(resource, headers, rows)
}

export async function getDraft(key) {
  return draftGet(key)
}

export async function saveDraft(key, data) {
  return draftSave(key, data)
}

export async function deleteDraft(key) {
  return draftDelete(key)
}
