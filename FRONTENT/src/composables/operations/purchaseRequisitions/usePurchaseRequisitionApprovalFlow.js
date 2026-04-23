import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useStockMovements } from 'src/composables/operations/stock/useStockMovements'
import { useWorkflowStore } from 'src/stores/workflow'
import { useProcurements } from 'src/composables/operations/procurements/useProcurements'

export function usePurchaseRequisitionApprovalFlow() {
  const route = useRoute()
  const $q = useQuasar()
  const nav = useResourceNav()
  const workflowStore = useWorkflowStore()
  const procurements = useProcurements()
  const { loadWarehouses } = useStockMovements()

  const prCode = route.params.code
  const prResource = useResourceData(ref('PurchaseRequisitions'))
  const itemsResource = useResourceData(ref('PurchaseRequisitionItems'))

  const loading = ref(true)
  const acting = ref('')
  const prForm = ref({})
  const items = ref([])
  const warehouses = ref([])
  const actionComment = ref('')

  const selectedWarehouse = computed(() => warehouses.value.find((warehouse) => warehouse.Code === prForm.value.WarehouseCode) || null)
  const totalQty = computed(() => items.value.reduce((sum, item) => sum + (Number(item.Quantity) || 0), 0))
  const grandTotal = computed(() => items.value.reduce((sum, item) => sum + (Number(item.Quantity) * Number(item.EstimatedRate) || 0), 0))
  const revisionThreadHtml = computed(() => procurements.formatWorkflowCommentHtml(prForm.value.ProgressRevisionRequiredComment || ''))
  const rejectedCommentHtml = computed(() => procurements.formatWorkflowCommentHtml(prForm.value.ProgressRejectedComment || ''))

  function formatDate(value) {
    if (!value) return ''
    try {
      return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return value
    }
  }

  function formatCurrency(value) {
    const amount = Number(value) || 0
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function statusChipStyle(progress) {
    const map = {
      'Pending Approval': { bg: 'rgba(3,105,161,0.14)', fg: '#1D4ED8', border: 'rgba(96,165,250,0.35)' },
      Approved: { bg: 'rgba(22,163,74,0.12)', fg: '#166534', border: 'rgba(34,197,94,0.30)' },
      Rejected: { bg: 'rgba(220,38,38,0.10)', fg: '#B91C1C', border: 'rgba(248,113,113,0.30)' }
    }
    const style = map[progress] || map['Pending Approval']
    return `background:${style.bg};color:${style.fg};border:1px solid ${style.border}`
  }

  async function loadData() {
    loading.value = true
    try {
      await Promise.all([
        prResource.reload(),
        itemsResource.reload(),
        loadWarehouses().then((value) => { warehouses.value = value })
      ])
      const pr = prResource.items.value.find((row) => row.Code === prCode)
      prForm.value = pr ? { ...pr } : {}
      items.value = itemsResource.items.value.filter((item) => item.PurchaseRequisitionCode === prCode)
    } catch (error) {
      $q.notify({ type: 'negative', message: `Failed to load Purchase Requisition: ${error.message}` })
    } finally {
      loading.value = false
    }
  }

  async function loadLatestPurchaseRequisition() {
    await prResource.reload()
    const latest = prResource.items.value.find((row) => row.Code === prCode)
    if (latest) {
      prForm.value = { ...latest }
    }
    return latest || null
  }

  async function runAction(actionKey, confirmMessage) {
    if (actionKey === 'reject' && !actionComment.value.trim()) {
      $q.notify({ type: 'warning', message: 'Reject comment is required.' })
      return
    }

    if (actionKey === 'send-back' && !actionComment.value.trim()) {
      $q.notify({ type: 'warning', message: 'Revision comment is required.' })
      return
    }

    $q.dialog({
      title: 'Confirm Action',
      message: confirmMessage,
      cancel: true,
      persistent: true
    }).onOk(async () => {
      const latestPr = await loadLatestPurchaseRequisition()
      const requestResult = procurements.buildPendingApprovalRequests({
        prCode,
        form: latestPr || prForm.value,
        action: actionKey,
        comment: actionComment.value
      })

      if (!requestResult.success) {
        $q.notify({ type: 'warning', message: requestResult.error })
        return
      }

      acting.value = actionKey
      try {
        const response = await workflowStore.runBatchRequests(requestResult.requests)
        const failed = (response.data || []).find((entry) => entry?.success === false)
        if (!response.success || failed) {
          $q.notify({
            type: 'negative',
            message: failed?.error || failed?.message || response.error || 'Failed to update Purchase Requisition'
          })
          return
        }

        const labelMap = {
          approve: 'Purchase Requisition approved',
          reject: 'Purchase Requisition rejected',
          'send-back': 'Purchase Requisition sent back for revision'
        }
        $q.notify({ type: 'positive', message: labelMap[actionKey] || 'Purchase Requisition updated' })
        actionComment.value = ''
        await loadData()
        nav.goTo('view', { code: prCode })
      } catch (error) {
        $q.notify({ type: 'negative', message: `Failed to update Purchase Requisition: ${error.message}` })
      } finally {
        acting.value = ''
      }
    })
  }

  function approve() {
    return runAction('approve', 'Approve this Purchase Requisition and move the linked Procurement to PR_APPROVED?')
  }

  function reject() {
    return runAction('reject', 'Reject this Purchase Requisition?')
  }

  function sendBack() {
    return runAction('send-back', 'Send this Purchase Requisition back for revision?')
  }

  onMounted(loadData)

  return {
    nav,
    loading,
    acting,
    prForm,
    items,
    warehouses,
    selectedWarehouse,
    actionComment,
    totalQty,
    grandTotal,
    revisionThreadHtml,
    rejectedCommentHtml,
    formatDate,
    formatCurrency,
    statusChipStyle,
    loadData,
    loadLatestPurchaseRequisition,
    approve,
    reject,
    sendBack
  }
}
