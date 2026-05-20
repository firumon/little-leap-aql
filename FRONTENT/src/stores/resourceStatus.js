import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { getResourceMetaCached } from 'src/services/ResourceIoService'

const DEFAULT_RESOURCE_SYNC_TTL_SEC = 300

function normalizeResourceName(value) {
  return (value || '').toString().trim()
}

function normalizeScope(value) {
  return (value || '').toString().trim().toLowerCase()
}

function toStringArray(value) {
  return Array.isArray(value)
    ? value.map((item) => (item === null || item === undefined ? '' : String(item)))
    : []
}

function toTimestamp(value) {
  const parsed = Number(value)
  if (Number.isFinite(parsed) && parsed > 0) return parsed

  if (typeof value === 'string' && value.trim()) {
    const dateValue = Date.parse(value)
    return Number.isFinite(dateValue) && dateValue > 0 ? dateValue : null
  }

  return null
}

function clonePlainObject(value, fallback = null) {
  if (!value || typeof value !== 'object') return fallback
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return fallback
  }
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

function resolveResourceTtl(resource = {}, appConfig = {}) {
  const scope = normalizeScope(resource?.scope)
  const scopePascal = scope ? `${scope.charAt(0).toUpperCase()}${scope.slice(1)}` : ''
  const pluralScope = scope.endsWith('s') ? scope : `${scope}s`
  const pluralPascal = pluralScope ? `${pluralScope.charAt(0).toUpperCase()}${pluralScope.slice(1)}` : ''

  const fromConfig = getConfigNumber(appConfig, [
    `${scope}syncttl`,
    `${scope}SyncTTL`,
    `${scopePascal}SyncTTL`,
    `${pluralScope}syncttl`,
    `${pluralScope}SyncTTL`,
    `${pluralPascal}SyncTTL`
  ])

  if (fromConfig) return fromConfig

  return DEFAULT_RESOURCE_SYNC_TTL_SEC
}

function createStatus(resourceName) {
  return {
    resource: resourceName,
    initiated: false,
    hydrated: false,
    headers: [],
    syncing: false,
    inFlightCount: 0,
    lastSyncAt: null,
    lastFetchAt: null,
    ttl: DEFAULT_RESOURCE_SYNC_TTL_SEC,
    lastError: '',
    scope: '',
    parentResource: '',
    permissions: null,
    functional: false
  }
}

