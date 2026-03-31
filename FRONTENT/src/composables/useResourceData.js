import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { fetchMasterRecords } from 'src/services/masterRecords'

/**
 * Manages data loading, search, and filtering for a resource.
 * Used by IndexPage (all records) and View/Edit pages (single record by code).
 */
export function useResourceData(resourceNameRef) {
  const $q = useQuasar()

  const items = ref([])
  const lastHeaders = ref([])
  const loading = ref(false)
  const backgroundSyncing = ref(false)
  const searchTerm = ref('')
  const showInactive = ref(false)
  const loadRequestId = ref(0)

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
      const response = await fetchMasterRecords(resourceName, {
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
    lastHeaders.value = Array.isArray(response.headers) ? response.headers : []
    items.value = Array.isArray(response.records) ? response.records : []
  }

  async function reload(forceSync = false) {
    const resourceName = typeof resourceNameRef === 'function'
      ? resourceNameRef()
      : (resourceNameRef?.value || resourceNameRef)
    if (!resourceName) return

    const requestId = ++loadRequestId.value
    if (!items.value.length) loading.value = true

    try {
      const response = await fetchMasterRecords(resourceName, {
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
    notify
  }
}
