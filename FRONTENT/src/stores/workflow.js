import { defineStore } from 'pinia'
import { executeGasApi } from 'src/services/GasApiService'
import {
  bulkRecords,
  compositeSave,
  executeAction
} from 'src/services/ResourceRecordsService'
import { generateReport } from 'src/services/ReportService'

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
    const response = await executeGasApi('batch', { requests })
    const normalized = normalizeResponse(response, { responses: [] })
    if (!normalized.success) {
      return normalized
    }

    return {
      ...normalized,
      data: Array.isArray(normalized.data?.responses) ? normalized.data.responses : []
    }
  }

  return {
    executeResourceAction,
    saveComposite,
    uploadBulkRecords,
    generateReportFile,
    runBatchRequests
  }
})
