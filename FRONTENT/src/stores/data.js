import { defineStore } from 'pinia'
import { reactive, watch, computed, effectScope } from 'vue'
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
  const loadingByResource = reactive({})
  const backgroundSyncingByResource = reactive({})
  const resourceRelations = reactive({})

  // Raw Maps keyed by row Code; reactivity is carried by the version counter, so
  // never read `rows` directly from outside — use the accessors below.
  const rows = {}
  const rowsVersion = reactive({})

  function _touch(resourceName) {
    return rowsVersion[resourceName]
  }

  function _bump(resourceName) {
    rowsVersion[resourceName] = (rowsVersion[resourceName] || 0) + 1
  }

  function ensureResourceState(resourceName) {
    if (!resourceName) return
    if (!headers[resourceName]) {
      headers[resourceName] = []
    }
    if (!rows[resourceName]) {
      rows[resourceName] = new Map()
      rowsVersion[resourceName] = 0
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

    const map = rows[resourceName]
    for (const row of newRows) {
      if (row && row.length > 0) {
        map.set(row[0], row)
      }
    }
    _bump(resourceName)
  }

  function replaceRows(resourceName, newRows) {
    ensureResourceState(resourceName)
    const map = new Map()
    for (const row of newRows || []) {
      if (row && row.length > 0) map.set(row[0], row)
    }
    rows[resourceName] = map
    _bump(resourceName)
  }

  function getRows(resourceName) {
    if (!resourceName) return []
    ensureResourceState(resourceName)
    return _projection(resourceName).rowList.value
  }

  function getRowCount(resourceName) {
    if (!resourceName) return 0
    ensureResourceState(resourceName)
    _touch(resourceName)
    return rows[resourceName].size
  }

  function hasRows(resourceName) {
    return getRowCount(resourceName) > 0
  }

  // Per-resource projection, memoized so repeat reads never re-map the rows. The
  // scope is store-owned so a caller's component scope cannot stop these.
  const _projectionScope = effectScope(true)
  const _projections = new Map()

  function _projection(resourceName) {
    let entry = _projections.get(resourceName)
    if (entry) return entry
    entry = _projectionScope.run(() => {
      // Rows, records and the Code index in one pass over the Map.
      const projected = computed(() => {
        // The dependency: the Map is raw, so this is what triggers a rebuild.
        _touch(resourceName)
        const map = rows[resourceName]
        const hdrs = headers[resourceName] || []
        const width = hdrs.length
        const rowList = []
        const records = []
        const byCode = new Map()

        if (map) {
          for (const row of map.values()) {
            rowList.push(row)
            // A cached IndexedDB payload can hand back objects, not arrays.
            let record
            if (Array.isArray(row)) {
              record = {}
              for (let i = 0; i < width; i++) record[hdrs[i]] = row[i]
            } else {
              record = { ...row }
            }
            records.push(record)
            if (record.Code) byCode.set(record.Code, record)
          }
        }

        return { rowList, records, byCode }
      })

      return {
        rowList: computed(() => projected.value.rowList),
        records: computed(() => projected.value.records),
        byCode: computed(() => projected.value.byCode),
        // Per-(resource, header) indexes, built on first ask.
        indexes: new Map()
      }
    })
    _projections.set(resourceName, entry)
    return entry
  }

  function _index(resourceName, header) {
    const entry = _projection(resourceName)
    let index = entry.indexes.get(header)
    if (index) return index
    index = _projectionScope.run(() => computed(() => {
      const map = new Map()
      for (const record of entry.records.value) {
        const value = record[header]
        if (value === undefined || value === null || value === '') continue
        const bucket = map.get(value)
        if (bucket) bucket.push(record)
        else map.set(value, [record])
      }
      return map
    }))
    entry.indexes.set(header, index)
    return index
  }

  function getRecords(resourceName) {
    if (!resourceName) return []
    ensureResourceState(resourceName)
    return _projection(resourceName).records.value
  }

  /** All records whose `header` equals `value`. O(1) lookup, shared array. */
  function getRecordsBy(resourceName, header, value) {
    if (!resourceName || !header) return []
    if (value === undefined || value === null || value === '') return []
    ensureResourceState(resourceName)
    if (header === 'Code') {
      const match = _projection(resourceName).byCode.value.get(value)
      return match ? [match] : []
    }
    return _index(resourceName, header).value.get(value) || []
  }

  /** First record whose `header` equals `value`, or null. */
  function getRecordBy(resourceName, header, value) {
    return getRecordsBy(resourceName, header, value)[0] || null
  }

  // A resource is read out of IndexedDB once per session; `force` re-reads.
  const _seeded = new Set()
  const _seedInFlight = new Map()

  function resetSeedState() {
    _seeded.clear()
    _seedInFlight.clear()
  }

  async function seedResourceFromCache(resourceName, options = {}) {
    if (!resourceName) return []
    ensureResourceState(resourceName)

    if (!options.force) {
      // Raw rows, not `getRows()`, so the projection stays lazy.
      if (_seeded.has(resourceName)) return Array.from(rows[resourceName].values())
      // Concurrent callers join the read in flight instead of issuing their own.
      const inFlight = _seedInFlight.get(resourceName)
      if (inFlight) return inFlight
    }

    const read = (async () => {
      try {
        const response = await getResourceRowsCached(resourceName)
        const idbRows = Array.isArray(response?.data) ? response.data : []
        if (idbRows.length) {
          replaceRows(resourceName, idbRows)
        }
        _seeded.add(resourceName)
        return idbRows
      } finally {
        _seedInFlight.delete(resourceName)
      }
    })()

    _seedInFlight.set(resourceName, read)
    return read
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

  // Holds seeding until login's cache reset finishes. Default OPEN: a page
  // refresh never calls `initializeClientSession`, so only a login closes it.
  let _cacheReady = Promise.resolve()
  let _openCacheGate = null

  function beginCacheReset() {
    if (_openCacheGate) return
    _cacheReady = new Promise((resolve) => { _openCacheGate = resolve })
  }

  function endCacheReset() {
    if (!_openCacheGate) return
    _openCacheGate()
    _openCacheGate = null
  }

  async function seedAuthorizedResources(resourcesList = []) {
    await _cacheReady
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
        // Rows are gone, so the seeded marks must go too.
        resetSeedState()
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
    ensureResourceState(resourceName)
    return _projection(resourceName).byCode.value.get(code) || null
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
    getRowCount,
    hasRows,
    beginCacheReset,
    endCacheReset,
    resetSeedState,
    getRecords,
    getRecordsBy,
    getRecordBy,
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
