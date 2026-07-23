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
import {mapRowsToObjects, pluralize, singularize} from 'src/utils/appHelpers'

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
  async function updateRowsFromSync(resourceName, headerList, rows) {
    ensureResourceState(resourceName)
    if (Array.isArray(rows) && rows.length) {
      replaceRows(resourceName, rows)
      if (Array.isArray(headerList) && headerList.length) {
        headers[resourceName] = headerList
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

  function _deriveAllRelations(resources) {
    Object.keys(resourceRelations).forEach(k => delete resourceRelations[k])

    const resourceNames = resources.map(r => r.name), resourceParents = {}, resourceChildren = {}, linkRefs = {}
    resources.forEach(r => {
      const headerToParent = {}
      const parentStr = (r.parentResource || '').toString().trim()
      if (parentStr && resourceNames.includes(parentStr)) {
        const expectedHdr = (r.headers || []).find(h => h.endsWith('Code') && h !== 'Code' && pluralize(h.slice(0, -4)) === parentStr) || singularize(parentStr) + 'Code'
        headerToParent[expectedHdr] = parentStr
      }
      ;(r.headers || []).forEach(h => {
        if (h === 'Code' || !h.endsWith('Code')) return
        const stem = h.slice(0, -4)
        const plural = pluralize(stem)
        if (resourceNames.includes(plural)) {
          headerToParent[h] = plural
        } else if (plural === 'Parents') {
          headerToParent[h] = r.name
        }
      })
      resourceParents[r.name] = Array.from(new Set(Object.values(headerToParent)))
      for (const [hdr, pName] of Object.entries(headerToParent)) {
        if (!Object.hasOwn(linkRefs, r.name)) linkRefs[r.name] = {}
        linkRefs[r.name][hdr] = pName
        const pRes = resources.find(res => res.name === pName)
        if (pRes) {
          if (!Object.hasOwn(resourceChildren, pRes.name)) resourceChildren[pRes.name] = []
          if (!resourceChildren[pRes.name].includes(r.name)) resourceChildren[pRes.name].push(r.name)
        }
      }
    })

    resources.forEach(res => {
      resourceRelations[res.name] = {
        parents: resourceParents[res.name]?.map(resourceName => ({ resourceName, codeField: singularize(resourceName) + 'Code', singular: singularize(resourceName), scope: res.scope })) || [],
        children: (resourceChildren[res.name] || []).map(name => ({ name, codeField: singularize(res.name) + 'Code', singular: singularize(name), scope: res.scope })),
        linkRefs: linkRefs[res.name] || {}
      }
    })
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
