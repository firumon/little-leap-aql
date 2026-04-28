import { ref, computed, nextTick } from 'vue'
import { useQuasar } from 'quasar'
import { buildPurchaseRequisitionSkuInfo } from '../purchaseRequisitions/purchaseRequisitionSkuOptions.js'
import { useAuthStore } from '../../../stores/auth.js'
import { useResourceData } from '../../resources/useResourceData.js'
import { useWorkflowStore } from '../../../stores/workflow.js'
import { useResourceNav } from '../../resources/useResourceNav.js'
import {
  acceptedReceiptItemCount,
  buildCompositePayload,
  canonicalReceivingSnapshot,
  decorateItem,
  defaultHeaderForm,
  defaultItemForm,
  summarizeItems,
  validateReceiving
} from './poReceivingPayload.js'
import { SYSTEM_REPLACEMENT_REASON } from './poReceivingMeta.js'
import {
  PO_RECEIVING_ACTIONS,
  PO_RECEIVING_RESOURCES,
  batchParentCode,
  buildCancelReceivingRequests,
  buildGenerateGrnRequests,
  compositeSaveRequest,
  executeActionRequest,
  failureMessage,
  procurementProgressUpdateRequest,
  refreshRequest,
  responseFailed,
  text
} from './poReceivingBatch.js'

function userLabel(auth) { return auth.user?.name || auth.user?.Name || auth.user?.email || auth.user?.Email || 'Unknown User' }

