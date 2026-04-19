import 'src/utils/idbCompat'
import { openDB } from 'idb'
import { createLogger } from './_logger'

const DB_NAME = 'aql-db'
const DB_VERSION = 3

let dbPromise = null
const rowListeners = []
const logger = createLogger('IndexedDbService')

export function onRowsUpserted(fn) {
  if (typeof fn === 'function') {
    rowListeners.push(fn)
  }
}

export function reinitializeDB() {
  if (dbPromise) return dbPromise

  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      logger.info('Upgrading IndexedDB', { version: DB_VERSION })
      if (!db.objectStoreNames.contains('api-cache')) {
        db.createObjectStore('api-cache', { keyPath: 'url' })
      }
      if (!db.objectStoreNames.contains('sync-queue')) {
        db.createObjectStore('sync-queue', { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains('app-data')) {
        db.createObjectStore('app-data')
      }
      if (!db.objectStoreNames.contains('resource-meta')) {
        db.createObjectStore('resource-meta', { keyPath: 'resource' })
      }
      if (!db.objectStoreNames.contains('resource-records')) {
        const store = db.createObjectStore('resource-records', { keyPath: 'id' })
        store.createIndex('by-resource', 'resource', { unique: false })
        store.createIndex('by-resource-updatedAt', ['resource', 'updatedAt'], { unique: false })
      }
      if (!db.objectStoreNames.contains('functional-drafts')) {
        db.createObjectStore('functional-drafts', { keyPath: 'key' })
      }
    },
    blocked() {
      logger.warn('IndexedDB upgrade blocked by another connection')
    },
    blocking() {
      logger.warn('IndexedDB version change requested elsewhere, closing current connection')
      if (dbPromise) {
        dbPromise.then((db) => db.close()).catch(() => {})
      }
      dbPromise = null
    }
  })
  return dbPromise
}

export async function ensureDB() {
  if (!dbPromise) {
    return reinitializeDB()
  }
  return dbPromise
}

export async function getCache(url) {
  return (await ensureDB()).get('api-cache', url)
}

export async function setCache(url, data) {
  return (await ensureDB()).put('api-cache', {
    url,
    data,
    timestamp: Date.now()
  })
}

export async function addToSyncQueue(requestData) {
  return (await ensureDB()).add('sync-queue', {
    ...requestData,
    timestamp: Date.now()
  })
}

export async function getSyncQueue() {
  return (await ensureDB()).getAll('sync-queue')
}

export async function removeFromSyncQueue(id) {
  return (await ensureDB()).delete('sync-queue', id)
}

export async function setResourceMeta(resource, meta = {}) {
  if (!resource) return null
  const db = await ensureDB()
  const current = await db.get('resource-meta', resource)
  return db.put('resource-meta', {
    ...(current || {}),
    resource,
    ...meta
  })
}

export async function getResourceMeta(resource) {
  if (!resource) return null
  return (await ensureDB()).get('resource-meta', resource)
}

function toPlainStringArray(value, fallback = []) {
  if (!Array.isArray(value)) {
    return Array.isArray(fallback) ? fallback : []
  }

  return value.map((item) => (item === null || item === undefined ? '' : String(item)))
}

function toCloneSafeObject(value, fallback = null) {
  if (value === null || value === undefined) {
    return fallback
  }

  if (typeof value !== 'object') {
    return value
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return fallback
  }
}

export async function setAuthorizedResources(resources = [], resetCursors = false) {
  const db = await ensureDB()
  const tx = db.transaction('resource-meta', 'readwrite')
  for (const resource of resources) {
    const name = (resource?.name || '').toString().trim()
    if (!name) continue

    const existing = await tx.store.get(name)
    const headers = toPlainStringArray(resource?.headers, existing?.headers || [])
    const permissions = toCloneSafeObject(
      resource?.permissions,
      toCloneSafeObject(existing?.permissions, null)
    )
    await tx.store.put({
      resource: name,
      headers,
      permissions,
      fileId: resource.fileId || existing?.fileId || '',
      sheetName: resource.sheetName || existing?.sheetName || '',
      codePrefix: resource.codePrefix || existing?.codePrefix || '',
      codeSequenceLength: resource.codeSequenceLength || existing?.codeSequenceLength || null,
      lastSyncAt: resetCursors ? null : (existing?.lastSyncAt || null)
    })
  }
  await tx.done
}

