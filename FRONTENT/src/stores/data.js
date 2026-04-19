import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'
import { useAuthStore } from './auth'
import { onRowsUpserted, getResourceRows } from 'src/services/IndexedDbService'
import { fetchResourceRecords } from 'src/services/ResourceRecordsService'
import { rowsUpsert, metaSet } from 'src/services/IndexedDbCacheService'

function rowsToObjects(headers = [], rows = []) {
  return rows.map((row) => {
    const obj = {}
    headers.forEach((key, index) => {
      obj[key] = row[index] ?? ''
    })
    return obj
  })
}

export const useDataStore = defineStore('data', () => {
  const headers = reactive({})
  const rows = reactive({})
  const loadingByResource = reactive({})
  const backgroundSyncingByResource = reactive({})

  function ensureResourceState(resourceName) {
    if (!resourceName) return
    if (!headers[resourceName]) {
      headers[resourceName] = []
    }
    if (!rows[resourceName]) {
      rows[resourceName] = []
    }
  }

  function initResource(resourceName, headerArray = []) {
    ensureResourceState(resourceName)
    if (Array.isArray(headerArray) && headerArray.length) {
      headers[resourceName] = headerArray
    }
  }

  function setRows(resourceName, newRows) {
    ensureResourceState(resourceName)
    if (!newRows || newRows.length === 0) return

    const map = new Map((rows[resourceName] || []).map((row) => [row[0], row]))
    for (const row of newRows) {
      if (row && row.length > 0) {
        map.set(row[0], row)
      }
    }
    rows[resourceName] = Array.from(map.values())
  }

  function replaceRows(resourceName, newRows) {
    ensureResourceState(resourceName)
    rows[resourceName] = newRows || []
  }

  function getRows(resourceName) {
    ensureResourceState(resourceName)
    return rows[resourceName] || []
  }

  function getRecords(resourceName) {
    return rowsToObjects(headers[resourceName] || [], getRows(resourceName))
  }

  async function seedResourceFromCache(resourceName, options = {}) {
    if (!resourceName) return []
    ensureResourceState(resourceName)
    const statusIndex = (headers[resourceName] || []).indexOf('Status')
    const idbRows = await getResourceRows(resourceName, {
      includeInactive: options.includeInactive !== false,
      statusIndex
    })
    if (idbRows.length) {
      replaceRows(resourceName, idbRows)
    }
    return idbRows
  }

  async function loadResource(resourceName, options = {}) {
    if (!resourceName) {
      return { success: false, headers: [], rows: [], records: [] }
    }

    ensureResourceState(resourceName)
    loadingByResource[resourceName] = true
    try {
      const response = await fetchResourceRecords(resourceName, options)
      if (Array.isArray(response?.headers) && response.headers.length) {
        headers[resourceName] = response.headers
      }
      if (Array.isArray(response?.rows)) {
        replaceRows(resourceName, response.rows)
      }
      return {
        ...response,
        records: Array.isArray(response?.rows)
          ? rowsToObjects(headers[resourceName] || response.headers || [], response.rows)
          : (response?.records || [])
      }
    } finally {
      loadingByResource[resourceName] = false
    }
  }

  async function syncResource(resourceName, options = {}) {
    if (!resourceName) {
      return { success: false, headers: [], rows: [], records: [] }
    }

    backgroundSyncingByResource[resourceName] = true
    try {
      return await loadResource(resourceName, {
        includeInactive: true,
        syncWhenCacheExists: true,
        ...options
      })
    } finally {
      backgroundSyncingByResource[resourceName] = false
    }
  }

  onRowsUpserted((resource, upsertedRows) => {
    setRows(resource, upsertedRows)
  })

  async function seedAuthorizedResources(resourcesList = []) {
    for (const resource of resourcesList) {
      if (!resource?.name) continue
      initResource(resource.name, resource.headers || [])
      try {
        await seedResourceFromCache(resource.name, { includeInactive: true })
      } catch {
        // non-critical: sync will repopulate the store later
      }
    }
  }

  const authStore = useAuthStore()

  watch(
    () => authStore.resources,
    (resourcesList, previousResources) => {
      if (!resourcesList?.length) return
      if (previousResources?.length) {
        Object.keys(rows).forEach((resourceName) => replaceRows(resourceName, []))
      }
      seedAuthorizedResources(resourcesList)
    },
    { immediate: true }
  )

  // NEW: Store action to update rows from IDB sync (standardized response format)
  async function updateRowsFromSync(resourceName, headers, rows) {
    ensureResourceState(resourceName)
    if (Array.isArray(rows) && rows.length) {
      replaceRows(resourceName, rows)
      if (Array.isArray(headers) && headers.length) {
        headers[resourceName] = headers
      }
      return { success: true, updated: rows.length }
    }
    return { success: true, updated: 0 }
  }

  // NEW: Cache rows via new service (wrapping IDB persistence)
  async function cacheResourceRows(resourceName, headerArray, newRows) {
    try {
      const response = await rowsUpsert(resourceName, headerArray, newRows)
      if (response.success) {
        setRows(resourceName, newRows)
        return { success: true, affected: response.data?.affected }
      }
      return response
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // NEW: Set resource metadata via new service
  async function setResourceMetadata(resourceName, meta) {
    try {
      const response = await metaSet(resourceName, meta)
      return response
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  return {
    headers,
    rows,
    loadingByResource,
    backgroundSyncingByResource,
    initResource,
    setRows,
    replaceRows,
    getRows,
    getRecords,
    seedResourceFromCache,
    seedAuthorizedResources,
    loadResource,
    syncResource,
    updateRowsFromSync,
    cacheResourceRows,
    setResourceMetadata
  }
})
