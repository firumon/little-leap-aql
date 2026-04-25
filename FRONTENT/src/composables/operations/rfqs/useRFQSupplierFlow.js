import { computed, ref, unref } from 'vue'
import { useQuasar } from 'quasar'
import { useWorkflowStore } from 'src/stores/workflow'
import { useResourceConfig, isActionVisible } from 'src/composables/resources/useResourceConfig'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { buildPrimaryMeta } from './rfqMeta'
import { parsePrItemCodeCsv, toDateInputValue } from './rfqPayload'

function normalizeCode(value) {
  return (value || '').toString().trim()
}

function toUpper(value) {
  return normalizeCode(value).toUpperCase()
}

function uniqueStrings(values = []) {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => normalizeCode(value))
      .filter(Boolean)
  ))
}

function buildSupplierRecord({ rfqCode, procurementCode, supplierCode }) {
  return {
    ProcurementCode: procurementCode || '',
    RFQCode: rfqCode || '',
    SupplierCode: supplierCode || '',
    SentDate: '',
    Progress: 'ASSIGNED',
    Status: 'Active'
  }
}

function buildSupplierLookup(rows = []) {
  return new Map(
    (Array.isArray(rows) ? rows : []).map((row) => [normalizeCode(row?.Code), row])
  )
}

