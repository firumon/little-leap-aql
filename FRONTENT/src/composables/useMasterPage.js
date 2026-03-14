import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { createMasterRecord, fetchMasterRecords, updateMasterRecord } from 'src/services/masterRecords'
import { useAuthStore } from 'src/stores/auth'
import { useProductsStore } from 'src/stores/products'

export function useMasterPage() {
  const route = useRoute()
  const router = useRouter()
  const $q = useQuasar()
  const auth = useAuthStore()
  const productsStore = useProductsStore()

  const lastHeaders = ref([])
  const searchTerm = ref('')
  const currentResource = ref(null)
  const items = ref([])
  const loading = ref(false)
  const saving = ref(false)
  const backgroundSyncing = ref(false)
  const showInactive = ref(false)
  const showDialog = ref(false)
  const showDetailDialog = ref(false)
  const isEdit = ref(false)
  const form = ref({})
  const detailRow = ref(null)
  const loadRequestId = ref(0)
  const activeResourceName = ref('')

  const statusOptions = [
    { label: 'Active', value: 'Active' },
    { label: 'Inactive', value: 'Inactive' }
  ]

  const config = computed(() => {
    const resources = Array.isArray(auth.resources) ? auth.resources : []
    const byMeta = route.meta?.requiredResource
      ? resources.find((entry) => entry?.name === route.meta.requiredResource)
      : null

    if (byMeta) return byMeta

    return resources.find((entry) => entry?.ui?.routePath === route.path) || null
  })

  const resolvedFields = computed(() => {
    const uiFields = config.value?.ui?.fields
    if (Array.isArray(uiFields) && uiFields.length) {
      return uiFields
    }

    return (lastHeaders.value || [])
      .filter((header) => !['Code', 'CreatedAt', 'UpdatedAt', 'CreatedBy', 'UpdatedBy'].includes(header))
      .map((header) => ({
        header,
        label: header.replace(/([a-z])([A-Z])/g, '$1 $2'),
        type: header === 'Status' ? 'status' : 'text',
        required: false
      }))
  })

  const detailFields = computed(() => resolvedFields.value.filter((entry) => entry.header !== 'Code'))

  const filteredItems = computed(() => {
    const keyword = (searchTerm.value || '').toString().trim().toLowerCase()
    if (!keyword) return items.value

    return items.value.filter((row) => {
      const aggregate = Object.values(row || {})
        .map((value) => (value ?? '').toString().toLowerCase())
        .join(' ')
      return aggregate.includes(keyword)
    })
  })

  function notify(type, message) {
    $q.notify({ type, message, timeout: 2200 })
  }

  function resolvePrimaryText(row) {
    if (!row || typeof row !== 'object') return '-'
    if (row.Name) return row.Name
    const firstFilled = resolvedFields.value.find((field) => {
      const value = row[field.header]
      return value !== undefined && value !== null && value.toString().trim() !== '' && field.header !== 'Status'
    })
    return firstFilled ? row[firstFilled.header] : '-'
  }

  function resolveSecondaryText(row) {
    if (!row || typeof row !== 'object') return ''
    const field = resolvedFields.value.find((entry) => {
      if (entry.header === 'Status') return false
      if (row.Name && entry.header === 'Name') return false
      const value = row[entry.header]
      return value !== undefined && value !== null && value.toString().trim() !== ''
    })
    if (!field) return ''
    return row[field.header]
  }

  function applyRecordsResponse(response) {
    lastHeaders.value = Array.isArray(response.headers) ? response.headers : []
    items.value = Array.isArray(response.records) ? response.records : []
    if (config.value?.name === 'Products') {
      productsStore.hydrateFromMasterRecords(response.records, response.headers, showInactive.value)
    }
  }

  async function runBackgroundSync(resourceName, requestId) {
    if (!resourceName || backgroundSyncing.value) return

    backgroundSyncing.value = true
    try {
      const response = await fetchMasterRecords(resourceName, {
        includeInactive: showInactive.value,
        syncWhenCacheExists: true
      })

      if (requestId !== loadRequestId.value || activeResourceName.value !== resourceName) {
        return
      }

      if (!response.success) {
        return
      }

      applyRecordsResponse(response)
    } finally {
      backgroundSyncing.value = false
    }
  }

  function generateTempCode() {
    return `TEMP-${Date.now()}`
  }

  function optimisticallyAddRecord(newRecord) {
    items.value = [newRecord, ...items.value]
  }

  function optimisticallyUpdateRecord(code, updatedRecord) {
    const index = items.value.findIndex((item) => item.Code === code)
    if (index !== -1) {
      items.value[index] = { ...items.value[index], ...updatedRecord }
    }
  }

  function revertOptimisticCreate(tempCode) {
    items.value = items.value.filter((item) => item.Code !== tempCode)
  }

  function revertOptimisticUpdate(code, originalRecord) {
    const index = items.value.findIndex((item) => item.Code === code)
    if (index !== -1) {
      items.value[index] = { ...originalRecord }
    }
  }

  function createEmptyForm() {
    const result = { Code: '' }
    if (!config.value) return result

    resolvedFields.value.forEach((field) => {
      if (field.type === 'status') {
        result[field.header] = 'Active'
      } else {
        result[field.header] = ''
      }
    })
    return result
  }

  function validateForm() {
    if (!config.value) return false

    for (const field of resolvedFields.value) {
      if (!field.required) continue
      const value = (form.value[field.header] || '').toString().trim()
      if (!value) {
        notify('negative', `${field.label} is required`)
        return false
      }
    }

    return true
  }

  async function reload(forceSync = false, requestId = loadRequestId.value, resourceName = activeResourceName.value) {
    if (!resourceName) return

    if (!items.value.length) {
      loading.value = true
    }
    try {
      const response = await fetchMasterRecords(resourceName, {
        includeInactive: showInactive.value,
        forceSync
      })

      if (requestId !== loadRequestId.value || activeResourceName.value !== resourceName) {
        return
      }

      if (response.success || (response.records && response.records.length > 0)) {
        applyRecordsResponse(response)
      }

      if (!forceSync && response?.meta?.source === 'cache') {
        runBackgroundSync(resourceName, requestId)
      }
    } finally {
      if (requestId === loadRequestId.value) {
        loading.value = false
      }
    }
  }

  function openCreateDialog() {
    isEdit.value = false
    form.value = createEmptyForm()
    showDialog.value = true
  }

  function openEditDialog(row) {
    isEdit.value = true
    form.value = { ...createEmptyForm(), ...row }
    showDialog.value = true
  }

  function openDetailDialog(row) {
    detailRow.value = { ...row }
    showDetailDialog.value = true
  }

  function editFromDetail() {
    if (!detailRow.value) return
    showDetailDialog.value = false
    openEditDialog(detailRow.value)
  }

  async function save() {
    if (!config.value || !validateForm()) {
      return
    }

    const originalForm = { ...form.value }
    const isUpdating = isEdit.value
    const targetCode = isUpdating ? form.value.Code : generateTempCode()

    const optimisticRecord = {
      Code: targetCode,
      Status: 'Active',
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
      ...form.value
    }

    if (isUpdating) {
      optimisticallyUpdateRecord(targetCode, optimisticRecord)
    } else {
      optimisticallyAddRecord(optimisticRecord)
    }

    showDialog.value = false
    saving.value = false
    notify('primary', isUpdating ? 'Updating record in background...' : 'Creating record in background...')

    const apiPromise = isUpdating
      ? updateMasterRecord(config.value.name, targetCode, form.value)
      : createMasterRecord(config.value.name, form.value)

    apiPromise
      .then((response) => {
        if (response.success) {
          runBackgroundSync(config.value?.name || '', loadRequestId.value)
        } else {
          if (isUpdating) {
            revertOptimisticUpdate(targetCode, originalForm)
          } else {
            revertOptimisticCreate(targetCode)
          }
          notify('negative', `Failed to save: ${response.message || 'Server error'}`)
        }
      })
      .catch((err) => {
        if (isUpdating) {
          revertOptimisticUpdate(targetCode, originalForm)
        } else {
          revertOptimisticCreate(targetCode)
        }
        notify('negative', `Network error: ${err.message}`)
      })
  }

  async function initializeForRoute() {
    const newResource = config.value?.name
    const requestId = loadRequestId.value + 1
    loadRequestId.value = requestId

    showDialog.value = false
    showDetailDialog.value = false
    isEdit.value = false
    detailRow.value = null
    form.value = createEmptyForm()

    if (!config.value) {
      items.value = []
      currentResource.value = null
      activeResourceName.value = ''
      notify('negative', 'Master module is not configured')
      await router.push('/dashboard')
      return
    }

    activeResourceName.value = newResource || ''

    if (currentResource.value !== newResource) {
      items.value = []
      currentResource.value = newResource
    }

    await reload(false, requestId, newResource)
  }

  watch(
    () => route.fullPath,
    async () => {
      await initializeForRoute()
    },
    { immediate: true }
  )

  return {
    route,
    currentResource,
    config,
    items,
    filteredItems,
    searchTerm,
    showInactive,
    loading,
    saving,
    backgroundSyncing,
    showDialog,
    showDetailDialog,
    isEdit,
    form,
    detailRow,
    statusOptions,
    resolvedFields,
    detailFields,
    resolvePrimaryText,
    resolveSecondaryText,
    reload,
    openCreateDialog,
    openDetailDialog,
    editFromDetail,
    save
  }
}
