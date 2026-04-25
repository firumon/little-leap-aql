import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useWorkflowStore } from 'src/stores/workflow'
import { useResourceConfig, isActionVisible } from 'src/composables/resources/useResourceConfig'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { mapRFQOptions } from './rfqMeta'
import { parsePrItemCodeCsv } from './rfqPayload'

function normalizeFlag(value) {
  if (typeof value === 'boolean') return value
  return ['yes', 'true', '1'].includes((value || '').toString().trim().toLowerCase())
}

function toFlagValue(value) {
  return value ? 'Yes' : 'No'
}

function normalizeNumber(value) {
  return Number(value) || 0
}

function editableSnapshot(form) {
  return JSON.stringify({
    RFQDate: form.RFQDate || '',
    LeadTimeDays: normalizeNumber(form.LeadTimeDays),
    LeadTimeType: form.LeadTimeType || '',
    ShippingTermMode: form.ShippingTermMode || '',
    ShippingTerm: form.ShippingTermMode === 'ANY' ? '' : (form.ShippingTerm || ''),
    PaymentTermMode: form.PaymentTermMode || '',
    PaymentTerm: form.PaymentTermMode === 'ANY' ? '' : (form.PaymentTerm || ''),
    PaymentTermDetail: form.PaymentTermDetail || '',
    QuotationValidityDays: normalizeNumber(form.QuotationValidityDays),
    QuotationValidityMode: form.QuotationValidityMode || '',
    DeliveryMode: form.DeliveryMode || '',
    AllowPartialDelivery: normalizeFlag(form.AllowPartialDelivery),
    AllowSplitShipment: normalizeFlag(form.AllowSplitShipment),
    SubmissionDeadline: form.SubmissionDeadline || ''
  })
}

