import { defineStore } from 'pinia'
import { executeGasApi } from 'src/services/GasApiService'
import {
  bulkRecords,
  compositeSave,
  createRecord,
  executeAction,
  fetchResources as fetchResourcesFromService,
  updateRecord
} from 'src/services/ResourceRecordsService'
import { generateReport } from 'src/services/ReportService'
import { useDataStore } from './data'
import { getResourceMeta } from 'src/services/IndexedDbService'
import { normalizeCursorValue } from 'src/services/ResourceMapperService'

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

export const useWorkflowStore = defineStore('workflow', () => {
  async function executeResourceAction(resourceName, code, actionConfig, fields = {}) {
    const response = await executeAction(resourceName, code, actionConfig, fields)
    return normalizeResponse(response)
  }

  async function fetchResources(resourceNames = [], payload = {}) {
    const resources = Array.isArray(resourceNames) ? resourceNames.filter(Boolean) : [resourceNames].filter(Boolean)
    if (!resources.length) {
      return normalizeResponse({ success: true, data: { result: { resources: [] } } })
    }

    const response = await fetchResourcesFromService(resources, {
      includeInactive: payload.includeInactive !== false,
      forceSync: payload.forceSync === true,
      syncWhenCacheExists: payload.syncWhenCacheExists === true,
      showLoading: payload.showLoading === true,
      showError: payload.showError === true
    })

    const dataStore = useDataStore()
    const resourcePayload = response.resources || response.data?.resources || {}
    Object.entries(resourcePayload).forEach(([resourceName, resourceData]) => {
      if (Array.isArray(resourceData?.headers) && resourceData.headers.length) {
        dataStore.initResource(resourceName, resourceData.headers)
      }
      if (Array.isArray(resourceData?.rows)) {
        dataStore.replaceRows(resourceName, resourceData.rows)
      }
    })

    return {
      success: response.success === true,
      data: {
        resources: resourcePayload,
        result: {
          resources: resourcePayload,
          synced: response.synced || response.data?.synced || []
        }
      },
      error: response.success ? null : (response.error || response.message || 'Failed to fetch resources'),
      message: response.message || ''
    }
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

  function collectBatchCursorResources(requests = []) {
    const names = []
    requests.forEach((request) => {
      const resourceSelector = Array.isArray(request?.resource) ? request.resource : [request?.resource]
      resourceSelector.filter(Boolean).forEach((name) => names.push(name))
      const payloadCursorResources = request?.payload?.lastUpdatedAtResources
      if (Array.isArray(payloadCursorResources)) {
        payloadCursorResources.filter(Boolean).forEach((name) => names.push(name))
      }
    })
    return Array.from(new Set(names))
  }

  function mergeRowsByCode(existingRows = [], deltaRows = []) {
    if (!Array.isArray(deltaRows) || !deltaRows.length) return existingRows || []
    const merged = new Map((Array.isArray(existingRows) ? existingRows : []).map((row) => [row?.[0], row]))
    deltaRows.forEach((row) => {
      if (Array.isArray(row) && row.length) merged.set(row[0], row)
    })
    return Array.from(merged.values())
  }

  async function runBatchRequests(requests = []) {
    const resourceNames = collectBatchCursorResources(requests)
    const lastUpdatedAtByResource = {}
    for (const resourceName of resourceNames) {
      try {
        const meta = await getResourceMeta(resourceName)
        lastUpdatedAtByResource[resourceName] = normalizeCursorValue(meta?.lastSyncAt) || null
      } catch {
        lastUpdatedAtByResource[resourceName] = null
      }
    }
    const scopedRequests = requests.map((request) => {
      const payload = { ...(request.payload || {}) }
      delete payload.lastUpdatedAtResources
      return {
        ...request,
        payload: { ...payload, lastUpdatedAtByResource }
      }
    })
    const response = await executeGasApi('batch', { requests: scopedRequests })
    const responses = Array.isArray(response?.data?.result?.responses)
      ? response.data.result.responses
      : []
    responses.forEach((entry, index) => {
      const createdCode = entry?.data?.result?.parentCode || entry?.data?.result?.code || entry?.data?.code || ''
      if (!createdCode) return
      responses.slice(index + 1).forEach((laterEntry) => {
        const resultResources = laterEntry?.data?.resources || {}
        Object.values(resultResources).forEach((resourceData) => {
          if (!Array.isArray(resourceData?.headers) || !Array.isArray(resourceData?.rows)) return
          const referenceIndexes = ['ReferenceCode', 'ParentCode'].map(field => resourceData.headers.indexOf(field)).filter(fieldIndex => fieldIndex >= 0)
          if (!referenceIndexes.length) return
          resourceData.rows.forEach((row) => {
            referenceIndexes.forEach((fieldIndex) => { if (row[fieldIndex] === '__PENDING__') row[fieldIndex] = createdCode })
          })
        })
      })
    })
    const dataStore = useDataStore()
    const resourcePayload = response?.data?.resources && typeof response.data.resources === 'object'
      ? response.data.resources
      : {}
    Object.entries(resourcePayload).forEach(([resourceName, resourceData]) => {
      if (Array.isArray(resourceData?.headers) && resourceData.headers.length) {
        dataStore.initResource(resourceName, resourceData.headers)
      }
      if (Array.isArray(resourceData?.rows)) {
        dataStore.replaceRows(resourceName, mergeRowsByCode(dataStore.getRows(resourceName), resourceData.rows))
      }
    })
    return {
      success: response?.success === true,
      data: responses,
      resources: resourcePayload,
      error: response?.success === true ? null : (response?.error || response?.message || 'Batch request failed'),
      message: response?.message || ''
    }
  }

  return {
    executeResourceAction,
    fetchResources,
    createResourceRecord,
    updateResourceRecord,
    saveComposite,
    uploadBulkRecords,
    generateReportFile,
    runBatchRequests
  }
})
