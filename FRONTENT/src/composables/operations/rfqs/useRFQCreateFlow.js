import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useWorkflowStore } from 'src/stores/workflow'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useProcurements } from 'src/composables/operations/procurements/useProcurements'
import { mapRFQOptions } from './rfqMeta'
import { addDays, buildRFQRecord, daysUntil, toDateInputValue } from './rfqPayload'

function responseFailed(response) {
  return !response?.success || (response.data || []).some((entry) => entry?.success === false)
}

function firstFailureMessage(response, fallback) {
  const failed = (response?.data || []).find((entry) => entry?.success === false)
  return failed?.error || failed?.message || response?.error || fallback
}

function resultCode(entry) {
  return entry?.data?.result?.code || entry?.data?.code || entry?.data?.result?.parentCode || ''
}

export function useRFQCreateFlow() {
  const $q = useQuasar()
  const auth = useAuthStore()
  const workflowStore = useWorkflowStore()
  const nav = useResourceNav()
  const procurements = useProcurements()

  const prResource = useResourceData(ref('PurchaseRequisitions'))
  const itemResource = useResourceData(ref('PurchaseRequisitionItems'))
  const rfqResource = useResourceData(ref('RFQs'))

  const steps = [
    { n: 1, label: 'PR' },
    { n: 2, label: 'Timing' },
    { n: 3, label: 'Terms' },
    { n: 4, label: 'Summary' }
  ]
  const currentStep = ref(1)
  const loading = ref(false)
  const saving = ref(false)
  const searchTerm = ref('')
  const selectedPrCode = ref('')
  const createdCode = ref('')

  const today = toDateInputValue()
  const form = ref({
    RFQDate: today,
    LeadTimeDays: 0,
    LeadTimeType: 'FLEXIBLE',
    ShippingTermMode: 'ANY',
    ShippingTerm: '',
    PaymentTermMode: 'ANY',
    PaymentTerm: '',
    PaymentTermDetail: '',
    QuotationValidityDays: 7,
    QuotationValidityMode: 'MIN_REQUIRED',
    DeliveryMode: 'ANY',
    AllowPartialDelivery: true,
    AllowSplitShipment: true,
    SubmissionDeadline: addDays(today, 7)
  })

  const optionSets = computed(() => ({
    leadTimeTypes: mapRFQOptions(auth.appOptionsMap.RFQLeadTimeType, 'leadTimeTypes'),
    shippingTermModes: mapRFQOptions(auth.appOptionsMap.RFQShippingTermMode, 'shippingTermModes'),
    shippingTerms: mapRFQOptions(auth.appOptionsMap.RFQShippingTerm, 'shippingTerms'),
    paymentTermModes: mapRFQOptions(auth.appOptionsMap.RFQPaymentTermMode, 'paymentTermModes'),
    paymentTerms: mapRFQOptions(auth.appOptionsMap.RFQPaymentTerm, 'paymentTerms'),
    quotationValidityModes: mapRFQOptions(auth.appOptionsMap.RFQQuotationValidityMode, 'quotationValidityModes'),
    deliveryModes: mapRFQOptions(auth.appOptionsMap.RFQDeliveryMode, 'deliveryModes')
  }))

  const approvedPrs = computed(() => {
    const keyword = searchTerm.value.trim().toLowerCase()
    return prResource.items.value
      .filter((pr) => (pr.Status || 'Active') === 'Active' && pr.Progress === procurements.progress.value.approved)
      .filter((pr) => {
        if (!keyword) return true
        return [pr.Code, pr.ProcurementCode, pr.PRDate, pr.RequiredDate, pr.WarehouseCode, pr.Priority]
          .map((value) => (value || '').toString().toLowerCase())
          .join(' ')
          .includes(keyword)
      })
  })

  const selectedPr = computed(() => approvedPrs.value.find((pr) => pr.Code === selectedPrCode.value) || null)
  const selectedPrItems = computed(() => {
    if (!selectedPr.value?.Code) return []
    return itemResource.items.value.filter((item) => item.PurchaseRequisitionCode === selectedPr.value.Code)
  })
  const calculatedLeadTimeDays = computed(() => daysUntil(selectedPr.value?.RequiredDate, form.value.RFQDate))
  const leadTimeChanged = computed(() => selectedPr.value && Number(form.value.LeadTimeDays) !== Number(calculatedLeadTimeDays.value))
  const canGoTiming = computed(() => !!selectedPr.value && selectedPrItems.value.length > 0)
  const canConfirm = computed(() => canGoTiming.value && !!form.value.SubmissionDeadline && !saving.value)

  function formatDate(value) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function selectPr(pr) {
    selectedPrCode.value = pr?.Code || ''
    form.value.LeadTimeDays = daysUntil(pr?.RequiredDate, form.value.RFQDate)
    currentStep.value = 2
  }

  function goTo(step) {
    if (step > 1 && !canGoTiming.value) return
    currentStep.value = step
  }

  async function loadData() {
    loading.value = true
    try {
      await Promise.all([prResource.reload(), itemResource.reload(), rfqResource.reload()])
    } finally {
      loading.value = false
    }
  }

  function buildCreateRequests(procurementCode) {
    const pr = selectedPr.value
    const rfqRecord = buildRFQRecord({
      pr,
      items: selectedPrItems.value,
      form: form.value,
      procurementCode
    })

    return [
      {
        action: 'create',
        resource: 'RFQs',
        payload: { record: rfqRecord }
      },
      {
        action: 'update',
        resource: 'PurchaseRequisitions',
        payload: {
          code: pr.Code,
          data: {
            ProcurementCode: procurementCode,
            Progress: procurements.progress.value.rfqProcessed
          }
        }
      },
      procurements.buildProcurementUpdateRequest(procurementCode, procurements.procurementStage.value.rfqGenerated),
      { action: 'get', resource: ['RFQs', 'PurchaseRequisitions', 'Procurements'], payload: { includeInactive: true } }
    ].filter(Boolean)
  }

  async function ensureProcurementCode() {
    if (selectedPr.value?.ProcurementCode) return selectedPr.value.ProcurementCode

    const response = await workflowStore.runBatchRequests([
      procurements.buildProcurementCreateRequest(selectedPr.value.Code),
      { action: 'get', resource: ['Procurements', 'PurchaseRequisitions'], payload: { includeInactive: true } }
    ])
    if (responseFailed(response)) {
      throw new Error(firstFailureMessage(response, 'Failed to create linked Procurement'))
    }
    const code = resultCode(response.data?.[0])
    if (!code) throw new Error('Procurement was created, but no code was returned.')
    return code
  }

  async function confirmCreate() {
    if (!canConfirm.value) {
      $q.notify({ type: 'warning', message: 'Select an approved PR with items before creating RFQ.' })
      return
    }

    saving.value = true
    try {
      const procurementCode = await ensureProcurementCode()
      const response = await workflowStore.runBatchRequests(buildCreateRequests(procurementCode))
      if (responseFailed(response)) {
        $q.notify({ type: 'negative', message: firstFailureMessage(response, 'Failed to create RFQ') })
        return
      }

      const rfqCode = resultCode(response.data?.[0])
      createdCode.value = rfqCode
      $q.notify({ type: 'positive', message: 'RFQ created' })
      if (rfqCode) nav.goTo('view', { code: rfqCode })
    } catch (error) {
      $q.notify({ type: 'negative', message: `Failed to create RFQ: ${error.message}` })
    } finally {
      saving.value = false
    }
  }

  watch(() => form.value.RFQDate, (date) => {
    form.value.SubmissionDeadline = addDays(date, 7)
    if (selectedPr.value) form.value.LeadTimeDays = daysUntil(selectedPr.value.RequiredDate, date)
  })

  loadData()

  return {
    steps,
    currentStep,
    loading,
    saving,
    searchTerm,
    form,
    optionSets,
    approvedPrs,
    selectedPr,
    selectedPrItems,
    calculatedLeadTimeDays,
    leadTimeChanged,
    canGoTiming,
    canConfirm,
    createdCode,
    formatDate,
    selectPr,
    goTo,
    loadData,
    confirmCreate
  }
}