export function useRFQEditableFlow() {
  const $q = useQuasar()
  const auth = useAuthStore()
  const workflowStore = useWorkflowStore()
  const nav = useResourceNav()
  const { code, resourceName, additionalActions } = useResourceConfig()
  const rfqResource = useResourceData(ref('RFQs'))

  const saving = ref(false)
  const loadedSnapshot = ref('')
  const previousShippingTerm = ref('')
  const previousPaymentTerm = ref('')
  const form = ref({
    Code: '',
    ProcurementCode: '',
    PurchaseRequisitionCode: '',
    PurchaseRequisitionItemsCode: '',
    RFQDate: '',
    LeadTimeDays: 0,
    LeadTimeType: 'FLEXIBLE',
    ShippingTermMode: 'ANY',
    ShippingTerm: '',
    PaymentTermMode: 'ANY',
    PaymentTerm: '',
    PaymentTermDetail: '',
    QuotationValidityDays: 0,
    QuotationValidityMode: 'MIN_REQUIRED',
    DeliveryMode: 'ANY',
    AllowPartialDelivery: true,
    AllowSplitShipment: true,
    SubmissionDeadline: '',
    Progress: '',
    Status: ''
  })

  const record = computed(() => rfqResource.items.value.find((row) => row.Code === code.value) || null)
  const loading = computed(() => rfqResource.loading.value)
  const itemCodes = computed(() => parsePrItemCodeCsv(form.value.PurchaseRequisitionItemsCode))
  const isDraft = computed(() => (form.value.Progress || '').toString().trim().toUpperCase() === 'DRAFT')
  const hasUnsavedChanges = computed(() => !!form.value.Code && editableSnapshot(form.value) !== loadedSnapshot.value)
  const assignSupplierAction = computed(() =>
    additionalActions.value.find((action) => action.action === 'AssignSupplier' && isActionVisible(action, record.value)) || null
  )
  const markAsSentAction = computed(() =>
    additionalActions.value.find((action) => action.action === 'MarkAsSent' && isActionVisible(action, record.value)) || null
  )
  const canSave = computed(() => isDraft.value && hasUnsavedChanges.value && !saving.value)
  const canAssignSupplier = computed(() => isDraft.value && !hasUnsavedChanges.value)
  const canMarkAsSent = computed(() =>
    !hasUnsavedChanges.value &&
    (form.value.Progress || '').toString().trim().toUpperCase() === 'SENT' &&
    !!markAsSentAction.value
  )

  const optionSets = computed(() => ({
    leadTimeTypes: mapRFQOptions(auth.appOptionsMap.RFQLeadTimeType, 'leadTimeTypes'),
    shippingTermModes: mapRFQOptions(auth.appOptionsMap.RFQShippingTermMode, 'shippingTermModes'),
    shippingTerms: mapRFQOptions(auth.appOptionsMap.RFQShippingTerm, 'shippingTerms'),
    paymentTermModes: mapRFQOptions(auth.appOptionsMap.RFQPaymentTermMode, 'paymentTermModes'),
    paymentTerms: mapRFQOptions(auth.appOptionsMap.RFQPaymentTerm, 'paymentTerms'),
    quotationValidityModes: mapRFQOptions(auth.appOptionsMap.RFQQuotationValidityMode, 'quotationValidityModes'),
    deliveryModes: mapRFQOptions(auth.appOptionsMap.RFQDeliveryMode, 'deliveryModes')
  }))

  function hydrateForm(row = {}) {
    form.value = {
      Code: row.Code || '',
      ProcurementCode: row.ProcurementCode || '',
      PurchaseRequisitionCode: row.PurchaseRequisitionCode || '',
      PurchaseRequisitionItemsCode: row.PurchaseRequisitionItemsCode || '',
      RFQDate: row.RFQDate || '',
      LeadTimeDays: normalizeNumber(row.LeadTimeDays),
      LeadTimeType: row.LeadTimeType || 'FLEXIBLE',
      ShippingTermMode: row.ShippingTermMode || 'ANY',
      ShippingTerm: row.ShippingTerm || '',
      PaymentTermMode: row.PaymentTermMode || 'ANY',
      PaymentTerm: row.PaymentTerm || '',
      PaymentTermDetail: row.PaymentTermDetail || '',
      QuotationValidityDays: normalizeNumber(row.QuotationValidityDays),
      QuotationValidityMode: row.QuotationValidityMode || 'MIN_REQUIRED',
      DeliveryMode: row.DeliveryMode || 'ANY',
      AllowPartialDelivery: normalizeFlag(row.AllowPartialDelivery),
      AllowSplitShipment: normalizeFlag(row.AllowSplitShipment),
      SubmissionDeadline: row.SubmissionDeadline || '',
      Progress: row.Progress || '',
      Status: row.Status || ''
    }
    previousShippingTerm.value = row.ShippingTerm || ''
    previousPaymentTerm.value = row.PaymentTerm || ''
    loadedSnapshot.value = editableSnapshot(form.value)
  }

  function buildUpdateRecord() {
    return {
      RFQDate: form.value.RFQDate || '',
      LeadTimeDays: normalizeNumber(form.value.LeadTimeDays),
      LeadTimeType: form.value.LeadTimeType || 'FLEXIBLE',
      ShippingTermMode: form.value.ShippingTermMode || 'ANY',
      ShippingTerm: form.value.ShippingTermMode === 'ANY' ? '' : (form.value.ShippingTerm || ''),
      PaymentTermMode: form.value.PaymentTermMode || 'ANY',
      PaymentTerm: form.value.PaymentTermMode === 'ANY' ? '' : (form.value.PaymentTerm || ''),
      PaymentTermDetail: form.value.PaymentTermDetail || '',
      QuotationValidityDays: normalizeNumber(form.value.QuotationValidityDays),
      QuotationValidityMode: form.value.QuotationValidityMode || 'MIN_REQUIRED',
      DeliveryMode: form.value.DeliveryMode || 'ANY',
      AllowPartialDelivery: toFlagValue(form.value.AllowPartialDelivery),
      AllowSplitShipment: toFlagValue(form.value.AllowSplitShipment),
      SubmissionDeadline: form.value.SubmissionDeadline || ''
    }
  }

  async function loadData(forceSync = false) {
    await rfqResource.reload(forceSync)
  }

  async function saveDraft() {
    if (!canSave.value) return

    saving.value = true
    try {
      const response = await workflowStore.updateResourceRecord('RFQs', form.value.Code, buildUpdateRecord())

      if (!response?.success) {
        $q.notify({ type: 'negative', message: response?.error || response?.message || 'Failed to save RFQ' })
        return
      }

      loadedSnapshot.value = editableSnapshot(form.value)
      $q.notify({ type: 'positive', message: 'RFQ saved' })
    } finally {
      saving.value = false
    }
  }

  function assignSupplier() {
    if (!canAssignSupplier.value) return
    const action = assignSupplierAction.value
    const target = action?.navigate?.target || 'record-page'
    const params = { pageSlug: action?.navigate?.pageSlug || 'assign-supplier' }
    if (action?.navigate?.resourceSlug) params.resourceSlug = action.navigate.resourceSlug
    if (action?.navigate?.scope) params.scope = action.navigate.scope
    nav.goTo(target, params)
  }

  function markAsSent() {
    if (!canMarkAsSent.value) return
    const action = markAsSentAction.value
    const target = action?.navigate?.target || 'record-page'
    const params = { pageSlug: action?.navigate?.pageSlug || 'mark-as-sent' }
    if (action?.navigate?.resourceSlug) params.resourceSlug = action.navigate.resourceSlug
    if (action?.navigate?.scope) params.scope = action.navigate.scope
    nav.goTo(target, params)
  }

  function goToList() {
    nav.goTo('list')
  }

  function formatDate(value) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
  }

  watch(record, (row) => {
    if (row) hydrateForm(row)
  }, { immediate: true })

  watch(code, async () => {
    await loadData()
  }, { immediate: true })

  watch(() => form.value.ShippingTermMode, (mode) => {
    if (mode === 'ANY') {
      if (form.value.ShippingTerm) previousShippingTerm.value = form.value.ShippingTerm
      form.value.ShippingTerm = ''
      return
    }
    if (!form.value.ShippingTerm && previousShippingTerm.value) {
      form.value.ShippingTerm = previousShippingTerm.value
    }
  })

  watch(() => form.value.PaymentTermMode, (mode) => {
    if (mode === 'ANY') {
      if (form.value.PaymentTerm) previousPaymentTerm.value = form.value.PaymentTerm
      form.value.PaymentTerm = ''
      return
    }
    if (!form.value.PaymentTerm && previousPaymentTerm.value) {
      form.value.PaymentTerm = previousPaymentTerm.value
    }
  })

  watch(() => form.value.ShippingTerm, (term) => {
    if (form.value.ShippingTermMode !== 'ANY' && term) {
      previousShippingTerm.value = term
    }
  })

  watch(() => form.value.PaymentTerm, (term) => {
    if (form.value.PaymentTermMode !== 'ANY' && term) {
      previousPaymentTerm.value = term
    }
  })

  return {
    nav,
    loading,
    saving,
    record,
    form,
    itemCodes,
    optionSets,
    isDraft,
    hasUnsavedChanges,
    canSave,
    canAssignSupplier,
    canMarkAsSent,
    resourceName,
    formatDate,
    loadData,
    saveDraft,
    assignSupplier,
    markAsSent,
    goToList
  }
}
