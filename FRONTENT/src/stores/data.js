import { defineStore } from 'pinia'
import { reactive, watch, computed } from 'vue'
import { useAuthStore } from './auth'
import { useResourceStatusStore } from './resourceStatus'
import { onRowsUpserted } from 'src/services/IndexedDbCacheService'
import {
  fetchResourceRecords,
  getResourceRowsCached,
  setResourceMetaCached,
  upsertResourceRowsCached
} from 'src/services/ResourceIoService'
import { mapRowsToObjects } from 'src/utils/appHelpers'

export const useDataStore = defineStore('data', () => {
  const headers = reactive({})
  const rows = reactive({})
  const loadingByResource = reactive({})
  const backgroundSyncingByResource = reactive({})
  const resourceRelations = reactive({})

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
    return mapRowsToObjects(getRows(resourceName), headers[resourceName] || [])
  }

  async function seedResourceFromCache(resourceName, options = {}) {
    if (!resourceName) return []
    ensureResourceState(resourceName)
    const response = await getResourceRowsCached(resourceName)
    const idbRows = Array.isArray(response?.data) ? response.data : []
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
      const resourceStatus = useResourceStatusStore()
      const response = await fetchResourceRecords(
        resourceName,
        authStore.authorizedResources || [],
        authStore.appConfigMap || {},
        {
          ...options,
          resourceStatus
        }
      )
      const payload = response?.data || {}
      const responseHeaders = Array.isArray(payload.headers) ? payload.headers : []
      const responseRows = Array.isArray(payload.rows) ? payload.rows : []

      if (responseHeaders.length) {
        headers[resourceName] = responseHeaders
      }
      if (Array.isArray(payload.rows)) {
        replaceRows(resourceName, responseRows)
      }
      return {
        ...response,
        headers: responseHeaders,
        rows: responseRows,
        records: Array.isArray(payload.rows)
          ? mapRowsToObjects(responseRows, headers[resourceName] || responseHeaders)
          : (payload.records || []),
        meta: payload.meta || {}
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
      return await loadResource(resourceName, options)
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
        await seedResourceFromCache(resource.name)
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
      _deriveAllRelations(resourcesList)
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
      const response = await upsertResourceRowsCached(resourceName, headerArray, newRows)
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
      const response = await setResourceMetaCached(resourceName, meta)
      return response
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  function _codeCandidates(header) {
    const name = (header || '').toString().trim()
    if (!name || name === 'Code' || !name.endsWith('Code')) return []
    const stem = name.slice(0, -4)
    return [stem, `${stem}s`, stem.endsWith('y') ? `${stem.slice(0, -1)}ies` : ''].filter(Boolean)
  }

  function _resolveCodeRef(header, resources) {
    if (!header || !header.endsWith('Code')) return null
    for (const c of _codeCandidates(header)) {
      const match = resources.find(r => r.name.toLowerCase() === c.toLowerCase())
      if (match) return match.name
    }
    return null
  }

  function _deriveAllRelations(resources) {
    // Clear existing relations
    Object.keys(resourceRelations).forEach(k => delete resourceRelations[k])

    for (const res of resources) {
      if (!res?.name) continue

      // --- Parents (from parentResource chain) ---
      const parentChain = []
      const visited = new Set()
      let current = res
      while (current.parentResource && !visited.has(current.parentResource)) {
        visited.add(current.parentResource)
        const parent = resources.find(r => r.name === current.parentResource)
        if (!parent) break
        const hdrs = headers[current.name] || current.headers || []
        const singular = parent.name.replace(/s$/, '')
        parentChain.push({
          resourceName: parent.name,
          codeField: hdrs.includes('ParentCode') ? 'ParentCode' : `${singular}Code`,
          singular
        })
        current = parent
      }

      // --- Children (resources whose parentResource === this resource) ---
      const children = resources
        .filter(r => r.parentResource === res.name)
        .map(r => {
          const childHeaders = headers[r.name] || r.headers || []
          const singular = res.name.replace(/s$/, '')
          return {
            name: r.name,
            codeField: childHeaders.includes('ParentCode') ? 'ParentCode' : `${singular}Code`,
            singular: r.name.replace(/s$/, '')
          }
        })

      // --- Link refs (XxxCode columns not already covered by parent/child) ---
      const usedCodeFields = new Set([
        'Code',
        ...parentChain.map(p => p.codeField),
        ...children.map(c => c.codeField)
      ])
      const linkRefs = {}
      const hdrs = headers[res.name] || res.headers || []
      for (const h of hdrs) {
        if (usedCodeFields.has(h)) continue
        const match = _resolveCodeRef(h, resources)
        if (match) linkRefs[h] = match
      }

      resourceRelations[res.name] = { parents: parentChain, children, linkRefs }
    }
  }

  function getRecord(resourceName, code) {
    if (!resourceName || !code) return null
    return getRecords(resourceName).find(r => r.Code === code) || null
  }

  function getRelations(resourceName) {
    return resourceRelations[resourceName] || { parents: [], children: [], linkRefs: {} }
  }

  return {
    headers,
    rows,
    loadingByResource,
    backgroundSyncingByResource,
    resourceRelations,
    ensureResourceState,
    initResource,
    setRows,
    replaceRows,
    getRows,
    getRecords,
    getRecord,
    getRelations,
    seedResourceFromCache,
    seedAuthorizedResources,
    loadResource,
    syncResource,
    updateRowsFromSync,
    cacheResourceRows,
    setResourceMetadata
  }
})
