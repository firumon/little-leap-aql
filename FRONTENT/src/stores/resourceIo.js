import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { useDataStore } from './data'
import { useResourceStatusStore } from './resourceStatus'
import {
  bulkRecords,
  clearAllStorage,
  compositeSave,
  createRecord,
  deleteDraft,
  executeAction,
  fetchResourceRecords,
  fetchResourceRecordsBatch,
  flushResourceSyncQueue,
  generateReport,
  getDraft,
  getResourceMetaCached,
  getResourceRowsCached,
  initializeDb,
  queueResourceSync,
  registerQueuedSyncHandler,
  runBatchRequests as runBatchRequestsFromService,
  saveDraft,
  setAuthorizedResources,
  setResourceMetaCached,
  syncResourcesBatch,
  updateRecord,
  upsertResourceRowsCached
} from 'src/services/ResourceIoService'
import { standardizeResponse } from 'src/services/_logger'

function normalizeResponse(response, fallbackData = null) {
  if (response && typeof response === 'object' && 'success' in response) {
    const resultPayload = response?.data?.result
    const reportArtifact = response?.data?.artifacts?.report
    let normalizedData = response.success
      ? (resultPayload ?? response.data ?? fallbackData)
      : null

    if (response.success && reportArtifact && typeof reportArtifact === 'object') {
      normalizedData = {
        ...(normalizedData && typeof normalizedData === 'object' ? normalizedData : {}),
        ...reportArtifact
      }
    }

    return {
      success: response.success === true,
      data: normalizedData,
      error: response.success ? null : (response.error || response.message || 'Request failed'),
      message: response.message || ''
    }
  }

  return {
    success: false,
    data: null,
    error: 'Invalid response',
    message: ''
  }
}

function normalizeResourceNames(resourceNames = []) {
  return Array.from(new Set((Array.isArray(resourceNames) ? resourceNames : [resourceNames])
    .map((entry) => (entry || '').toString().trim())
    .filter(Boolean)))
}