function normalizeKeyValue(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function parseDateForSort(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export async function upsertResourceRows(resource, headers = [], rows = []) {
  if (!resource || !Array.isArray(headers) || !Array.isArray(rows) || headers.length === 0) {
    return 0
  }

  const codeIndex = headers.indexOf('Code')
  if (codeIndex === -1) return 0

  const updatedAtIndex = headers.indexOf('UpdatedAt')
  const db = await ensureDB()
  const tx = db.transaction('resource-records', 'readwrite')
  let affected = 0

  for (const row of rows) {
    if (!Array.isArray(row)) continue

    const code = normalizeKeyValue(row[codeIndex])
    if (!code) continue

    const updatedAtRaw = updatedAtIndex === -1 ? null : row[updatedAtIndex]
    await tx.store.put({
      id: `${resource}::${code}`,
      resource,
      code,
      row,
      updatedAt: parseDateForSort(updatedAtRaw),
      storedAt: Date.now()
    })
    affected += 1
  }

  await tx.done

  for (const fn of rowListeners) {
    try {
      fn(resource, rows)
    } catch (error) {
      logger.error('Error in row listener', { error: error?.message || String(error) })
    }
  }

  return affected
}

export async function getResourceRows(resource, options = {}) {
  if (!resource) return []
  const { includeInactive = true, statusIndex = -1 } = options
  const db = await ensureDB()
  const tx = db.transaction('resource-records', 'readonly')
  const index = tx.store.index('by-resource')
  const allRows = await index.getAll(resource)
  await tx.done

  const filtered = allRows.filter((entry) => Array.isArray(entry.row)).map((entry) => entry.row)
  if (includeInactive || statusIndex === -1) {
    return filtered
  }

  return filtered.filter((row) => (row[statusIndex] || '').toString().trim() === 'Active')
}

export async function deleteResourceRowByCode(resource, code) {
  if (!resource || !code) return null
  const db = await ensureDB()
  return db.delete('resource-records', `${resource}::${normalizeKeyValue(code)}`)
}

export async function saveFunctionalDraft(key, data) {
  if (!key) return null
  const db = await ensureDB()
  return db.put('functional-drafts', { key, data, savedAt: Date.now() })
}

export async function getFunctionalDraft(key) {
  if (!key) return null
  return (await ensureDB()).get('functional-drafts', key)
}

export async function deleteFunctionalDraft(key) {
  if (!key) return null
  return (await ensureDB()).delete('functional-drafts', key)
}

async function deleteIndexedDbByName(databaseName) {
  if (!databaseName || typeof indexedDB === 'undefined') return false
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(databaseName)
      request.onsuccess = () => resolve(true)
      request.onerror = () => resolve(false)
      request.onblocked = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

export async function clearAllClientStorage() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (dbPromise) {
      const db = await dbPromise.catch(() => null)
      if (db && typeof db.close === 'function') {
        db.close()
      }
    }
  } catch {
    // no-op
  }
  dbPromise = null

  try {
    localStorage.clear()
    sessionStorage.clear()
  } catch {
    // no-op
  }

  const databaseNames = []
  if (typeof indexedDB !== 'undefined') {
    if (typeof indexedDB.databases === 'function') {
      try {
        const databases = await indexedDB.databases()
        ;(databases || []).forEach((entry) => {
          const name = (entry?.name || '').toString().trim()
          if (name) {
            databaseNames.push(name)
          }
        })
      } catch {
        // no-op
      }
    }

    if (!databaseNames.length) {
      databaseNames.push(DB_NAME)
    }

    const seen = {}
    for (const name of databaseNames) {
      const key = name.toLowerCase()
      if (seen[key]) continue
      seen[key] = true
      try {
        deleteIndexedDbByName(name)
      } catch {
        // no-op
      }
    }
  }
}