export const useResourceStatusStore = defineStore('resourceStatus', () => {
  const byResource = reactive({})
  const initialized = ref(false)

  function ensureResource(resourceName) {
    const name = normalizeResourceName(resourceName)
    if (!name) return null
    if (!byResource[name]) {
      byResource[name] = createStatus(name)
    }
    return byResource[name]
  }

  function patchResource(resourceName, patch = {}) {
    const status = ensureResource(resourceName)
    if (!status) return null
    Object.assign(status, patch)
    status.syncing = status.inFlightCount > 0
    return status
  }

  function applyAuthorizedResource(resource = {}, appConfig = {}) {
    const name = normalizeResourceName(resource?.name)
    if (!name) return null

    const headers = toStringArray(resource?.headers)
    return patchResource(name, {
      scope: normalizeScope(resource?.scope),
      parentResource: normalizeResourceName(resource?.parentResource),
      permissions: clonePlainObject(resource?.permissions, null),
      functional: resource?.functional === true,
      ttl: resolveResourceTtl(resource, appConfig),
      ...(headers.length ? { headers } : {})
    })
  }

  function applyResourceMeta(resourceName, meta = {}) {
    const name = normalizeResourceName(resourceName || meta?.resource)
    if (!name) return null

    const headers = toStringArray(meta?.headers)
    const lastSyncAt = toTimestamp(meta?.lastSyncAt)
    const lastFetchAt = toTimestamp(meta?.lastFetchAt)
    const hydrated = meta?.hasHydratedOnce === true || !!lastSyncAt || !!lastFetchAt

    return patchResource(name, {
      ...(headers.length ? { headers } : {}),
      lastSyncAt,
      lastFetchAt,
      hydrated,
      initiated: hydrated || byResource[name]?.initiated === true
    })
  }

  async function initializeResources(resources = [], appConfig = {}) {
    const seen = new Set()
    const resourceList = Array.isArray(resources) ? resources : []

    for (const resource of resourceList) {
      const name = normalizeResourceName(resource?.name)
      if (!name) continue
      seen.add(name)
      applyAuthorizedResource(resource, appConfig)

      const response = await getResourceMetaCached(name)
      if (response?.success && response.data) {
        applyResourceMeta(name, response.data)
      }
    }

    Object.keys(byResource).forEach((resourceName) => {
      if (!seen.has(resourceName)) {
        delete byResource[resourceName]
      }
    })

    initialized.value = true
    return statusList.value
  }

  function markSyncStarted(resourceNames = []) {
    const names = Array.isArray(resourceNames) ? resourceNames : [resourceNames]
    names.map(normalizeResourceName).filter(Boolean).forEach((name) => {
      const current = ensureResource(name)
      patchResource(name, {
        initiated: true,
        inFlightCount: (current?.inFlightCount || 0) + 1,
        lastError: ''
      })
    })
  }

  function markSyncFinished(resourceNames = [], metaByResource = {}) {
    const names = Array.isArray(resourceNames) ? resourceNames : [resourceNames]
    names.map(normalizeResourceName).filter(Boolean).forEach((name) => {
      const current = ensureResource(name)
      const nextCount = Math.max(0, (current?.inFlightCount || 0) - 1)
      patchResource(name, {
        inFlightCount: nextCount,
        hydrated: true,
        initiated: true
      })
      if (metaByResource && metaByResource[name]) {
        applyResourceMeta(name, metaByResource[name])
      }
    })
  }

  function markSyncFailed(resourceNames = [], error = '') {
    const names = Array.isArray(resourceNames) ? resourceNames : [resourceNames]
    names.map(normalizeResourceName).filter(Boolean).forEach((name) => {
      const current = ensureResource(name)
      patchResource(name, {
        inFlightCount: Math.max(0, (current?.inFlightCount || 0) - 1),
        lastError: error ? String(error) : 'Sync failed'
      })
    })
  }

  function setHeaders(resourceName, headers = []) {
    const headerList = toStringArray(headers)
    return patchResource(resourceName, {
      headers: headerList
    })
  }

  function isSyncing(resourceName) {
    const name = normalizeResourceName(resourceName)
    return !!(name && byResource[name]?.syncing)
  }

  function filterAvailableResources(resourceNames = []) {
    const names = Array.isArray(resourceNames) ? resourceNames : [resourceNames]
    return names.map(normalizeResourceName).filter((name) => name && !isSyncing(name))
  }

  function reset() {
    Object.keys(byResource).forEach((resourceName) => {
      delete byResource[resourceName]
    })
    initialized.value = false
  }

  const statusList = computed(() => Object.keys(byResource).map((resourceName) => byResource[resourceName]))
  const syncing = computed(() => statusList.value.filter((entry) => entry.syncing).map((entry) => entry.resource))
  const initiated = computed(() => statusList.value.filter((entry) => entry.initiated).map((entry) => entry.resource))
  const hydrated = computed(() => statusList.value.filter((entry) => entry.hydrated).map((entry) => entry.resource))
  const lastSync = computed(() => Object.fromEntries(statusList.value.map((entry) => [entry.resource, entry.lastSyncAt])))
  const lastFetch = computed(() => Object.fromEntries(statusList.value.map((entry) => [entry.resource, entry.lastFetchAt])))
  const headers = computed(() => Object.fromEntries(statusList.value.map((entry) => [entry.resource, entry.headers])))
  const ttl = computed(() => Object.fromEntries(statusList.value.map((entry) => [entry.resource, entry.ttl])))

  return {
    byResource,
    initialized,
    statusList,
    syncing,
    initiated,
    hydrated,
    lastSync,
    lastFetch,
    headers,
    ttl,
    initializeResources,
    applyAuthorizedResource,
    applyResourceMeta,
    markSyncStarted,
    markSyncFinished,
    markSyncFailed,
    setHeaders,
    isSyncing,
    filterAvailableResources,
    reset
  }
})
