import { watch } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useResourceStatusStore } from 'src/stores/resourceStatus'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { onRowsUpserted } from 'src/services/IndexedDbCacheService'
import {
  getResourceRowsCached,
  setResourceMetaCached,
  upsertResourceRowsCached
} from 'src/services/ResourceIoService'

export function createSync(state, relations) {
  const {
    ensureResourceState,
    rows,
    replaceRows,
    headers,
    setRows,
    initResource
  } = state
  const { _deriveAllRelations } = relations

  // A resource is read out of IndexedDB once per session; `force` re-reads.
  const _seeded = new Set()
  const _seedInFlight = new Map()
  const _ensured = new Set()

  function resetSeedState() {
    _seeded.clear()
    _seedInFlight.clear()
    _ensured.clear()
  }

  function _authorizedResource(resourceName) {
    return (authStore.resources || []).find((resource) => resource?.name === resourceName) || null
  }

  function requestIfNeeded(resourceName) {
    if (useResourceStatusStore().byResource[resourceName]?.initiated) return
    useResourceIoStore().queueResource(resourceName, Date.now(), 'first-read')
  }

  // First read of a resource: headers from login, rows from IndexedDB, and one queued `get` if never fetched.
  function ensureResource(resourceName) {
    if (!resourceName) return
    ensureResourceState(resourceName)
    if (_ensured.has(resourceName)) return
    const authorized = _authorizedResource(resourceName)
    if (!authorized) return
    _ensured.add(resourceName)
    // Deferred so a read inside a computed never writes state.
    Promise.resolve().then(async () => {
      if (!headers[resourceName]?.length) initResource(resourceName, authorized.headers || [])
      requestIfNeeded(resourceName)
      await seedResourceFromCache(resourceName).catch(() => {})
    })
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

  return {
    _seeded,
    _seedInFlight,
    resetSeedState,
    seedResourceFromCache,
    ensureResource,
    requestIfNeeded,
    beginCacheReset,
    endCacheReset,
    seedAuthorizedResources,
    updateRowsFromSync,
    cacheResourceRows,
    setResourceMetadata
  }
}
