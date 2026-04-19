import { defineStore } from 'pinia'
import { executeGasApi } from 'src/services/GasApiService'
import {
  bulkMasterRecords,
  compositeSave,
  executeAction
} from 'src/services/ResourceRecordsService'
import { generateReport } from 'src/services/ReportService'

function normalizeResponse(response, fallbackData = null) {
  if (response && typeof response === 'object' && 'success' in response) {
    return {
      success: response.success === true,
      data: response.success ? (response.data ?? fallbackData) : null,
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
    const response = await bulkMasterRecords(resourceName, records)
    return normalizeResponse(response)
  }

  async function generateReportFile(payload = {}) {
    const response = await generateReport(payload)
    return normalizeResponse(response)
  }

  async function runBatchRequests(requests = []) {
    const response = await executeGasApi('batch', { requests })
    return normalizeResponse(response, [])
  }

  async function submitStockMovementsBatch(movementRecords = []) {
    const response = await executeGasApi('batch', {
      requests: [
        {
          action: 'create',
          scope: 'operation',
          resource: 'StockMovements',
          records: movementRecords
        }
      ]
    })

    return normalizeResponse(response, [])
  }

  return {
    executeResourceAction,
    saveComposite,
    uploadBulkRecords,
    generateReportFile,
    runBatchRequests,
    submitStockMovementsBatch
  }
})

