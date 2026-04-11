import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { fetchResourceRecords } from 'src/services/resourceRecords'
import { useAuthStore } from 'src/stores/auth'

/**
 * Manages data loading, search, and filtering for a resource.
 * Used by IndexPage (all records) and View/Edit pages (single record by code).
 */
export function useResourceData(resourceNameRef) {
  const $q = useQuasar()
  const authStore = useAuthStore()

  const items = ref([])
  const lastHeaders = ref([])
  const loading = ref(false)
  const backgroundSyncing = ref(false)
  const searchTerm = ref('')
  const showInactive = ref(false)
  const loadRequestId = ref(0)

  // Re-read from IDB when global sync completes and we have no data yet
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
      const response = await fetchResourceRecords(resourceName, {
        includeInactive: true,
        syncWhenCacheExists: true
      })
      if (requestId !== loadRequestId.value) return
      if (response.success || (response.records && response.records.length > 0)) {
        applyRecordsResponse(response)
      }
    } finally {
      backgroundSyncing.value = false
    }
  }

  function applyRecordsResponse(response) {
    const headers = Array.isArray(response.headers) ? response.headers : []
    const records = Array.isArray(response.records)
      ? response.records
      : rowsToObjects(Array.isArray(response.rows) ? response.rows : [], headers)

    lastHeaders.value = headers
    items.value = records
  }

  async function reload(forceSync = false) {
    const resourceName = typeof resourceNameRef === 'function'
      ? resourceNameRef()
      : (resourceNameRef?.value || resourceNameRef)
    if (!resourceName) return

    const requestId = ++loadRequestId.value
    if (!items.value.length) loading.value = true

    try {
      const response = await fetchResourceRecords(resourceName, {
        includeInactive: true,
        forceSync
      })
      if (requestId !== loadRequestId.value) return
      if (response.success || (response.records && response.records.length > 0)) {
        applyRecordsResponse(response)
      }
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
    const idx = items.value.findIndex((r) => r.Code === updatedRecord.Code)
    if (idx >= 0) {
      items.value[idx] = { ...items.value[idx], ...updatedRecord }
    } else {
      items.value.push({ ...updatedRecord })
    }
    // Also persist to IDB so subsequent navigations see it immediately
    try {
      if (lastHeaders.value.length) {
        const { upsertResourceRows } = await import('src/utils/db')
        const row = lastHeaders.value.map((h) => (items.value.find((r) => r.Code === updatedRecord.Code) || {})[h] ?? '')
        await upsertResourceRows(
          typeof resourceNameRef === 'function' ? resourceNameRef() : (resourceNameRef?.value || resourceNameRef),
          lastHeaders.value,
          [row]
        )
      }
    } catch (_) { /* non-critical */ }
  }

  function reset() {
    items.value = []
    lastHeaders.value = []
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
function rowsToObjects(rows, headers) {
  if (!Array.isArray(rows) || !rows.length) return []
  if (!Array.isArray(rows[0])) return rows.map((r) => ({ ...r }))
  return rows.map((row) => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] })
    return obj
  })
}