export const useResourceIoStore = defineStore('resourceIo', () => {
  function getAuthContext() {
    const auth = useAuthStore()
    return {
      authorizedResources: auth.authorizedResources || [],
      appConfig: auth.appConfigMap || {}
    }
  }

  /**
   * Merges a server resource payload into the data store.
   *
   * The payload is either a FULL snapshot or a PARTIAL one, and the two must be
   * applied differently:
   *
   *   `meta.hasDeltaFilter` — the read was cursor-scoped (`lastUpdatedAt`), so
   *                           it carries only rows changed since that cursor.
   *   `meta.directWrite`    — the rows the server just wrote, nothing else
   *                           (`buildDirectWriteResourcePayload` in GAS).
   *
   * Either marker means the payload is a subset, so it must UPSERT by code.
   * Replacing wholesale on a delta deletes every row the server did not happen
   * to return — which is what emptied every list after a write, until a
   * navigation triggered a full refetch and quietly restored them.
   *
   * Only an unmarked payload (a full fetch) may replace.
   */
  function hydrateResourcePayload(resourcePayload = {}) {
    const dataStore = useDataStore()
    Object.entries(resourcePayload || {}).forEach(([resourceName, resourceData]) => {
      if (Array.isArray(resourceData?.headers) && resourceData.headers.length) {
        dataStore.initResource(resourceName, resourceData.headers)
      }
      if (!Array.isArray(resourceData?.rows)) return

      const meta = resourceData.meta || {}
      if (meta.hasDeltaFilter || meta.directWrite) {
        dataStore.setRows(resourceName, resourceData.rows)
      } else {
        dataStore.replaceRows(resourceName, resourceData.rows)
      }
    })
  }

  async function fetchResource(resourceName, options = {}) {
    if (!resourceName) {
      return { success: false, headers: [], rows: [], records: [] }
    }

    const dataStore = useDataStore()
    const resourceStatus = useResourceStatusStore()
    const { authorizedResources, appConfig } = getAuthContext()
    dataStore.ensureResourceState(resourceName)
    dataStore.loadingByResource[resourceName] = true

    try {
      const response = await fetchResourceRecords(resourceName, authorizedResources, appConfig, {
        ...options,
        resourceStatus
      })
      const payload = response?.data || {}
      const responseHeaders = Array.isArray(payload.headers) ? payload.headers : []
      const responseRows = Array.isArray(payload.rows) ? payload.rows : []

      if (responseHeaders.length) {
        dataStore.initResource(resourceName, responseHeaders)
      }
      if (Array.isArray(payload.rows)) {
        dataStore.replaceRows(resourceName, responseRows)
      }
      return {
        ...response,
        headers: responseHeaders,
        rows: responseRows,
        records: Array.isArray(payload.rows)
          ? dataStore.getRecords(resourceName)
          : (payload.records || []),
        meta: payload.meta || {}
      }
    } finally {
      dataStore.loadingByResource[resourceName] = false
    }
  }

  async function syncResource(resourceName, options = {}) {
    if (!resourceName) {
      return { success: false, headers: [], rows: [], records: [] }
    }

    const dataStore = useDataStore()
    dataStore.backgroundSyncingByResource[resourceName] = true
    try {
      return await fetchResource(resourceName, options)
    } finally {
      dataStore.backgroundSyncingByResource[resourceName] = false
    }
  }

  async function fetchResources(resourceNames = [], payload = {}) {
    const resources = normalizeResourceNames(resourceNames)
    if (!resources.length) {
      return normalizeResponse({ success: true, data: { result: { resources: [] } } })
    }

    const { authorizedResources, appConfig } = getAuthContext()
    const resourceStatus = useResourceStatusStore()
    const response = await fetchResourceRecordsBatch(resources, authorizedResources, appConfig, {
      showLoading: payload.showLoading === true,
      showError: payload.showError === true,
      forceSync: payload.forceSync === true,
      resourceStatus
    })

    const resourcePayload = response.data?.resources || {}
    hydrateResourcePayload(resourcePayload)

    return {
      success: response.success === true,
      data: {
        resources: resourcePayload,
        result: {
          resources: resourcePayload,
          synced: response.data?.synced || [],
          skipped: response.data?.skipped || []
        }
      },
      error: response.success ? null : (response.error || response.message || 'Failed to fetch resources'),
      message: response.message || ''
    }
  }

  async function syncResources(resourceNames = [], options = {}) {
    const resources = normalizeResourceNames(resourceNames)
    if (!resources.length) {
      return normalizeResponse(standardizeResponse(true, {
        resources: [],
        recordsByResource: {},
        lastSyncAt: Date.now()
      }), {})
    }

    const { authorizedResources, appConfig } = getAuthContext()
    const resourceStatus = useResourceStatusStore()
    const response = await syncResourcesBatch(resources, authorizedResources, appConfig, {
      showLoading: options.showLoading === true,
      showError: options.showError === true,
      forceSync: options.forceSync === true,
      resourceStatus
    })

    if (!response.success) {
      return normalizeResponse(standardizeResponse(false, {
        resources,
        recordsByResource: {},
        lastSyncAt: Date.now()
      }, response.error || response.message || 'Resource sync failed'), {})
    }

    return normalizeResponse(standardizeResponse(true, {
      resources,
      recordsByResource: {},
      summary: response.data || {},
      lastSyncAt: Date.now()
    }), {})
  }

  function queueResource(resourceName, dueAt, reason = '') {
    queueResourceSync(resourceName, dueAt, reason)
    return { success: true, data: { resourceName, dueAt, reason }, error: null }
  }

  async function flushQueue(options = {}) {
    const response = await flushResourceSyncQueue(options)
    return normalizeResponse(response, {})
  }

  async function executeResourceAction(resourceName, code, actionConfig, fields = {}) {
    const response = await executeAction(resourceName, code, actionConfig, fields)
    return normalizeResponse(response)
  }

  async function createResourceRecord(resourceName, record) {
    const response = await createRecord(resourceName, record)
    return normalizeResponse(response)
  }

  async function updateResourceRecord(resourceName, code, record) {
    const response = await updateRecord(resourceName, code, record)
    return normalizeResponse(response)
  }

  async function saveComposite(payload) {
    const response = await compositeSave(payload)
    return normalizeResponse(response)
  }

  async function uploadBulkRecords(resourceName, records = []) {
    const response = await bulkRecords(resourceName, records)
    return normalizeResponse(response)
  }

  async function generateReportFile(payload = {}) {
    const response = await generateReport(payload)
    return normalizeResponse(response)
  }

  async function runBatchRequests(requests = []) {
    const response = await runBatchRequestsFromService(requests)
    hydrateResourcePayload(response.resources || {})
    return response
  }

  async function initializeClientCache(resources = [], resetCursors = false) {
    await initializeDb()
    return setAuthorizedResources(resources, resetCursors)
  }

  async function clearClientCache() {
    return clearAllStorage()
  }

  registerQueuedSyncHandler((resourceNames, options = {}) => syncResources(resourceNames, options))

  return {
    fetchResource,
    syncResource,
    fetchResources,
    syncResources,
    queueResource,
    flushQueue,
    executeResourceAction,
    createResourceRecord,
    updateResourceRecord,
    saveComposite,
    uploadBulkRecords,
    generateReportFile,
    runBatchRequests,
    initializeClientCache,
    clearClientCache,
    getResourceMeta: getResourceMetaCached,
    setResourceMeta: setResourceMetaCached,
    getResourceRows: getResourceRowsCached,
    upsertResourceRows: upsertResourceRowsCached,
    getDraft,
    saveDraft,
    deleteDraft
  }
})
