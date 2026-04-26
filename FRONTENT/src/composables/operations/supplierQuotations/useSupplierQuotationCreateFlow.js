import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useWorkflowStore } from 'src/stores/workflow'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { mapOptions, formatCurrency, formatDate } from './supplierQuotationMeta'
import { useSupplierQuotationTotals } from './useSupplierQuotationTotals'
import {
  buildHeaderRecord,
  buildItemRecord,
  defaultHeaderForm,
  defaultItemForm,
  isQuotedItem,
  normalizeNumber,
  stringifyCharges,
  validateQuotation,
  toDateInputValue
} from './supplierQuotationPayload'

function text(value) {
  return (value || '').toString().trim()
}

function responseFailed(response) {
  return !response?.success || (Array.isArray(response.data) && response.data.some((entry) => entry?.success === false))
}

function firstFailureMessage(response, fallback) {
  const failed = Array.isArray(response?.data) ? response.data.find((entry) => entry?.success === false) : null
  return failed?.error || failed?.message || response?.error || fallback
}

function resultCode(entry) {
  return entry?.data?.result?.parentCode || entry?.data?.result?.code || entry?.data?.code || ''
}

export function useSupplierQuotationCreateFlow() {
  const $q = useQuasar()
  const auth = useAuthStore()
  const workflowStore = useWorkflowStore()
  const nav = useResourceNav()

  const rfqs = useResourceData(ref('RFQs'))
  const rfqSuppliers = useResourceData(ref('RFQSuppliers'))
  const suppliers = useResourceData(ref('Suppliers'))
  const quotations = useResourceData(ref('SupplierQuotations'))
  const prItems = useResourceData(ref('PurchaseRequisitionItems'))
  const procurements = useResourceData(ref('Procurements'))

  const loading = ref(false)
  const saving = ref(false)
  const rfqSearch = ref('')
  const selectedRfqCode = ref('')
  const selectedSupplierCode = ref('')
  const form = ref(defaultHeaderForm())
  const items = ref([])

  const {
    itemSubtotal,
    extraChargesTotal,
    suggestedTotal,
    syncAllItemTotals
  } = useSupplierQuotationTotals({ form, items })

  const supplierByCode = computed(() => new Map(suppliers.items.value.map((row) => [text(row.Code), row])))
  const procurementByCode = computed(() => new Map(procurements.items.value.map((row) => [text(row.Code), row])))

  const optionSets = computed(() => ({
    responseTypes: mapOptions(auth.appOptionsMap.SupplierQuotationResponseType, 'responseTypes'),
    leadTimeTypes: mapOptions(auth.appOptionsMap.RFQLeadTimeType, 'leadTimeTypes'),
    deliveryModes: mapOptions(auth.appOptionsMap.RFQDeliveryMode, 'deliveryModes'),
    shippingTerms: mapOptions(auth.appOptionsMap.RFQShippingTerm, 'shippingTerms'),
    paymentTerms: mapOptions(auth.appOptionsMap.RFQPaymentTerm, 'paymentTerms'),
    currencies: mapOptions(auth.appOptionsMap.Currency, 'currencies')
  }))

  const sentRfqs = computed(() => {
    const keyword = rfqSearch.value.trim().toLowerCase()
    return rfqs.items.value
      .filter((row) => text(row.Status || 'Active') === 'Active' && text(row.Progress).toUpperCase() === 'SENT')
      .filter((row) => !keyword || [row.Code, row.ProcurementCode, row.PurchaseRequisitionCode, row.SubmissionDeadline]
        .map((value) => text(value).toLowerCase()).join(' ').includes(keyword))
  })

  const selectedRfq = computed(() =>
    rfqs.items.value.find((row) => text(row.Code) === selectedRfqCode.value) || null
  )

  const assignedSupplierRows = computed(() => {
    if (!selectedRfq.value) return []
    return rfqSuppliers.items.value.filter((row) =>
      text(row.RFQCode) === selectedRfq.value.Code &&
      text(row.Status || 'Active') === 'Active' &&
      !['CANCELLED', 'INACTIVE'].includes(text(row.Progress).toUpperCase())
    )
  })

  const assignedSuppliers = computed(() => assignedSupplierRows.value.map((row) => ({
    ...row,
    SupplierName: supplierByCode.value.get(text(row.SupplierCode))?.Name || row.SupplierCode || '-'
  })))

  const selectedSupplier = computed(() => supplierByCode.value.get(selectedSupplierCode.value) || null)

  const existingSupplierQuotations = computed(() => {
    if (!selectedRfq.value || !selectedSupplierCode.value) return []
    return quotations.items.value.filter((row) =>
      text(row.RFQCode) === selectedRfq.value.Code &&
      text(row.SupplierCode) === selectedSupplierCode.value &&
      text(row.Status || 'Active') === 'Active'
    )
  })

  const selectedPrItemCodes = computed(() =>
    text(selectedRfq.value?.PurchaseRequisitionItemsCode)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  )

  const itemContext = computed(() => {
    const codeSet = new Set(selectedPrItemCodes.value)
    return prItems.items.value.filter((item) => codeSet.has(text(item.Code)))
  })

  const canSave = computed(() => !saving.value && !!selectedRfq.value && !!selectedSupplierCode.value && !!form.value.ResponseType)

  function currentUserLabel() {
    return auth.user?.name || auth.user?.email || auth.user?.id || 'Unknown User'
  }

  function selectRfq(row) {
    selectedRfqCode.value = row?.Code || ''
    selectedSupplierCode.value = ''
    form.value = defaultHeaderForm({
      ProcurementCode: row?.ProcurementCode || '',
      RFQCode: row?.Code || '',
      LeadTimeDays: row?.LeadTimeDays || 0,
      LeadTimeType: row?.LeadTimeType || 'FLEXIBLE',
      DeliveryMode: row?.DeliveryMode || 'ANY',
      AllowPartialDelivery: row?.AllowPartialDelivery || true,
      AllowSplitShipment: row?.AllowSplitShipment || true,
      ShippingTerm: row?.ShippingTerm || '',
      PaymentTerm: row?.PaymentTerm || '',
      PaymentTermDetail: row?.PaymentTermDetail || '',
      QuotationValidityDays: row?.QuotationValidityDays || 7
    })
  }

  function selectSupplier(row) {
    selectedSupplierCode.value = row?.SupplierCode || row?.Code || ''
    form.value.SupplierCode = selectedSupplierCode.value
  }

  function syncItemsFromContext() {
    const existingByPrItem = new Map(items.value.map((item) => [item.PurchaseRequisitionItemCode, item]))
    items.value = itemContext.value.map((context) => defaultItemForm(context, existingByPrItem.get(context.Code) || {}))
  }

  async function loadData(forceSync = false) {
    loading.value = true
    try {
      await Promise.all([
        rfqs.reload(forceSync),
        rfqSuppliers.reload(forceSync),
        suppliers.reload(forceSync),
        quotations.reload(forceSync),
        prItems.reload(forceSync),
        procurements.reload(forceSync)
      ])
    } finally {
      loading.value = false
    }
  }

  function buildSaveRequests() {
    syncAllItemTotals()

    const now = Date.now()
    const header = buildHeaderRecord(form.value, {
      ResponseRecordedAt: now,
      ResponseRecordedBy: currentUserLabel()
    })

    const quotedItems = form.value.ResponseType === 'DECLINED'
      ? []
      : items.value.filter(isQuotedItem).map((item) => ({ _action: 'create', data: buildItemRecord(item) }))

    const requests = [{
      action: 'compositeSave',
      resource: 'SupplierQuotations',
      payload: {
        data: header,
        children: quotedItems.length
          ? [{ resource: 'SupplierQuotationItems', records: quotedItems }]
          : []
      }
    }]

    const supplierRow = assignedSupplierRows.value.find((row) => text(row.SupplierCode) === selectedSupplierCode.value)
    if (supplierRow?.Code) {
      const supplierProgress = text(supplierRow.Progress).toUpperCase()
      if (supplierProgress === 'ASSIGNED') {
        const updateData = { Progress: 'RESPONDED' }
        if (!supplierRow.SentDate) {
          updateData.SentDate = toDateInputValue()
        }
        requests.push({
          action: 'update',
          resource: 'RFQSuppliers',
          payload: {
            code: supplierRow.Code,
            data: updateData
          }
        })
      } else if (supplierProgress === 'SENT') {
        requests.push({
          action: 'update',
          resource: 'RFQSuppliers',
          payload: {
            code: supplierRow.Code,
            data: { Progress: 'RESPONDED' }
          }
        })
      }
    }

    const procurement = procurementByCode.value.get(text(selectedRfq.value?.ProcurementCode))
    if (procurement?.Code && procurement.Progress === 'RFQ_SENT_TO_SUPPLIERS') {
      requests.push({
        action: 'update',
        resource: 'Procurements',
        payload: {
          code: procurement.Code,
          data: { Progress: 'QUOTATIONS_RECEIVED' }
        }
      })
    }

    requests.push({
      action: 'get',
      resource: ['SupplierQuotations', 'SupplierQuotationItems', 'RFQSuppliers', 'Procurements'],
      payload: { includeInactive: true }
    })

    return requests
  }

  async function save() {
    const validation = validateQuotation({
      form: form.value,
      items: items.value,
      rfqItemCount: itemContext.value.length
    })
    if (!validation.success) {
      $q.notify({ type: 'warning', message: validation.errors[0] })
      return
    }

    saving.value = true
    try {
      form.value.ExtraChargesBreakup = JSON.parse(stringifyCharges(form.value.ExtraChargesBreakup))
      const response = await workflowStore.runBatchRequests(buildSaveRequests())
      if (responseFailed(response)) {
        $q.notify({ type: 'negative', message: firstFailureMessage(response, 'Failed to save supplier quotation') })
        return
      }

      const code = resultCode(response.data?.[0])
      $q.notify({ type: 'positive', message: 'Supplier quotation saved' })
      if (code) nav.goTo('view', { code })
      else nav.goTo('list')
    } catch (error) {
      $q.notify({ type: 'negative', message: `Failed to save supplier quotation: ${error.message}` })
    } finally {
      saving.value = false
    }
  }

  function cancel() {
    nav.goTo('list')
  }

  watch(itemContext, syncItemsFromContext, { immediate: true })
  watch(() => form.value.ResponseDate, (date) => {
    if (date && form.value.QuotationValidityDays) {
      const base = new Date(date)
      if (!Number.isNaN(base.getTime())) {
        base.setDate(base.getDate() + Number(form.value.QuotationValidityDays || 0))
        form.value.ValidUntilDate = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
      }
    }
  })

  loadData()

  return {
    loading,
    saving,
    rfqSearch,
    selectedRfqCode,
    selectedSupplierCode,
    form,
    items,
    optionSets,
    sentRfqs,
    selectedRfq,
    assignedSuppliers,
    selectedSupplier,
    existingSupplierQuotations,
    itemContext,
    itemSubtotal,
    extraChargesTotal,
    suggestedTotal,
    canSave,
    loadData,
    selectRfq,
    selectSupplier,
    save,
    cancel,
    formatDate,
    formatCurrency
  }
}
