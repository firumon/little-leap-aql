/**
 * ResourceFetchService — Core resource fetch/sync operations
 * Extracted from ResourceRecordsService
 * Does NOT depend on stores; takes context as parameters
 * All responses standardized: { success, data, error }
 */

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
import { createLogger, standardizeResponse } from './_logger'

const DB_TIMEOUT_MS = 1200
const DEFAULT_SCOPE_SYNC_TTL_SEC = {
  master: 900,
  accounts: 60,
  operations: 300
}
const DEFAULT_RESOURCE_SYNC_TTL_SEC = 300

const logger = createLogger('ResourceFetchService')

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

export function resolveResourceScope(resourceName, authorizedResources = []) {
  const resource = authorizedResources.find((entry) => entry?.name === resourceName)
  return (resource?.scope || 'master').toString().trim().toLowerCase()
}

function getResourceSyncTtl(resourceName, authorizedResources = [], appConfig = {}) {
  const resource = authorizedResources.find((entry) => entry?.name === resourceName)
  const scope = (resource?.scope || '').toString().trim().toLowerCase()
  const scopePascal = scope ? `${scope.charAt(0).toUpperCase()}${scope.slice(1)}` : ''
  const scopeConfigKeyLower = `${scope}syncttl`
  const scopeConfigKeyCamel = `${scope}SyncTTL`
  const scopeConfigKeyPascal = `${scopePascal}SyncTTL`

  const scopeTtlFromConfig = Number(
    appConfig?.[scopeConfigKeyLower]
    ?? appConfig?.[scopeConfigKeyCamel]
    ?? appConfig?.[scopeConfigKeyPascal]
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

export async function syncResourcesBatch(resourceNames = [], authorizedResources = [], appConfig = {}, options = {}) {
  try {
    const uniqueNames = Array.from(new Set((Array.isArray(resourceNames) ? resourceNames : []).filter(Boolean)))
    if (!uniqueNames.length) {
      return standardizeResponse(true, {}, 'No resources to sync')
    }

    logger.info('Syncing batch', { resources: uniqueNames.length })

    const headersByResource = {}
    const cursorByResource = {}

    for (const resourceName of uniqueNames) {
      const headersResp = await ensureHeaders(resourceName, authorizedResources)
      if (headersResp.success && headersResp.data.length) {
        headersByResource[resourceName] = headersResp.data
      }

      const meta = await withTimeout(getResourceMeta(resourceName), null)
      const cursor = normalizeCursorValue(meta?.lastSyncAt)
      if (cursor) {
        cursorByResource[resourceName] = cursor
      }
    }

    const mergedResponseData = {}
    const payload = {
      resource: uniqueNames,
      includeInactive: true,
      ...(Object.keys(cursorByResource).length
        ? { lastUpdatedAtByResource: cursorByResource }
        : {})
    }

    logger.debug('Fetching resources', { count: uniqueNames.length })
    const response = await executeGasApi('get', payload, {
      showLoading: options.showLoading === true,
      showError: options.showError === true
    })

    if (!response.success) {
      const failMessage = response.message || 'Failed to sync resources'
      logger.error('Sync failed', { error: failMessage })
      return standardizeResponse(false, {}, failMessage)
    }

    const scopeData = (response?.data?.resources && typeof response.data.resources === 'object')
      ? response.data.resources
      : {}
    Object.assign(mergedResponseData, scopeData)

    for (const resourceName of uniqueNames) {
      const resourceResponse = mergedResponseData[resourceName]
      if (!resourceResponse) {
        continue
      }

      const headers = headersByResource[resourceName] || (await ensureHeaders(resourceName, authorizedResources)).data
      if (!headers.length) {
        continue
      }

      const deltaRows = resolveSyncRows(resourceResponse, headers)
      if (deltaRows.length) {
        logger.debug('Upserting rows', { resource: resourceName, count: deltaRows.length })
        await withTimeout(upsertResourceRows(resourceName, headers, deltaRows), 0)
      }

      const nextSyncCursor = resourceResponse?.meta?.lastSyncAt || Date.now()
      await withTimeout(setResourceMeta(resourceName, {
        headers,
        lastSyncAt: nextSyncCursor,
        hasHydratedOnce: true
      }), null)
    }

    logger.info('Batch sync completed', { resources: uniqueNames.length })
    return standardizeResponse(true, {
      resourceCount: uniqueNames.length,
      synced: uniqueNames
    }, 'Batch sync completed')
  } catch (error) {
    logger.error('Batch sync error', { error: error.message })
    return standardizeResponse(false, {}, error.message)
  }
}

export async function fetchResourceRecords(resourceName, authorizedResources = [], appConfig = {}, options = {}) {
  try {
    logger.debug('Fetching resource records', { resource: resourceName })

    const includeInactive = options.includeInactive === true
    const forceSync = options.forceSync === true
    const syncWhenCacheExists = options.syncWhenCacheExists === true

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

    const meta = await withTimeout(getResourceMeta(resourceName), null)
    const syncCursor = normalizeCursorValue(meta?.lastSyncAt)
    const statusIndex = headers.indexOf('Status')
    const cachedRows = await withTimeout(getResourceRows(resourceName, {
      includeInactive,
      statusIndex
    }), [])

    const hasHydratedOnce = meta?.hasHydratedOnce === true
    let effectiveCursor = syncCursor ?? null
    if (!cachedRows.length && effectiveCursor && !hasHydratedOnce) {
      effectiveCursor = null
    }

    const ttlSec = getResourceSyncTtl(resourceName, authorizedResources, appConfig)
    const ttlMs = ttlSec * 1000
    const emptyCacheThrottleMs = Math.max(0, ttlMs / 10)
    const emptyCacheFreshEnough = !forceSync &&
      !cachedRows.length &&
      hasHydratedOnce &&
      effectiveCursor &&
      emptyCacheThrottleMs > 0 &&
      Date.now() < effectiveCursor + emptyCacheThrottleMs

    if (emptyCacheFreshEnough) {
      logger.debug('Returning recently hydrated empty cache', { resource: resourceName })
      return standardizeResponse(true, {
        headers,
        rows: [],
        records: [],
        meta: { resource: resourceName, source: 'cache-empty', lastSyncAt: effectiveCursor }
      })
    }

    if (!forceSync && !syncWhenCacheExists && cachedRows.length > 0) {
      logger.debug('Returning cached rows', { resource: resourceName, count: cachedRows.length })
      return standardizeResponse(true, {
        headers,
        rows: cachedRows,
        records: mapRowsToObjects(cachedRows, headers),
        meta: { resource: resourceName, source: 'cache', lastSyncAt: effectiveCursor || null }
      })
    }

    let stale = false
    let staleMessage = ''
    let immediateSyncedRows = []

    if (forceSync || syncWhenCacheExists || !cachedRows.length) {
      const hasUsableHydration = hasHydratedOnce || !!effectiveCursor
      const nextEligibleSyncAt = effectiveCursor ? effectiveCursor + ttlMs : 0
      const now = Date.now()
      const shouldImmediateSync = forceSync
        || !cachedRows.length
        || !hasUsableHydration
        || !effectiveCursor
        || now >= nextEligibleSyncAt

      logger.debug('Determining sync strategy', { resource: resourceName, shouldSync: shouldImmediateSync })

      if (shouldImmediateSync) {
        if (!cachedRows.length && syncCursor) {
          await setResourceMeta(resourceName, { lastSyncAt: null })
        }

        // Direct sync call (don't use queue for fetch service)
        const batchSyncResponse = await syncResourcesBatch([resourceName], authorizedResources, appConfig, {
          showError: !syncWhenCacheExists || !cachedRows.length,
          showLoading: forceSync || (!syncWhenCacheExists && !cachedRows.length)
        })

        if (!batchSyncResponse.success) {
          stale = true
          staleMessage = batchSyncResponse.error || `Failed to sync ${resourceName}`
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

    logger.debug('Fetch completed', { resource: resourceName, rowCount: effectiveRows.length, stale })

    return standardizeResponse(!stale || effectiveRows.length > 0, {
      headers,
      rows: effectiveRows,
      records: mapRowsToObjects(effectiveRows, headers),
      meta: {
        resource: resourceName,
        source: effectiveRows.length ? (freshRows.length ? 'cache+sync' : 'cache') : 'sync',
        lastSyncAt: normalizeCursorValue((await withTimeout(getResourceMeta(resourceName), null))?.lastSyncAt) || effectiveCursor || null
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

    const includeInactive = options.includeInactive === true
    const forceSync = options.forceSync === true
    const syncWhenCacheExists = options.syncWhenCacheExists === true
    const now = Date.now()
    const stateByResource = {}
    const syncNames = []
    const resources = {}
    const errors = []

    for (const resourceName of uniqueNames) {
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
      const meta = await withTimeout(getResourceMeta(resourceName), null)
      const syncCursor = normalizeCursorValue(meta?.lastSyncAt)
      const statusIndex = headers.indexOf('Status')
      const cachedRows = await withTimeout(getResourceRows(resourceName, {
        includeInactive,
        statusIndex
      }), [])

      const hasHydratedOnce = meta?.hasHydratedOnce === true
      let effectiveCursor = syncCursor ?? null
      if (!cachedRows.length && effectiveCursor && !hasHydratedOnce) {
        effectiveCursor = null
      }

      const ttlSec = getResourceSyncTtl(resourceName, authorizedResources, appConfig)
      const ttlMs = ttlSec * 1000
      const emptyCacheThrottleMs = Math.max(0, ttlMs / 10)
      const emptyCacheFreshEnough = !forceSync &&
        !cachedRows.length &&
        hasHydratedOnce &&
        effectiveCursor &&
        emptyCacheThrottleMs > 0 &&
        now < effectiveCursor + emptyCacheThrottleMs

      let shouldSync = false
      if (!emptyCacheFreshEnough && (forceSync || syncWhenCacheExists || !cachedRows.length)) {
        const hasUsableHydration = hasHydratedOnce || !!effectiveCursor
        const nextEligibleSyncAt = effectiveCursor ? effectiveCursor + ttlMs : 0
        shouldSync = forceSync ||
          !cachedRows.length ||
          !hasUsableHydration ||
          !effectiveCursor ||
          now >= nextEligibleSyncAt
      }

      if (shouldSync) {
        syncNames.push(resourceName)
      }

      stateByResource[resourceName] = {
        headers,
        cachedRows,
        statusIndex,
        syncCursor,
        effectiveCursor,
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
        showLoading: options.showLoading === true
      })

      if (!syncResponse.success) {
        errors.push(syncResponse.error || syncResponse.message || 'Failed to sync resources')
      }
    }

    for (const resourceName of uniqueNames) {
      const state = stateByResource[resourceName]
      if (!state) continue

      const meta = await withTimeout(getResourceMeta(resourceName), null)
      const freshRows = await withTimeout(getResourceRows(resourceName, {
        includeInactive,
        statusIndex: state.statusIndex
      }), [])
      const rows = freshRows.length ? freshRows : state.cachedRows
      const lastSyncAt = normalizeCursorValue(meta?.lastSyncAt) || state.effectiveCursor || null

      resources[resourceName] = {
        headers: state.headers,
        rows,
        records: mapRowsToObjects(rows, state.headers),
        meta: {
          resource: resourceName,
          source: state.emptyCacheFreshEnough
            ? 'cache-empty'
            : (syncNames.includes(resourceName) ? 'sync' : 'cache'),
          lastSyncAt
        }
      }
    }

    return standardizeResponse(errors.length === 0, {
      resources,
      synced: syncNames
    }, errors.join('; '))
  } catch (error) {
    logger.error('Batch fetch failed', { error: error.message })
    return standardizeResponse(false, { resources: {}, synced: [] }, error.message)
  }
}


export { mapRowsToObjects }

