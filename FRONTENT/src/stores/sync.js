import { defineStore } from 'pinia'
import {
  flushResourceSyncQueue,
  queueResourceSync,
  syncAllResources
} from 'src/services/ResourceRecordsService'

function normalizeResponse(response, fallbackData = null) {
  if (response && typeof response === 'object' && 'success' in response) {
    return {
      success: response.success === true,
      data: response.success ? (response.data ?? fallbackData) : null,
      error: response.success ? null : (response.error || response.message || 'Sync failed'),
      message: response.message || ''
    }
  }

  return {
    success: false,
    data: null,
    error: 'Invalid sync response',
    message: ''
  }
}

export const useSyncStore = defineStore('sync', () => {
  function queueResource(resourceName, dueAt, reason = '') {
    queueResourceSync(resourceName, dueAt, reason)
    return { success: true, data: { resourceName, dueAt, reason }, error: null }
  }

  async function flushQueue(forceAll = false, options = {}) {
    const response = await flushResourceSyncQueue(forceAll, options)
    return normalizeResponse(response, {})
  }

  async function syncAll() {
    const response = await syncAllResources()
    return normalizeResponse(response, {})
  }

  return {
    queueResource,
    flushQueue,
    syncAll
  }
})

