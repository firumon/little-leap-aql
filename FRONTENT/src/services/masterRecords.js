import { callGasApi } from 'src/services/gasApi'
import { useAuthStore } from 'src/stores/auth'
import {
  getResourceMeta,
  getResourceRows,
  setResourceMeta,
  upsertResourceRows
} from 'src/utils/db'

const DB_TIMEOUT_MS = 1200

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
    const syncCursor = meta?.lastSyncAt || getLocalSyncCursor(resourceName)
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

    const payload = {
      scope: 'master',
      resource: resourceName,
      includeInactive: true,
      ...(syncCursor ? { lastUpdatedAt: syncCursor } : {})
    }

    const syncResponse = await callGasApi('get', payload)
    let stale = false
    let staleMessage = ''
    let syncRows = []

    if (syncResponse.success) {
      if (Array.isArray(syncResponse.rows)) {
        syncRows = syncResponse.rows
      } else if (Array.isArray(syncResponse.records)) {
        syncRows = mapObjectsToRows(syncResponse.records, headers)
      } else if (Array.isArray(syncResponse.data)) {
        syncRows = Array.isArray(syncResponse.data[0])
          ? syncResponse.data
          : mapObjectsToRows(syncResponse.data, headers)
      }

      const deltaRows = Array.isArray(syncRows) ? syncRows : []
      if (deltaRows.length) {
        await withTimeout(upsertResourceRows(resourceName, headers, deltaRows), 0)
      }
      const nextSyncCursor = syncResponse?.meta?.lastSyncAt || new Date().toISOString()
      await withTimeout(setResourceMeta(resourceName, {
        headers,
        lastSyncAt: nextSyncCursor
      }), null)
      setLocalSyncCursor(resourceName, nextSyncCursor)
    } else {
      stale = true
      staleMessage = syncResponse.message || `Failed to sync ${resourceName}`
    }

    const freshRows = await withTimeout(getResourceRows(resourceName, {
      includeInactive,
      statusIndex
    }), [])

    const syncRowsFiltered = includeInactive || statusIndex === -1
      ? syncRows
      : syncRows.filter((row) => (row?.[statusIndex] || '').toString().trim() === 'Active')

    const effectiveRows = freshRows.length
      ? freshRows
      : (syncRowsFiltered.length ? syncRowsFiltered : cachedRows)

    return {
      success: syncResponse.success || effectiveRows.length > 0,
      stale,
      message: staleMessage,
      headers,
      rows: effectiveRows,
      records: mapRowsToObjects(effectiveRows, headers),
      meta: syncResponse.meta || { resource: resourceName }
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

export async function createMasterRecord(resourceName, record) {
  return callGasApi('create', {
    scope: 'master',
    resource: resourceName,
    record
  })
}

export async function updateMasterRecord(resourceName, code, record) {
  return callGasApi('update', {
    scope: 'master',
    resource: resourceName,
    code,
    record
  })
}
