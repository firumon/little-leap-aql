import { computed, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useWorkflowStore } from 'src/stores/workflow'
import { useResourceConfig, isActionVisible } from 'src/composables/resources/useResourceConfig'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { parsePrItemCodeCsv } from 'src/composables/operations/rfqs/rfqPayload'
import { mapOptions, formatCurrency, formatDate } from './supplierQuotationMeta'
import { useSupplierQuotationTotals } from './useSupplierQuotationTotals'
import {
  buildHeaderRecord,
  buildItemRecord,
  defaultHeaderForm,
  defaultItemForm,
  isQuotedItem,
  normalizeNumber,
  validateQuotation
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

export function useSupplierQuotationView() {
  const $q = useQuasar()
  const auth = useAuthStore()
  const workflowStore = useWorkflowStore()
  const nav = useResourceNav()
  const { code, additionalActions } = useResourceConfig()

  const quotations = useResourceData(ref('SupplierQuotations'))
  const quotationItems = useResourceData(ref('SupplierQuotationItems'))
  const rfqs = useResourceData(ref('RFQs'))
  const suppliers = useResourceData(ref('Suppliers'))
  const prItems = useResourceData(ref('PurchaseRequisitionItems'))

  const saving = ref(false)
  const rejecting = ref(false)
  const rejectComment = ref('')
  const form = ref(defaultHeaderForm())
  const items = ref([])

  const {
    itemSubtotal,
    extraChargesTotal,
    suggestedTotal,
    syncAllItemTotals
  } = useSupplierQuotationTotals({ form, items })

  const record = computed(() => quotations.items.value.find((row) => text(row.Code) === text(code.value)) || null)
  const progress = computed(() => text(record.value?.Progress || form.value.Progress).toUpperCase())
  const isEditable = computed(() => progress.value === 'RECEIVED')
  const isReadonly = computed(() => !isEditable.value)

  const rfq = computed(() => rfqs.items.value.find((row) => text(row.Code) === text(form.value.RFQCode)) || null)
  const supplier = computed(() => suppliers.items.value.find((row) => text(row.Code) === text(form.value.SupplierCode)) || null)
  const childRows = computed(() => quotationItems.items.value.filter((row) => text(row.SupplierQuotationCode) === text(code.value)))
  const rfqItemCodes = computed(() => parsePrItemCodeCsv(rfq.value?.PurchaseRequisitionItemsCode))
  const itemContext = computed(() => {
    const codeSet = new Set(rfqItemCodes.value)
    return prItems.items.value.filter((item) => codeSet.has(text(item.Code)))
  })

  const optionSets = computed(() => ({
    responseTypes: mapOptions(auth.appOptionsMap.SupplierQuotationResponseType, 'responseTypes'),
    leadTimeTypes: mapOptions(auth.appOptionsMap.RFQLeadTimeType, 'leadTimeTypes'),
    deliveryModes: mapOptions(auth.appOptionsMap.RFQDeliveryMode, 'deliveryModes'),
    shippingTerms: mapOptions(auth.appOptionsMap.RFQShippingTerm, 'shippingTerms'),
    paymentTerms: mapOptions(auth.appOptionsMap.RFQPaymentTerm, 'paymentTerms'),
    currencies: mapOptions(auth.appOptionsMap.Currency, 'currencies')
  }))

  const rejectAction = computed(() =>
    additionalActions.value.find((action) => action.action === 'Reject' && isActionVisible(action, record.value)) || null
  )

  const canReject = computed(() => isEditable.value && !!rejectAction.value && !rejecting.value)
  const canSave = computed(() => isEditable.value && !saving.value && !!record.value)

  function hydrate() {
    if (!record.value) return
    form.value = defaultHeaderForm(record.value)
    const childrenByPrItem = new Map(childRows.value.map((row) => [text(row.PurchaseRequisitionItemCode), row]))
    const contextRows = itemContext.value.length ? itemContext.value : childRows.value
    items.value = contextRows.map((context) => {
      const seed = childrenByPrItem.get(text(context.Code || context.PurchaseRequisitionItemCode)) || context
      return defaultItemForm(context, seed)
    })
  }

  async function loadData(forceSync = false) {
    await Promise.all([
      quotations.reload(forceSync),
      quotationItems.reload(forceSync),
      rfqs.reload(forceSync),
      suppliers.reload(forceSync),
      prItems.reload(forceSync)
    ])
  }

  function buildChildRecords() {
    const existingByPrItem = new Map(childRows.value.map((row) => [text(row.PurchaseRequisitionItemCode), row]))
    return items.value.map((item) => {
      const existing = existingByPrItem.get(text(item.PurchaseRequisitionItemCode))
      if (isQuotedItem(item)) {
        return {
          _action: existing?.Code ? 'update' : 'create',
          _originalCode: existing?.Code || '',
          data: buildItemRecord(item)
        }
      }
      if (existing?.Code) {
        return {
          _action: 'deactivate',
          _originalCode: existing.Code,
          data: {}
        }
      }
      return null
    }).filter(Boolean)
  }

  async function save() {
    syncAllItemTotals()

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
      const response = await workflowStore.runBatchRequests([
        {
          action: 'compositeSave',
          resource: 'SupplierQuotations',
          payload: {
            code: form.value.Code,
            data: buildHeaderRecord(form.value, {
              ResponseRecordedAt: record.value?.ResponseRecordedAt || '',
              ResponseRecordedBy: record.value?.ResponseRecordedBy || ''
            }),
            children: [{ resource: 'SupplierQuotationItems', records: buildChildRecords() }]
          }
        },
        {
          action: 'get',
          resource: ['SupplierQuotations', 'SupplierQuotationItems'],
          payload: { includeInactive: true }
        }
      ])

      if (responseFailed(response)) {
        $q.notify({ type: 'negative', message: firstFailureMessage(response, 'Failed to save supplier quotation') })
        return
      }
      $q.notify({ type: 'positive', message: 'Supplier quotation saved' })
    } catch (error) {
      $q.notify({ type: 'negative', message: `Failed to save supplier quotation: ${error.message}` })
    } finally {
      saving.value = false
    }
  }

  async function reject() {
    const comment = rejectComment.value.trim()
    if (!comment) {
      $q.notify({ type: 'warning', message: 'Rejection comment is required.' })
      return
    }
    if (!rejectAction.value || !record.value?.Code) return

    rejecting.value = true
    try {
      const response = await workflowStore.executeResourceAction(
        'SupplierQuotations',
        record.value.Code,
        rejectAction.value,
        { ProgressRejectedComment: comment }
      )

      if (responseFailed(response)) {
        $q.notify({ type: 'negative', message: firstFailureMessage(response, 'Failed to reject quotation') })
        return
      }
      $q.notify({ type: 'positive', message: 'Supplier quotation rejected' })
      rejectComment.value = ''
    } finally {
      rejecting.value = false
    }
  }

  function goToList() {
    nav.goTo('list')
  }

  watch([record, childRows, itemContext], hydrate, { immediate: true })
  watch(code, async () => {
    if (code.value) await loadData()
  }, { immediate: true })

  return {
    loading: quotations.loading,
    saving,
    rejecting,
    rejectComment,
    record,
    form,
    items,
    rfq,
    supplier,
    progress,
    isEditable,
    isReadonly,
    optionSets,
    itemSubtotal,
    extraChargesTotal,
    suggestedTotal,
    canSave,
    canReject,
    loadData,
    save,
    reject,
    goToList,
    formatDate,
    formatCurrency
  }
}