export function usePOReceivingAddFlow() {
  const $q = useQuasar()
  const auth = useAuthStore()
  const workflowStore = useWorkflowStore()
  const nav = useResourceNav()
  const purchaseOrders = useResourceData(ref('PurchaseOrders'))
  const poItems = useResourceData(ref('PurchaseOrderItems'))
  const skus = useResourceData(ref('SKUs'))
  const products = useResourceData(ref('Products'))
  const receivings = useResourceData(ref('POReceivings'))
  const receivingItems = useResourceData(ref('POReceivingItems'))
  const goodsReceipts = useResourceData(ref('GoodsReceipts'))
  const goodsReceiptItems = useResourceData(ref('GoodsReceiptItems'))
  const procurements = useResourceData(ref('Procurements'))
  const loading = ref(false)
  const saving = ref(false)
  const selectedPurchaseOrderCode = ref('')
  const selectedReceivingCode = ref('')
  const loadedSnapshot = ref('')
  const form = ref(defaultHeaderForm(null, null, userLabel(auth)))
  const items = ref([])

  function activeReceivingsForPo(purchaseOrderCode) {
    return receivings.items.value
      .filter(row => row.PurchaseOrderCode === purchaseOrderCode)
      .filter(row => text(row.Status || 'Active') === 'Active')
      .filter(row => text(row.Progress).toUpperCase() !== 'CANCELLED')
  }

  function draftReceivingForPo(purchaseOrderCode) {
    return activeReceivingsForPo(purchaseOrderCode)
      .find(row => text(row.Progress).toUpperCase() === 'DRAFT') || null
  }

  function isPurchaseOrderSelectable(row) {
    const activeReceivings = activeReceivingsForPo(row.Code)
    return !activeReceivings.length || !!draftReceivingForPo(row.Code)
  }

  const purchaseOrderOptions = computed(() => purchaseOrders.items.value
    .filter(row => text(row.Status || 'Active') === 'Active' && text(row.Progress).toUpperCase() !== 'CANCELLED')
    .filter(isPurchaseOrderSelectable)
    .map((row) => {
      const draftReceiving = draftReceivingForPo(row.Code)
      return {
        label: draftReceiving
          ? `${row.Code} (${row.SupplierCode || 'Supplier'}) - Draft ${draftReceiving.Code}`
          : `${row.Code} (${row.SupplierCode || 'Supplier'})`,
        value: row.Code
      }
    }))
  const selectedPurchaseOrder = computed(() => purchaseOrders.items.value.find(row => row.Code === selectedPurchaseOrderCode.value) || null)
  const poLineItems = computed(() => poItems.items.value.filter(row => row.PurchaseOrderCode === selectedPurchaseOrderCode.value && text(row.Status || 'Active') === 'Active'))
  const currentReceiving = computed(() => {
    const code = selectedReceivingCode.value || form.value.Code
    if (code) return receivings.items.value.find(row => row.Code === code) || null
    return activeReceivingsForPo(selectedPurchaseOrderCode.value)[0] || null
  })
  const linkedGrn = computed(() => goodsReceipts.items.value.find(row => row.POReceivingCode === form.value.Code && text(row.Status || 'Active') === 'Active') || null)
  const procurement = computed(() => procurements.items.value.find(row => row.Code === selectedPurchaseOrder.value?.ProcurementCode) || null)
  const skuInfoByCode = computed(() => buildPurchaseRequisitionSkuInfo(skus.items.value, products.items.value))
  const summary = computed(() => summarizeItems(items.value))
  const validation = computed(() => validateReceiving(form.value, items.value))
  const isDraft = computed(() => text(form.value.Progress || 'DRAFT') === 'DRAFT')
  const isCompletedProcurement = computed(() => text(procurement.value?.Progress) === 'COMPLETED')
  const hasUnsavedChanges = computed(() => !!selectedPurchaseOrderCode.value && isDraft.value && canonicalReceivingSnapshot(form.value, items.value) !== loadedSnapshot.value)
  const canSaveDraft = computed(() => !!selectedPurchaseOrderCode.value && isDraft.value && (!form.value.Code || hasUnsavedChanges.value))
  const canConfirm = computed(() => !!form.value.Code && isDraft.value && validation.value.valid && !hasUnsavedChanges.value)
  const canGenerateGRN = computed(() => text(form.value.Progress) === 'CONFIRMED' && !!form.value.Code && !linkedGrn.value && !isCompletedProcurement.value && acceptedReceiptItemCount(items.value) > 0)

  function activeItemsForReceiving(receivingCode) {
    return receivingItems.items.value
      .filter(row => row.POReceivingCode === receivingCode && text(row.Status || 'Active') === 'Active')
      .map((item) => decorateItem(item, skuInfoByCode.value))
  }

  function buildDraftItems(receiving = null) {
    const savedItems = receiving?.Code ? activeItemsForReceiving(receiving.Code) : []
    return poLineItems.value.map((poItem) => defaultItemForm(poItem, savedItems.find(item => item.PurchaseOrderItemCode === poItem.Code) || null, skuInfoByCode.value))
  }

  function resetSnapshot() {
    loadedSnapshot.value = canonicalReceivingSnapshot(form.value, items.value)
  }

  function hydrateReceiving(receiving = null) {
    selectedReceivingCode.value = receiving?.Code || ''
    form.value = defaultHeaderForm(selectedPurchaseOrder.value, receiving, userLabel(auth))
    items.value = receiving?.Code ? activeItemsForReceiving(receiving.Code) : buildDraftItems(null)
    resetSnapshot()
  }

  function latestReceivingForSelectedPo() {
    const active = activeReceivingsForPo(selectedPurchaseOrderCode.value)
      .sort((a, b) => String(b.UpdatedAt || b.CreatedAt || b.Code).localeCompare(String(a.UpdatedAt || a.CreatedAt || a.Code)))
    return active.find(row => text(row.Progress).toUpperCase() === 'DRAFT') || active[0] || null
  }

  async function loadData(forceSync = false) {
    loading.value = true
    try {
      await workflowStore.fetchResources(PO_RECEIVING_RESOURCES, { includeInactive: true, forceSync })
      if (selectedPurchaseOrderCode.value) hydrateReceiving(currentReceiving.value || latestReceivingForSelectedPo())
    } finally {
      loading.value = false
    }
  }

  function selectPurchaseOrder(code) {
    selectedPurchaseOrderCode.value = code || ''
    if (!selectedPurchaseOrderCode.value) {
      selectedReceivingCode.value = ''
      form.value = defaultHeaderForm(null, null, userLabel(auth))
      items.value = []
      loadedSnapshot.value = ''
      return
    }
    if (!isPurchaseOrderSelectable({ Code: selectedPurchaseOrderCode.value })) {
      $q.notify({ type: 'warning', message: 'This purchase order already has a finalized receiving.', position: 'top' })
      selectedPurchaseOrderCode.value = ''
      selectedReceivingCode.value = ''
      form.value = defaultHeaderForm(null, null, userLabel(auth))
      items.value = []
      loadedSnapshot.value = ''
      return
    }
    hydrateReceiving(latestReceivingForSelectedPo())
  }

  function updateItem(index, patch) {
    items.value[index] = decorateItem({ ...items.value[index], ...patch }, skuInfoByCode.value)
  }

  function setAllReceivedToExpected() {
    items.value = items.value.map(item => decorateItem({ ...item, ReceivedQty: item.ExpectedQty }, skuInfoByCode.value))
  }

  function clearQuantities() {
    items.value = items.value.map(item => decorateItem({ ...item, ReceivedQty: 0, DamagedQty: 0, RejectedQty: 0, RejectedReason: '' }, skuInfoByCode.value))
  }

  function notifyValidationErrors() {
    $q.notify({ type: 'warning', message: validation.value.errors[0] || 'Fix receiving validation errors.', position: 'top' })
  }

  async function saveDraft() {
    if (!isDraft.value) return $q.notify({ type: 'warning', message: 'Only draft receivings can be saved.', position: 'top' })
    if (!validation.value.valid) return notifyValidationErrors()
    if (!canSaveDraft.value) return $q.notify({ type: 'warning', message: 'No draft changes available to save.', position: 'top' })

    saving.value = true
    try {
      const requests = [compositeSaveRequest(buildCompositePayload({ ...form.value, Progress: 'DRAFT' }, items.value))]
      if (text(procurement.value?.Progress) === 'PO_ISSUED') {
        const update = procurementProgressUpdateRequest(procurement.value, 'GOODS_RECEIVING')
        if (update) requests.push(update)
      }
      requests.push(refreshRequest())
      const result = await workflowStore.runBatchRequests(requests)
      if (responseFailed(result)) return $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to save receiving draft.'), position: 'top' })
      const parentCode = batchParentCode(result)
      if (parentCode) {
        form.value.Code = parentCode
        selectedReceivingCode.value = parentCode
      }
      await nextTick()
      const savedReceiving = currentReceiving.value || latestReceivingForSelectedPo()
      if (savedReceiving) {
        hydrateReceiving(savedReceiving)
      } else {
        resetSnapshot()
      }
      $q.notify({ type: 'positive', message: 'Receiving draft saved.', position: 'top' })
    } finally {
      saving.value = false
    }
  }

  async function confirmReceiving() {
    if (!form.value.Code) return $q.notify({ type: 'warning', message: 'Save the draft before confirmation.', position: 'top' })
    if (hasUnsavedChanges.value) return $q.notify({ type: 'warning', message: 'Save the draft before confirmation.', position: 'top' })
    if (!validation.value.valid) return notifyValidationErrors()
    if (!canConfirm.value) return

    saving.value = true
    try {
      const requests = [executeActionRequest('POReceivings', form.value.Code, PO_RECEIVING_ACTIONS.confirm, {})]
      if (text(procurement.value?.Progress) === 'PO_ISSUED') {
        const update = procurementProgressUpdateRequest(procurement.value, 'GOODS_RECEIVING')
        if (update) requests.push(update)
      }
      requests.push(refreshRequest())
      const result = await workflowStore.runBatchRequests(requests)
      if (responseFailed(result)) return $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to confirm receiving.'), position: 'top' })
      $q.notify({ type: 'positive', message: 'Receiving confirmed.', position: 'top' })
      nav.goTo('view', { code: form.value.Code })
    } finally {
      saving.value = false
    }
  }

  async function generateGRN() {
    if (!canGenerateGRN.value) return $q.notify({ type: 'warning', message: 'GRN can be generated only for a confirmed receiving with accepted quantities and no active GRN.', position: 'top' })
    saving.value = true
    try {
      const requests = [
        ...buildGenerateGrnRequests(form.value, items.value, selectedPurchaseOrder.value, procurement.value),
        refreshRequest(['POReceivings', 'POReceivingItems', 'GoodsReceipts', 'GoodsReceiptItems', 'PurchaseOrders', 'Procurements'])
      ]
      const result = await workflowStore.runBatchRequests(requests)
      if (responseFailed(result)) return $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to generate GRN.'), position: 'top' })
      const grnCode = batchParentCode(result)
      $q.notify({ type: 'positive', message: 'GRN generated.', position: 'top' })
      if (grnCode) nav.goTo('view', { scope: 'operations', resourceSlug: 'goods-receipts', code: grnCode })
    } finally {
      saving.value = false
    }
  }

  async function startReplacement() {
    if (!currentReceiving.value || isCompletedProcurement.value) return $q.notify({ type: 'warning', message: 'Completed procurement cannot be replaced.', position: 'top' })
    saving.value = true
    try {
      const requests = [
        ...buildCancelReceivingRequests(currentReceiving.value, linkedGrn.value, goodsReceiptItems.items.value, procurement.value, SYSTEM_REPLACEMENT_REASON),
        refreshRequest()
      ]
      const result = await workflowStore.runBatchRequests(requests)
      if (responseFailed(result)) return $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to start replacement receiving.'), position: 'top' })
      await loadData(true)
      selectedReceivingCode.value = ''
      form.value = defaultHeaderForm(selectedPurchaseOrder.value, null, userLabel(auth))
      items.value = buildDraftItems(null)
      resetSnapshot()
      $q.notify({ type: 'positive', message: 'Replacement draft is ready.', position: 'top' })
    } finally {
      saving.value = false
    }
  }

  function cancel() { nav.goTo('list') }

  return {
    loading,
    saving,
    selectedPurchaseOrderCode,
    selectedReceivingCode,
    purchaseOrderOptions,
    selectedPurchaseOrder,
    currentReceiving,
    form,
    items,
    summary,
    isDraft,
    isCompletedProcurement,
    hasUnsavedChanges,
    canSaveDraft,
    canConfirm,
    canGenerateGRN,
    loadData,
    selectPurchaseOrder,
    updateItem,
    setAllReceivedToExpected,
    clearQuantities,
    saveDraft,
    confirmReceiving,
    generateGRN,
    startReplacement,
    cancel
  }
}
