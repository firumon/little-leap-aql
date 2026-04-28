import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useResourceConfig, isActionVisible } from '../../resources/useResourceConfig.js'
import { useResourceData } from '../../resources/useResourceData.js'
import { useWorkflowStore } from '../../../stores/workflow.js'
import { useResourceNav } from '../../resources/useResourceNav.js'
import { progressMeta, PO_RECEIVING_REPORT_PLACEHOLDERS, formatDate } from './poReceivingMeta.js'
import { acceptedReceiptItemCount, decorateItem, summarizeItems, validateReceiving } from './poReceivingPayload.js'
import {
  buildCancelReceivingRequests,
  buildGenerateGrnRequests,
  executeActionRequest,
  PO_RECEIVING_ACTIONS,
  procurementProgressUpdateRequest,
  refreshRequest,
  responseFailed,
  failureMessage,
  resultCode,
  text
} from './poReceivingBatch.js'

export function usePOReceivingView() {
  const $q = useQuasar()
  const { code, additionalActions } = useResourceConfig()
  const nav = useResourceNav()
  const workflowStore = useWorkflowStore()
  const receivings = useResourceData(ref('POReceivings'))
  const receivingItems = useResourceData(ref('POReceivingItems'))
  const goodsReceipts = useResourceData(ref('GoodsReceipts'))
  const goodsReceiptItems = useResourceData(ref('GoodsReceiptItems'))
  const procurements = useResourceData(ref('Procurements'))
  const purchaseOrders = useResourceData(ref('PurchaseOrders'))
  const loading = ref(false)
  const acting = ref(false)
  const cancelComment = ref('')

  const record = computed(() => receivings.items.value.find(row => row.Code === code.value) || null)
  const items = computed(() => receivingItems.items.value.filter(row => row.POReceivingCode === code.value && text(row.Status || 'Active') === 'Active').map(decorateItem))
  const summary = computed(() => summarizeItems(items.value))
  const progress = computed(() => progressMeta(record.value?.Progress || 'OTHER'))
  const linkedGrn = computed(() => goodsReceipts.items.value.find(row => row.POReceivingCode === code.value && text(row.Status || 'Active') === 'Active') || null)
  const purchaseOrder = computed(() => purchaseOrders.items.value.find(row => row.Code === record.value?.PurchaseOrderCode) || null)
  const procurement = computed(() => procurements.items.value.find(row => row.Code === purchaseOrder.value?.ProcurementCode) || null)
  const isCompletedProcurement = computed(() => text(procurement.value?.Progress) === 'COMPLETED')
  const validation = computed(() => validateReceiving(record.value || {}, items.value))
  const canConfirm = computed(() => record.value?.Progress === 'DRAFT' && validation.value.valid && !isCompletedProcurement.value)
  const canGenerateGRN = computed(() => record.value?.Progress === 'CONFIRMED' && !linkedGrn.value && !isCompletedProcurement.value && acceptedReceiptItemCount(items.value) > 0)
  const availableActions = computed(() => record.value ? additionalActions.value.filter(action => isActionVisible(action, record.value)) : [])

  async function loadData(forceSync = false) {
    loading.value = true
    try {
      await workflowStore.fetchResources(['POReceivings', 'POReceivingItems', 'GoodsReceipts', 'GoodsReceiptItems', 'PurchaseOrders', 'Procurements'], { includeInactive: true, forceSync })
    } finally {
      loading.value = false
    }
  }

  async function generateGRN() {
    if (!canGenerateGRN.value) return $q.notify({ type: 'warning', message: 'GRN can be generated only for a confirmed receiving with accepted quantities and no active GRN.', position: 'top' })
    acting.value = true
    try {
      const result = await workflowStore.runBatchRequests([
        ...buildGenerateGrnRequests(record.value, items.value, purchaseOrder.value, procurement.value),
        refreshRequest(['POReceivings', 'POReceivingItems', 'GoodsReceipts', 'GoodsReceiptItems', 'PurchaseOrders', 'Procurements'])
      ])
      if (responseFailed(result)) return $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to generate GRN.'), position: 'top' })
      const grnCode = resultCode(result.data?.[0])
      if (grnCode) nav.goTo('view', { scope: 'operations', resourceSlug: 'goods-receipts', code: grnCode })
    } finally {
      acting.value = false
    }
  }

  async function confirmReceiving() {
    if (!record.value?.Code) return
    if (!validation.value.valid) return $q.notify({ type: 'warning', message: validation.value.errors[0] || 'Fix receiving validation errors.', position: 'top' })
    if (!canConfirm.value) return

    acting.value = true
    try {
      const requests = [executeActionRequest('POReceivings', record.value.Code, PO_RECEIVING_ACTIONS.confirm, {})]
      if (text(procurement.value?.Progress) === 'PO_ISSUED') {
        const update = procurementProgressUpdateRequest(procurement.value, 'GOODS_RECEIVING')
        if (update) requests.push(update)
      }
      requests.push(refreshRequest(['POReceivings', 'POReceivingItems', 'GoodsReceipts', 'GoodsReceiptItems', 'PurchaseOrders', 'Procurements']))
      const result = await workflowStore.runBatchRequests(requests)
      if (responseFailed(result)) return $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to confirm receiving.'), position: 'top' })
      $q.notify({ type: 'positive', message: 'Receiving confirmed.', position: 'top' })
    } finally {
      acting.value = false
    }
  }

  async function cancelReceiving() {
    if (!record.value || isCompletedProcurement.value) {
      $q.notify({ type: 'warning', message: 'Completed procurement cannot be cancelled.', position: 'top' })
      return
    }
    const comment = cancelComment.value.trim()
    if (!comment) return $q.notify({ type: 'warning', message: 'Cancellation comment is required.', position: 'top' })
    acting.value = true
    try {
      const result = await workflowStore.runBatchRequests([
        ...buildCancelReceivingRequests(record.value, linkedGrn.value, goodsReceiptItems.items.value, procurement.value, comment),
        refreshRequest()
      ])
      if (responseFailed(result)) return $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to cancel receiving.'), position: 'top' })
      cancelComment.value = ''
      await loadData(true)
    } finally {
      acting.value = false
    }
  }

  function goToList() { nav.goTo('list') }
  function goToGrn() { if (linkedGrn.value?.Code) nav.goTo('view', { scope: 'operations', resourceSlug: 'goods-receipts', code: linkedGrn.value.Code }) }

  return { loading, acting, record, items, summary, progress, linkedGrn, purchaseOrder, procurement, isCompletedProcurement, canConfirm, canGenerateGRN, availableActions, cancelComment, reportPlaceholders: PO_RECEIVING_REPORT_PLACEHOLDERS, loadData, confirmReceiving, generateGRN, cancelReceiving, goToList, goToGrn, formatDate }
}
