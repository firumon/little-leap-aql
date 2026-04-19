/**
 * useResourceSync — Resource sync orchestration composable
 * Manages sync queue, TTL logic, and background sync
 * Extracted from ResourceRecordsService
 * Uses ResourceSyncQueueService internally
 */

import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import {
  queueMasterResourceSync,
  flushMasterSyncQueue,
  syncAllMasterResources
} from 'src/services/ResourceRecordsService'
import { createLogger } from 'src/services/_logger'

const logger = createLogger('useResourceSync')

export function useResourceSync() {
  const auth = useAuthStore()
  const dataStore = useDataStore()

  const isSyncing = ref(false)
  const lastSyncTime = ref(null)
  const syncErrors = ref([])

  // Get list of syncable resources from auth store
  const syncableResources = computed(() => {
    const resources = Array.isArray(auth.authorizedResources)
      ? auth.authorizedResources
      : auth.authorizedResources?.value || []

    return resources.filter((entry) => {
      const scope = (entry?.scope || '').toString().trim().toLowerCase()
      return ['master', 'operation', 'accounts'].includes(scope) &&
        entry?.permissions?.canRead !== false && entry?.name && entry?.functional !== true
    })
  })

  // Queue a single resource for sync
  function syncResource(resourceName, priority = 'normal') {
    try {
      const now = Date.now()
      const dueAt = priority === 'force' ? now : (priority === 'immediate' ? now : now + 5000)
      queueMasterResourceSync(resourceName, dueAt, priority)
      logger.debug('Queued sync', { resource: resourceName, priority })
      return { success: true }
    } catch (error) {
      logger.error('Queue sync failed', { resource: resourceName, error: error.message })
      return { success: false, error: error.message }
    }
  }

  // Flush all queued syncs
  async function flushQueue(forceAll = false) {
    try {
      logger.info('Flushing sync queue', { forceAll })
      isSyncing.value = true
      const result = await flushMasterSyncQueue(forceAll, {
        showError: true,
        showLoading: false
      })
      lastSyncTime.value = Date.now()
      if (!result.success) {
        syncErrors.value.push(result.error || 'Flush failed')
      }
      logger.info('Sync queue flushed', { success: result.success })
      return result
    } catch (error) {
      logger.error('Flush queue failed', { error: error.message })
      syncErrors.value.push(error.message)
      return { success: false, error: error.message }
    } finally {
      isSyncing.value = false
    }
  }

  // Sync all authorized resources (full global sync)
  async function syncAllResources(showLoading = true) {
    try {
      logger.info('Starting global resource sync')
      if (showLoading) {
        isSyncing.value = true
      }

      const result = await syncAllMasterResources()
      lastSyncTime.value = Date.now()

      if (!result.success) {
        syncErrors.value.push(result.error || 'Global sync failed')
        logger.error('Global sync failed', { error: result.error })
      } else {
        logger.info('Global sync completed', { resources: result.data?.meta?.resources?.length })
      }

      return result
    } catch (error) {
      logger.error('Global sync error', { error: error.message })
      syncErrors.value.push(error.message)
      return { success: false, error: error.message }
    } finally {
      if (showLoading) {
        isSyncing.value = false
      }
    }
  }

  // Sync specific resources
  async function syncResources(resourceNames = [], priority = 'normal') {
    try {
      logger.info('Syncing resources', { count: resourceNames?.length || 0 })
      isSyncing.value = true

      const now = Date.now()
      const names = Array.isArray(resourceNames) ? resourceNames : []

      for (const name of names) {
        queueMasterResourceSync(name, now, priority)
      }

      const result = await flushQueue(true)
      return result
    } catch (error) {
      logger.error('Sync resources failed', { error: error.message })
      syncErrors.value.push(error.message)
      return { success: false, error: error.message }
    } finally {
      isSyncing.value = false
    }
  }

  // Clear sync errors
  function clearErrors() {
    syncErrors.value = []
  }

  // Background sync on mount if global sync is happening
  onMounted(() => {
    // Watch for global sync completion
    const checkSync = setInterval(() => {
      if (!auth.isGlobalSyncing && lastSyncTime.value === null) {
        // Global sync not happening and we haven't synced yet, trigger it
        syncAllResources(false).catch(err => logger.warn('Onmount sync failed', { error: err.message }))
        clearInterval(checkSync)
      }
    }, 1000)

    return () => clearInterval(checkSync)
  })

  return {
    isSyncing,
    lastSyncTime,
    syncErrors,
    syncableResources,
    syncResource,
    flushQueue,
    syncAllResources,
    syncResources,
    clearErrors
  }
}

