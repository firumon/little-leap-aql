import { ref, computed, watch, unref } from 'vue'
import { useQuasar } from 'quasar'
import { fetchResourceRecords } from 'src/services/resourceRecords'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'

/**
 * Manages data loading, search, and filtering for a resource.
 * Used by IndexPage (all records) and View/Edit pages (single record by code).
 */
export function useResourceData(resourceNameRef) {
  const $q = useQuasar()
  const authStore = useAuthStore()
  const dataStore = useDataStore()

  const loading = ref(false)
  const backgroundSyncing = ref(false)
  const searchTerm = ref('')
  const showInactive = ref(false)
  const loadRequestId = ref(0)

  const resolvedResourceName = computed(() => {
    return typeof resourceNameRef === 'function'
      ? resourceNameRef()
      : unref(resourceNameRef)
  })

  // Read items directly from Pinia store, meaning it reacts to any IDB callback automatically
  const items = computed(() => dataStore.getRecords(resolvedResourceName.value))

  // Exposing headers as computed so templates can read them if needed
  const lastHeaders = computed(() => dataStore.headers[resolvedResourceName.value] || [])

  // Re-read from server when global sync completes and we have no data yet
  watch(() => authStore.isGlobalSyncing, (syncing, wasSyncing) => {
    if (wasSyncing && !syncing && items.value.length === 0) {
      reload()
    }
  })

  const filteredItems = computed(() => {
    let list = items.value
    if (!showInactive.value) {
      list = list.filter((row) => (row.Status || 'Active') === 'Active')
    }
    const keyword = (searchTerm.value || '').toString().trim().toLowerCase()
    if (!keyword) return list
    return list.filter((row) => {
      const aggregate = Object.values(row || {})
        .map((v) => (v ?? '').toString().toLowerCase())
        .join(' ')
      return aggregate.includes(keyword)
    })
  })

  function notify(type, message) {
    $q.notify({ type, message, timeout: 2200 })
  }

  async function runBackgroundSync(resourceName, requestId) {
    if (!resourceName || backgroundSyncing.value) return
    backgroundSyncing.value = true
    try {
      await fetchResourceRecords(resourceName, {
        includeInactive: true,
        syncWhenCacheExists: true
      })
      // The fetch updates IDB, which fires onRowsUpserted listener,
      // which sets rows in dataStore, which triggers items computed.
      // So no manual assignment here.
    } finally {
      if (requestId === loadRequestId.value) backgroundSyncing.value = false
    }
  }

  async function reload(forceSync = false) {
    const resourceName = resolvedResourceName.value
    if (!resourceName) return

    const requestId = ++loadRequestId.value
    if (!items.value.length) loading.value = true

    try {
      const response = await fetchResourceRecords(resourceName, {
        includeInactive: true,
        forceSync
      })

      // Again, data store is populated automatically via IDB callback.
      // fetchResourceRecords writes to IDB and that updates the store.

      if (requestId !== loadRequestId.value) return

      if (!forceSync && response?.meta?.source === 'cache') {
        runBackgroundSync(resourceName, requestId)
      }
    } finally {
      if (requestId === loadRequestId.value) loading.value = false
    }
  }

  function getRecordByCode(code) {
    if (!code) return null
    return items.value.find((row) => row.Code === code) || null
  }

  /**
   * Optimistically update a record in the local items array and IDB.
   * Call this after a successful save to reflect changes immediately
   * without waiting for a full server round-trip.
   */
  async function updateLocalRecord(updatedRecord) {
    if (!updatedRecord?.Code) return

    const resourceName = resolvedResourceName.value
    const headers = lastHeaders.value

    if (!resourceName || !headers.length) return

    // Find the record in the array and merge
    const existing = items.value.find(r => r.Code === updatedRecord.Code) || {}
    const merged = { ...existing, ...updatedRecord }

    // Map object back to a row array
    const row = headers.map(h => merged[h] ?? '')

    // Update the reactive Pinia store immediately
    dataStore.setRows(resourceName, [row])

    // Also persist to IDB
    try {
      const { upsertResourceRows } = await import('src/utils/db')
      await upsertResourceRows(resourceName, headers, [row])
    } catch (_) { /* non-critical */ }
  }

  function reset() {
    searchTerm.value = ''
    showInactive.value = false
    loading.value = false
    backgroundSyncing.value = false
    loadRequestId.value++
  }

  return {
    items,
    lastHeaders,
    filteredItems,
    loading,
    backgroundSyncing,
    searchTerm,
    showInactive,
    reload,
    reset,
    getRecordByCode,
    updateLocalRecord,
    notify
  }
}
