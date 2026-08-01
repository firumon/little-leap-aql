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

const DEFAULT_TARGET_HEADER = 'Code'

// `APP.Resources.Relations` accepts a shorthand string ("SKUs") or an extended
// object ({ resource, targetHeader?, labelHeader? }). Both collapse to the same
// internal shape here.
function _normalizeRelationSpec(spec) {
  if (typeof spec === 'string') {
    const resource = spec.trim()
    return resource ? { resource, targetHeader: DEFAULT_TARGET_HEADER, labelHeader: '' } : null
  }
  if (spec && typeof spec === 'object' && !Array.isArray(spec)) {
    const resource = (spec.resource || '').toString().trim()
    if (!resource) return null
    return {
      resource,
      targetHeader: (spec.targetHeader || '').toString().trim() || DEFAULT_TARGET_HEADER,
      labelHeader: (spec.labelHeader || '').toString().trim()
    }
  }
  return null
}

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

  // Step 1 (normalization): consolidate baseline heuristics and explicit
  // `APP.Resources.Relations` metadata into one `{ [header]: { resource,
  // targetHeader, labelHeader } }` map per resource. Explicit entries win.
  function _buildEffectiveRelations(resource, resourceNames) {
    const effective = {}
    const resourceHeaders = resource.headers || []

    const parentStr = (resource.parentResource || '').toString().trim()
    if (parentStr && resourceNames.includes(parentStr)) {
      const expectedHdr = resourceHeaders.find(h => h.endsWith('Code') && h !== 'Code' && pluralize(h.slice(0, -4)) === parentStr)
        || singularize(parentStr) + 'Code'
      effective[expectedHdr] = { resource: parentStr, targetHeader: DEFAULT_TARGET_HEADER, labelHeader: '' }
    }

    for (const header of resourceHeaders) {
      if (header === 'Code' || !header.endsWith('Code')) continue
      const plural = pluralize(header.slice(0, -4))
      if (resourceNames.includes(plural)) {
        effective[header] = { resource: plural, targetHeader: DEFAULT_TARGET_HEADER, labelHeader: '' }
      } else if (plural === 'Parents') {
        effective[header] = { resource: resource.name, targetHeader: DEFAULT_TARGET_HEADER, labelHeader: '' }
      }
    }

    const explicit = resource.relations && typeof resource.relations === 'object' ? resource.relations : {}
    for (const [header, spec] of Object.entries(explicit)) {
      const normalized = _normalizeRelationSpec(spec)
      if (normalized && resourceNames.includes(normalized.resource)) {
        effective[header] = normalized
      }
    }

    return effective
  }

  function _deriveAllRelations(resources) {
    Object.keys(resourceRelations).forEach(k => delete resourceRelations[k])

    const resourceNames = resources.map(r => r.name)

    // Step 1 — normalization
    const effectiveRelations = {}
    resources.forEach(r => {
      effectiveRelations[r.name] = _buildEffectiveRelations(r, resourceNames)
    })

    // Step 2 — topology graph, derived exclusively from the normalized map
    const resourceParents = {}, resourceChildren = {}, linkRefs = {}, refs = {}
    resources.forEach(r => {
      const parents = []
      const seenParents = new Set()
      linkRefs[r.name] = {}
      refs[r.name] = {}

      for (const [header, rel] of Object.entries(effectiveRelations[r.name])) {
        linkRefs[r.name][header] = rel.resource
        refs[r.name][header] = { header, ...rel }

        if (!seenParents.has(rel.resource)) {
          seenParents.add(rel.resource)
          parents.push({
            resourceName: rel.resource,
            codeField: header,
            targetHeader: rel.targetHeader,
            labelHeader: rel.labelHeader,
            singular: singularize(rel.resource),
            scope: r.scope
          })
        }

        if (!Object.hasOwn(resourceChildren, rel.resource)) resourceChildren[rel.resource] = []
        if (!resourceChildren[rel.resource].some(c => c.name === r.name)) {
          resourceChildren[rel.resource].push({
            name: r.name,
            codeField: header,
            targetHeader: rel.targetHeader,
            labelHeader: rel.labelHeader,
            singular: singularize(r.name),
            scope: r.scope
          })
        }
      }

      resourceParents[r.name] = parents
    })

    resources.forEach(res => {
      resourceRelations[res.name] = {
        parents: resourceParents[res.name] || [],
        children: resourceChildren[res.name] || [],
        linkRefs: linkRefs[res.name] || {},
        refs: refs[res.name] || {}
      }
    })
  }

  function getRecord(resourceName, code) {
    if (!resourceName || !code) return null
    return getRecords(resourceName).find(r => r.Code === code) || null
  }

  function getRelations(resourceName) {
    return resourceRelations[resourceName] || { parents: [], children: [], linkRefs: {}, refs: {} }
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