export function useRFQSupplierFlow(rfqCodeRef) {
  const $q = useQuasar()
  const workflowStore = useWorkflowStore()
  const nav = useResourceNav()
  const { code: routeCode, additionalActions } = useResourceConfig()

  const rfqResource = useResourceData(ref('RFQs'))
  const prResource = useResourceData(ref('PurchaseRequisitions'))
  const suppliersResource = useResourceData(ref('Suppliers'))
  const rfqSuppliersResource = useResourceData(ref('RFQSuppliers'))

  const isHeaderLoading = ref(true)
  const isSuppliersLoading = ref(true)
  const isSaving = ref(false)

  const resolvedRfqCode = computed(() => normalizeCode(unref(rfqCodeRef) || routeCode.value))
  const rfqRecord = computed(() =>
    rfqResource.items.value.find((row) => normalizeCode(row?.Code) === resolvedRfqCode.value) || null
  )
  const prRecord = computed(() => {
    const prCode = normalizeCode(rfqRecord.value?.PurchaseRequisitionCode)
    if (!prCode) return null
    return prResource.items.value.find((row) => normalizeCode(row?.Code) === prCode) || null
  })

  const headerDisplayFields = computed(() => {
    if (!rfqRecord.value) return []
    return buildPrimaryMeta(rfqRecord.value, prRecord.value || {})
  })

  const itemCodes = computed(() => parsePrItemCodeCsv(rfqRecord.value?.PurchaseRequisitionItemsCode))

  const isDraft = computed(() => toUpper(rfqRecord.value?.Progress) === 'DRAFT')
  const isSent = computed(() => toUpper(rfqRecord.value?.Progress) === 'SENT')
  const canAddAvailableSuppliers = computed(() => {
    if (!rfqRecord.value || isDraft.value) return false
    return !['CLOSED', 'CANCELLED'].includes(toUpper(rfqRecord.value?.Progress))
  })

  const assignSupplierAction = computed(() =>
    additionalActions.value.find((action) =>
      action.action === 'AssignSupplier' && isActionVisible(action, rfqRecord.value)
    ) || null
  )

  const markAsSentAction = computed(() =>
    additionalActions.value.find((action) =>
      action.action === 'MarkAsSent' && isActionVisible(action, rfqRecord.value)
    ) || null
  )

  const canAssignSupplier = computed(() => !!rfqRecord.value && isDraft.value)
  const canMarkAsSent = computed(() => !!rfqRecord.value && isSent.value)

  const assignedSupplierRows = computed(() =>
    rfqSuppliersResource.items.value.filter((row) =>
      normalizeCode(row?.RFQCode) === resolvedRfqCode.value &&
      toUpper(row?.Status || 'Active') === 'ACTIVE'
    )
  )

  const availableSuppliers = computed(() => {
    const assignedCodes = new Set(
      assignedSupplierRows.value.map((row) => normalizeCode(row?.SupplierCode)).filter(Boolean)
    )

    return suppliersResource.items.value.filter((row) => {
      const supplierCode = normalizeCode(row?.Code)
      return toUpper(row?.Status || 'Active') === 'ACTIVE' && supplierCode && !assignedCodes.has(supplierCode)
    })
  })

  const assignedSupplierDetails = computed(() => {
    const supplierLookup = buildSupplierLookup(suppliersResource.items.value)

    return assignedSupplierRows.value.map((assignedRow) => {
      const master = supplierLookup.get(normalizeCode(assignedRow?.SupplierCode)) || {}
      return {
        ...assignedRow,
        SupplierName: master.Name || assignedRow?.SupplierCode || '-',
        Country: master.Country || '-',
        Province: master.Province || '-',
        ContactPerson: master.ContactPerson || ''
      }
    })
  })

  async function loadRFQData(forceSync = false) {
    if (!resolvedRfqCode.value) return

    isHeaderLoading.value = true
    try {
      await rfqResource.reload(forceSync)
      if (rfqRecord.value?.PurchaseRequisitionCode) {
        await prResource.reload(forceSync)
      }
    } catch (error) {
      console.error('Failed to load RFQ data:', error)
      $q.notify({ type: 'negative', message: 'Failed to load RFQ.' })
    } finally {
      isHeaderLoading.value = false
    }
  }

  async function loadSuppliersData(forceSync = false) {
    if (!resolvedRfqCode.value) return

    isSuppliersLoading.value = true
    try {
      await Promise.all([
        suppliersResource.reload(forceSync),
        rfqSuppliersResource.reload(forceSync)
      ])
    } catch (error) {
      console.error('Failed to load supplier data:', error)
      $q.notify({ type: 'negative', message: 'Failed to load suppliers.' })
    } finally {
      isSuppliersLoading.value = false
    }
  }

  async function loadData(forceSync = false) {
    await Promise.all([
      loadRFQData(forceSync),
      loadSuppliersData(forceSync)
    ])
  }

  async function saveAssignments(selectedSupplierCodes = []) {
    if (!rfqRecord.value || !canAssignSupplier.value) return

    const availableCodes = new Set(availableSuppliers.value.map((row) => normalizeCode(row?.Code)).filter(Boolean))
    const selectedCodes = uniqueStrings(selectedSupplierCodes).filter((code) => availableCodes.has(code))

    if (!selectedCodes.length) {
      $q.notify({ type: 'warning', message: 'Select at least one supplier.' })
      return
    }

    isSaving.value = true
    try {
      const requests = selectedCodes.map((supplierCode) => ({
        action: 'create',
        resource: 'RFQSuppliers',
        payload: {
          record: buildSupplierRecord({
            rfqCode: rfqRecord.value.Code,
            procurementCode: rfqRecord.value.ProcurementCode,
            supplierCode
          })
        }
      }))

      requests.push({
        action: 'update',
        resource: 'RFQs',
        payload: {
          code: rfqRecord.value.Code,
          data: {
            Progress: 'SENT'
          }
        }
      })

      const response = await workflowStore.runBatchRequests(requests)
      if (!response?.success || (Array.isArray(response.data) && response.data.some((entry) => entry?.success === false))) {
        const failedEntry = Array.isArray(response?.data)
          ? response.data.find((entry) => entry?.success === false)
          : null
        $q.notify({
          type: 'negative',
          message: failedEntry?.error || failedEntry?.message || response?.error || 'Failed to assign suppliers.'
        })
        return
      }

      $q.notify({ type: 'positive', message: 'Suppliers assigned.' })
      nav.goTo('view', { code: rfqRecord.value.Code })
    } catch (error) {
      console.error('Assignment failed:', error)
      $q.notify({ type: 'negative', message: 'Failed to assign suppliers.' })
    } finally {
      isSaving.value = false
    }
  }

  async function addAvailableSuppliers(selectedSupplierCodes = []) {
    if (!rfqRecord.value || !canAddAvailableSuppliers.value) return

    const availableCodes = new Set(availableSuppliers.value.map((row) => normalizeCode(row?.Code)).filter(Boolean))
    const selectedCodes = uniqueStrings(selectedSupplierCodes).filter((code) => availableCodes.has(code))

    if (!selectedCodes.length) {
      $q.notify({ type: 'warning', message: 'Select at least one available supplier.' })
      return
    }

    isSaving.value = true
    try {
      const requests = selectedCodes.map((supplierCode) => ({
        action: 'create',
        resource: 'RFQSuppliers',
        payload: {
          record: buildSupplierRecord({
            rfqCode: rfqRecord.value.Code,
            procurementCode: rfqRecord.value.ProcurementCode,
            supplierCode
          })
        }
      }))

      const response = await workflowStore.runBatchRequests(requests)
      if (!response?.success || (Array.isArray(response.data) && response.data.some((entry) => entry?.success === false))) {
        const failedEntry = Array.isArray(response?.data)
          ? response.data.find((entry) => entry?.success === false)
          : null
        $q.notify({
          type: 'negative',
          message: failedEntry?.error || failedEntry?.message || response?.error || 'Failed to save suppliers.'
        })
        return
      }

      $q.notify({ type: 'positive', message: 'Suppliers saved.' })
      await loadSuppliersData(true)
    } catch (error) {
      console.error('Available supplier save failed:', error)
      $q.notify({ type: 'negative', message: 'Failed to save suppliers.' })
    } finally {
      isSaving.value = false
    }
  }

  async function markSelectedAsSent(selectedRfqSupplierCodes = []) {
    if (!rfqRecord.value || !canMarkAsSent.value) return

    const selectedCodes = uniqueStrings(selectedRfqSupplierCodes)
    if (!selectedCodes.length) {
      $q.notify({ type: 'warning', message: 'Select at least one supplier to send.' })
      return
    }

    const currentActiveRows = assignedSupplierRows.value.filter((row) => toUpper(row?.Progress) === 'ASSIGNED')
    const rowsToSend = currentActiveRows.filter((row) => selectedCodes.includes(normalizeCode(row?.Code)))

    if (!rowsToSend.length) {
      $q.notify({ type: 'warning', message: 'Selected suppliers are already sent or invalid.' })
      return
    }

    const selectedRowCodes = new Set(rowsToSend.map((row) => normalizeCode(row?.Code)))
    const hasRemainingAssigned = currentActiveRows.some((row) => !selectedRowCodes.has(normalizeCode(row?.Code)))
    const today = toDateInputValue(new Date())

    isSaving.value = true
    try {
      const requests = rowsToSend.map((row) => ({
        action: 'update',
        resource: 'RFQSuppliers',
        payload: {
          code: row.Code,
          data: {
            Progress: 'SENT',
            SentDate: today
          }
        }
      }))

      if (!hasRemainingAssigned && rfqRecord.value.ProcurementCode) {
        requests.push({
          action: 'update',
          resource: 'Procurements',
          payload: {
            code: rfqRecord.value.ProcurementCode,
            data: {
              Progress: 'RFQ_SENT_TO_SUPPLIERS'
            }
          }
        })
      }

      const response = await workflowStore.runBatchRequests(requests)
      if (!response?.success || (Array.isArray(response.data) && response.data.some((entry) => entry?.success === false))) {
        const failedEntry = Array.isArray(response?.data)
          ? response.data.find((entry) => entry?.success === false)
          : null
        $q.notify({
          type: 'negative',
          message: failedEntry?.error || failedEntry?.message || response?.error || 'Failed to update send status.'
        })
        return
      }

      $q.notify({ type: 'positive', message: 'Marked as sent.' })
    } catch (error) {
      console.error('Send update failed:', error)
      $q.notify({ type: 'negative', message: 'Failed to update send status.' })
    } finally {
      isSaving.value = false
    }
  }

  function goToList() {
    nav.goTo('list')
  }

  function assignSupplier() {
    if (!canAssignSupplier.value) return
    const action = assignSupplierAction.value
    const params = { pageSlug: action?.navigate?.pageSlug || 'assign-supplier' }
    if (action?.navigate?.resourceSlug) params.resourceSlug = action.navigate.resourceSlug
    if (action?.navigate?.scope) params.scope = action.navigate.scope
    nav.goTo(action?.navigate?.target || 'record-page', params)
  }

  function markAsSent() {
    if (!canMarkAsSent.value) return
    const action = markAsSentAction.value
    const params = { pageSlug: action?.navigate?.pageSlug || 'mark-as-sent' }
    if (action?.navigate?.resourceSlug) params.resourceSlug = action.navigate.resourceSlug
    if (action?.navigate?.scope) params.scope = action.navigate.scope
    nav.goTo(action?.navigate?.target || 'record-page', params)
  }

  function formatDate(value) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return {
    isHeaderLoading,
    isSuppliersLoading,
    isSaving,
    rfqRecord,
    prRecord,
    headerDisplayFields,
    itemCodes,
    availableSuppliers,
    assignedSupplierRows,
    assignedSupplierDetails,
    isDraft,
    isSent,
    canAssignSupplier,
    canAddAvailableSuppliers,
    canMarkAsSent,
    loadRFQData,
    loadSuppliersData,
    loadData,
    saveAssignments,
    addAvailableSuppliers,
    markSelectedAsSent,
    assignSupplier,
    markAsSent,
    goToList,
    formatDate
  }
}
