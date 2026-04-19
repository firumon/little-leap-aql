import { computed, ref, toRaw } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useDataStore } from 'src/stores/data'
import { useWorkflowStore } from 'src/stores/workflow'
import { useClientCacheStore } from 'src/stores/clientCache'

const AUDIT_HEADERS = ['CreatedAt', 'UpdatedAt', 'CreatedBy', 'UpdatedBy']

export function useBulkUpload() {
  const $q = useQuasar()
  const authStore = useAuthStore()
  const dataStore = useDataStore()
  const workflowStore = useWorkflowStore()
  const clientCacheStore = useClientCacheStore()

  const selectedResourceName = ref('')
  const rawContent = ref('')
  const csvFile = ref(null)
  const headersDisplay = ref('')
  const rows = ref([])
  const isUploading = ref(false)
  const existingCodes = ref(new Set())

  const resourceOptions = computed(() => {
    const resources = authStore.authorizedResources || []
    return resources
      .filter((resource) => resource.scope === 'master' && resource.functional !== true && resource.permissions?.canWrite)
      .map((resource) => ({
        label: resource.name,
        value: resource.name
      }))
  })

  const selectedResourceHeaders = computed(() => {
    if (!selectedResourceName.value) return []
    const resources = authStore.authorizedResources || []
    const resource = resources.find((entry) => entry.name === selectedResourceName.value)
    return (resource?.headers || []).filter((header) => !AUDIT_HEADERS.includes(header))
  })

  const headerSelection = computed(() => {
    const allowed = new Set(selectedResourceHeaders.value)
    const parsed = (headersDisplay.value || '')
      .split(',')
      .map((header) => header.trim())
      .filter(Boolean)
    const filtered = parsed.filter((header) => allowed.has(header))
    return { parsed, filtered }
  })

  const activeHeaders = computed(() => {
    if (headerSelection.value.parsed.length) return headerSelection.value.filtered
    return selectedResourceHeaders.value
  })

  const columns = computed(() => {
    if (!activeHeaders.value.length) return []
    return [
      { name: '_nature', label: 'Nature', field: '_nature', align: 'left', sortable: true, style: 'width: 80px' },
      ...activeHeaders.value.map((header) => ({
        name: header,
        label: header,
        field: header,
        align: 'left',
        sortable: true
      })),
      { name: '_actions', label: '', field: '_actions', align: 'center', style: 'width: 50px' }
    ]
  })

  const draftKey = computed(() => (selectedResourceName.value ? `bulk-upload::${selectedResourceName.value}` : ''))

  function calculateNature(code) {
    const normalizedCode = (code || '').toString().trim()
    if (!normalizedCode) return 'Insert'
    return existingCodes.value.has(normalizedCode) ? 'Update' : 'Insert'
  }

  async function onResourceSelected(value) {
    rows.value = []
    rawContent.value = ''
    csvFile.value = null
    existingCodes.value = new Set()

    if (!value) {
      headersDisplay.value = ''
      return
    }

    headersDisplay.value = selectedResourceHeaders.value.join(', ')

    try {
      const metaResponse = await clientCacheStore.getResourceMeta(value)
      const headers = metaResponse.data?.headers || selectedResourceHeaders.value
      const codeIndex = headers.indexOf('Code')
      if (codeIndex !== -1) {
        const localRowsResponse = await clientCacheStore.getResourceRows(value)
        const localRows = localRowsResponse.data || []
        existingCodes.value = new Set(
          localRows.map((row) => (row[codeIndex] || '').toString().trim()).filter(Boolean)
        )
      }
    } catch (error) {
      console.warn('Failed to load existing codes for nature detection:', error)
    }

    try {
      const draftResponse = await clientCacheStore.getDraft(`bulk-upload::${value}`)
      const draft = draftResponse.data || null
      if (draft?.data?.rows?.length) {
        rows.value = draft.data.rows
        rawContent.value = draft.data.rawContent || ''
        headersDisplay.value = draft.data.headersDisplay || headersDisplay.value
        $q.notify({ color: 'info', message: `Restored ${rows.value.length} draft rows.`, icon: 'restore', timeout: 3000 })
      }
    } catch (error) {
      console.warn('Failed to restore draft:', error)
    }
  }

  function downloadTemplate() {
    if (!selectedResourceName.value || !selectedResourceHeaders.value.length) return

    const csvContent = selectedResourceHeaders.value.join(',')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${selectedResourceName.value}_Template.csv`
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  function handleFileUpload(file) {
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target.result
      const lines = text.split(/\r?\n/)
      if (lines.length > 1) {
        const dataLines = lines.slice(1).filter((line) => line.trim())
        rawContent.value = dataLines.map((line) => line.split(',').join('\t')).join('\n')
        $q.notify({ color: 'info', message: `Imported ${dataLines.length} rows from CSV.`, icon: 'info' })
      }
    }
    reader.readAsText(file)
  }

  function onCellEdited(row, fieldName, newValue) {
    if (fieldName === 'Code') {
      row._nature = calculateNature(newValue)
    }
    saveDraft()
  }

  function deleteRow(row) {
    rows.value = rows.value.filter((entry) => entry._rowId !== row._rowId)
    saveDraft()
  }

  function plotTable() {
    if (!selectedResourceName.value || !rawContent.value) return
    if (headerSelection.value.parsed.length > 0 && headerSelection.value.filtered.length === 0) {
      $q.notify({
        color: 'negative',
        icon: 'error',
        message: 'None of the typed headers match this resource. Use exact header names (comma-separated).'
      })
      return
    }

    const headers = activeHeaders.value
    const lines = rawContent.value.split(/\r?\n/).filter((line) => line.trim())

    rows.value = lines.map((line, index) => {
      const values = line.split('\t')
      const rowData = { _rowId: Date.now() + index + Math.random() }
      headers.forEach((header, headerIndex) => {
        rowData[header] = (values[headerIndex] || '').trim()
      })
      rowData._nature = calculateNature(rowData.Code)
      return rowData
    })

    saveDraft()
  }

  async function saveDraft() {
    if (!draftKey.value) return
    try {
      const plainRows = JSON.parse(JSON.stringify(toRaw(rows.value)))
      await clientCacheStore.saveDraft(draftKey.value, {
        rows: plainRows,
        rawContent: rawContent.value,
        headersDisplay: headersDisplay.value
      })
    } catch (error) {
      console.warn('Draft save error:', error)
    }
  }

  async function clearAll() {
    rows.value = []
    rawContent.value = ''
    csvFile.value = null
    if (draftKey.value) {
      await clientCacheStore.deleteDraft(draftKey.value).catch(() => {})
    }
  }

  async function uploadAll() {
    isUploading.value = true
    try {
      const records = rows.value.map((row) => {
        const data = { ...row }
        delete data._rowId
        delete data._nature
        return data
      })

      const response = await workflowStore.uploadBulkRecords(selectedResourceName.value, records)
      if (!response.success) {
        $q.notify({ color: 'negative', message: response.error || response.message || 'Bulk upload failed', icon: 'error' })
        return { success: false, response }
      }

      if (!response.data) {
        $q.notify({ color: 'negative', message: 'Bulk upload returned no data', icon: 'error' })
        return { success: false, response }
      }

       const { created = 0, updated = 0, errors = [] } = response.data || {}
      let message = `Done: ${created} created, ${updated} updated.`
      if (errors.length) message += ` ${errors.length} errors.`

      $q.notify({
        color: errors.length ? 'warning' : 'positive',
        message,
        icon: errors.length ? 'warning' : 'check',
        timeout: 5000
      })

       // Cache the full snapshot returned by the server into IDB via store
       const bulkRows = response.data?.rows
       const bulkHeaders = response.data?.headers
       const bulkSyncAt = response.data?.meta?.lastSyncAt
       if (Array.isArray(bulkRows) && bulkRows.length && Array.isArray(bulkHeaders) && bulkHeaders.length) {
         try {
           // Use new store action to cache rows (which uses new service layer)
           await dataStore.cacheResourceRows(selectedResourceName.value, bulkHeaders, bulkRows)
           await dataStore.setResourceMetadata(selectedResourceName.value, {
             headers: bulkHeaders,
             lastSyncAt: bulkSyncAt || Date.now()
           })
         } catch (cacheError) {
           console.warn('Failed to cache bulk upload rows in store:', cacheError)
         }
       }

      if (!errors.length) {
        await clearAll()
      }

      return { success: true, response }
    } catch (error) {
      console.error('Bulk Upload Error:', error)
      return { success: false, response: { message: error?.message || 'Bulk upload failed' } }
    } finally {
      isUploading.value = false
    }
  }

  return {
    selectedResourceName,
    rawContent,
    csvFile,
    headersDisplay,
    rows,
    isUploading,
    resourceOptions,
    selectedResourceHeaders,
    activeHeaders,
    columns,
    onResourceSelected,
    downloadTemplate,
    handleFileUpload,
    plotTable,
    onCellEdited,
    deleteRow,
    saveDraft,
    clearAll,
    uploadAll
  }
}
