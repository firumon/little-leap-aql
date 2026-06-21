/**
 * useResourceSync — Resource sync orchestration composable
 * Manages sync queue, TTL logic, and background sync
 * Uses resource IO store as the store boundary
 */

import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useResourceIoStore } from 'src/stores/resourceIo'

export function useResourceSync() {
  const auth = useAuthStore()
  const resourceIoStore = useResourceIoStore()

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
        entry?.name && entry?.functional !== true
    })
  })

  // Queue a single resource for sync
  function syncResource(resourceName) {
    try {
      const now = Date.now()
      resourceIoStore.queueResource(resourceName, now, 'manual')
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Flush all queued syncs
  async function flushQueue() {
    try {
      isSyncing.value = true
      const result = await resourceIoStore.flushQueue({
        showError: true,
        showLoading: false
      })
      lastSyncTime.value = Date.now()
      if (!result.success) {
        syncErrors.value.push(result.error || 'Flush failed')
      }
      return result
    } catch (error) {
      syncErrors.value.push(error.message)
      return { success: false, error: error.message }
    } finally {
      isSyncing.value = false
    }
  }

  // Sync all authorized resources (full global sync)
  async function syncAllResources(showLoading = true) {
    try {
      if (showLoading) {
        isSyncing.value = true
      }

      const result = await resourceIoStore.syncResources(
        syncableResources.value.map((resource) => resource.name).filter(Boolean),
        { showLoading }
      )
      lastSyncTime.value = Date.now()

      if (!result.success) {
        syncErrors.value.push(result.error || 'Global sync failed')
      }

      return result
    } catch (error) {
      syncErrors.value.push(error.message)
      return { success: false, error: error.message }
    } finally {
      if (showLoading) {
        isSyncing.value = false
      }
    }
  }

  // Sync specific resources
  async function syncResources(resourceNames = []) {
    try {
      isSyncing.value = true

      const now = Date.now()
      const names = Array.isArray(resourceNames) ? resourceNames : []

      for (const name of names) {
        resourceIoStore.queueResource(name, now, 'manual')
      }

      return await flushQueue()
    } catch (error) {
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
        syncAllResources(false).catch((err) => {
          syncErrors.value.push(err?.message || 'Background sync failed')
        })
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

