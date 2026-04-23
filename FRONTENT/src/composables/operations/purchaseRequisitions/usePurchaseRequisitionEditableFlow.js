import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useStockMovements } from 'src/composables/operations/stock/useStockMovements'
import { useAuthStore } from 'src/stores/auth'
import { useWorkflowStore } from 'src/stores/workflow'
import { useProcurements } from 'src/composables/operations/procurements/useProcurements'
import {
  mapPurchaseRequisitionPriorityOptions,
  mapPurchaseRequisitionTypeOptions,
  purchaseRequisitionNeedsRefCode
} from './purchaseRequisitionMeta'
import { buildPurchaseRequisitionPayload } from './purchaseRequisitionPayload'
import {
  buildPurchaseRequisitionSkuInfo,
  buildRichSkuOptions,
  filterRichSkuOptions
} from './purchaseRequisitionSkuOptions'

function stableStringify(value) {
  return JSON.stringify(value)
}

export function usePurchaseRequisitionEditableFlow() {
  const route = useRoute()
  const $q = useQuasar()
  const nav = useResourceNav()
  const { loadWarehouses } = useStockMovements()
  const auth = useAuthStore()
  const workflowStore = useWorkflowStore()
  const procurements = useProcurements()

  const prCode = route.params.code
  const prResource = useResourceData(ref('PurchaseRequisitions'))
  const itemsResource = useResourceData(ref('PurchaseRequisitionItems'))
  const skusResource = useResourceData(ref('SKUs'))
  const productsResource = useResourceData(ref('Products'))

  const loading = ref(true)
  const saving = ref(false)
  const submitting = ref(false)
  const prForm = ref({})
  const items = ref([])
  const deletedItemCodes = ref([])
  const responseComment = ref('')
  const warehouses = ref([])
  const loadingWarehouses = ref(false)
  const allSkus = ref([])
  const allProducts = ref([])
  const skuInfoByCode = ref({})
  const skuOptions = ref([])
  const itemSearch = ref('')
  const addDialog = ref(false)
  const newItem = ref({ SKU: null, Quantity: 1, EstimatedRate: 0 })
  const focusedField = ref(null)
  const loadedSnapshot = ref('')
  const ready = ref(false)

  let pollTimer = null

  const types = computed(() => mapPurchaseRequisitionTypeOptions(auth.appOptionsMap.PurchaseRequisitionType || []))
  const priorities = computed(() => mapPurchaseRequisitionPriorityOptions(auth.appOptionsMap.PurchaseRequisitionPriority || []))
  const isRevision = computed(() => procurements.isRevisionRequiredProgress(prForm.value.Progress))
  const selectedWarehouse = computed(() => warehouses.value.find((warehouse) => warehouse.Code === prForm.value.WarehouseCode) || null)
  const revisionThread = computed(() => (prForm.value.ProgressRevisionRequiredComment || '').trim())
  const rejectedComment = computed(() => (prForm.value.ProgressRejectedComment || '').trim())
  const revisionThreadHtml = computed(() => procurements.formatWorkflowCommentHtml(revisionThread.value))
  const rejectedCommentHtml = computed(() => procurements.formatWorkflowCommentHtml(rejectedComment.value))
  const needsRefCode = computed(() => purchaseRequisitionNeedsRefCode(prForm.value.Type))

  const filteredItems = computed(() => {
    const keyword = (itemSearch.value || '').trim().toLowerCase()
    if (!keyword) return items.value
    return items.value.filter((item) => {
      const info = skuInfoByCode.value[item.SKU] || {}
      return (item.SKU || '').toLowerCase().includes(keyword)
        || (info.productName || '').toLowerCase().includes(keyword)
        || (info.variantsCsv || '').toLowerCase().includes(keyword)
    })
  })

  const totalQty = computed(() => items.value.reduce((sum, item) => sum + (Number(item.Quantity) || 0), 0))
  const grandTotal = computed(() => items.value.reduce((sum, item) => sum + (Number(item.Quantity) * Number(item.EstimatedRate) || 0), 0))

  function buildSnapshot() {
    const formSnapshot = {
      Type: prForm.value.Type || '',
      Priority: prForm.value.Priority || '',
      WarehouseCode: prForm.value.WarehouseCode || '',
      RequiredDate: prForm.value.RequiredDate || '',
      TypeReferenceCode: prForm.value.TypeReferenceCode || ''
    }

    const itemSnapshot = items.value
      .map((item) => ({
        Code: item.Code || '',
        SKU: item.SKU || '',
        UOM: item.UOM || '',
        Quantity: Number(item.Quantity) || 0,
        EstimatedRate: Number(item.EstimatedRate) || 0
      }))
      .sort((left, right) => {
        const a = left.Code || left.SKU
        const b = right.Code || right.SKU
        return a.localeCompare(b)
      })

    const deletedSnapshot = [...deletedItemCodes.value].sort()
    return stableStringify({ formSnapshot, itemSnapshot, deletedSnapshot })
  }

  const hasUnsavedChanges = computed(() => ready.value && buildSnapshot() !== loadedSnapshot.value)
  const updateCommentRequired = computed(() => isRevision.value && hasUnsavedChanges.value)
  const canUpdate = computed(() => {
    if (!hasUnsavedChanges.value) return false
    if (!items.value.length) return false
    if (needsRefCode.value && !prForm.value.TypeReferenceCode) return false
    if (updateCommentRequired.value && !responseComment.value.trim()) return false
    return true
  })
  const canSubmit = computed(() => {
    if (hasUnsavedChanges.value) return false
    if (!items.value.length) return false
    if (needsRefCode.value && !prForm.value.TypeReferenceCode) return false
    return true
  })

  const itemColumns = computed(() => ([
    { name: 'SKU', label: 'SKU', field: 'SKU', align: 'left' },
    {
      name: 'Description',
      label: 'Description',
      align: 'left',
      field: (row) => {
        const info = skuInfoByCode.value[row.SKU] || {}
        return info.productName || row.SKU
      }
    },
    { name: 'UOM', label: 'UOM', field: 'UOM', align: 'left' },
    { name: 'Quantity', label: 'Quantity', field: 'Quantity', align: 'right' },
    {
      name: 'EstimatedRate',
      label: 'Est. Rate',
      align: 'right',
      field: (row) => formatCurrency(row.EstimatedRate)
    },
    {
      name: 'Total',
      label: 'Total',
      align: 'right',
      field: (row) => formatCurrency((Number(row.Quantity) || 0) * (Number(row.EstimatedRate) || 0))
    },
    { name: 'Actions', label: '', field: 'Actions', align: 'right' }
  ]))

  function statusChipStyle(progress) {
    const map = {
      Draft: { bg: 'rgba(250, 204, 21, 0.18)', fg: '#854d0e', border: 'rgba(250,204,21,0.36)' },
      'Revision Required': { bg: 'rgba(251, 146, 60, 0.16)', fg: '#9a3412', border: 'rgba(251,146,60,0.34)' },
      'Pending Approval': { bg: 'rgba(96, 165, 250, 0.16)', fg: '#1d4ed8', border: 'rgba(96,165,250,0.36)' },
      Approved: { bg: 'rgba(74, 222, 128, 0.14)', fg: '#166534', border: 'rgba(74,222,128,0.34)' },
      Rejected: { bg: 'rgba(248, 113, 113, 0.12)', fg: '#b91c1c', border: 'rgba(248,113,113,0.34)' },
      'RFQ Processed': { bg: 'rgba(148, 163, 184, 0.14)', fg: '#334155', border: 'rgba(148,163,184,0.34)' }
    }
    const style = map[progress] || map.Draft
    return `background:${style.bg};color:${style.fg};border:1px solid ${style.border}`
  }

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

  async function loadData() {
    loading.value = true
    loadingWarehouses.value = true
    ready.value = false
    try {
      await Promise.all([
        prResource.reload(),
        itemsResource.reload(),
        skusResource.reload(),
        productsResource.reload(),
        loadWarehouses().then((value) => { warehouses.value = value })
      ])

      const pr = prResource.items.value.find((row) => row.Code === prCode)
      if (!pr) {
        $q.notify({ type: 'negative', message: 'PR not found' })
        loading.value = false
        return
      }

      prForm.value = { ...pr }
      items.value = itemsResource.items.value
        .filter((item) => item.PurchaseRequisitionCode === prCode)
        .map((item, index) => ({ ...item, _key: item.Code || `new-${index}` }))
      deletedItemCodes.value = []
      responseComment.value = ''

      allSkus.value = skusResource.items.value.filter((sku) => sku.Status === 'Active')
      allProducts.value = productsResource.items.value || []
      skuInfoByCode.value = buildPurchaseRequisitionSkuInfo(allSkus.value, allProducts.value)
      skuOptions.value = buildRichSkuOptions(allSkus.value, skuInfoByCode.value)

      await nextTick()
      loadedSnapshot.value = buildSnapshot()
      ready.value = true
    } catch (error) {
      $q.notify({ type: 'negative', message: `Failed to load: ${error.message}` })
    } finally {
      loading.value = false
      loadingWarehouses.value = false
    }
  }

  function openAddItemDialog() {
    newItem.value = { SKU: null, Quantity: 1, EstimatedRate: 0 }
    addDialog.value = true
  }

  function filterSkus(value, update) {
    update(() => {
      skuOptions.value = filterRichSkuOptions(allSkus.value, skuInfoByCode.value, value)
    })
  }

  function confirmAddItem() {
    if (!newItem.value.SKU || newItem.value.Quantity <= 0) {
      $q.notify({ type: 'warning', message: 'Select a SKU and enter a valid quantity' })
      return
    }

    const skuCode = typeof newItem.value.SKU === 'object' ? newItem.value.SKU.value : newItem.value.SKU
    const skuObj = allSkus.value.find((sku) => sku.Code === skuCode)
    const existing = items.value.find((item) => item.SKU === skuCode)
    const nextQuantity = Number(newItem.value.Quantity) || 0
    const nextEstimatedRate = Number(newItem.value.EstimatedRate) || 0

    if (existing) {
      existing.Quantity = (Number(existing.Quantity) || 0) + nextQuantity
      existing.EstimatedRate = nextEstimatedRate || Number(existing.EstimatedRate) || 0
    } else {
      items.value.push({
        _key: `new-${Date.now()}`,
        SKU: skuCode,
        UOM: skuObj?.UOM || '',
        Quantity: nextQuantity,
        EstimatedRate: nextEstimatedRate
      })
    }

    addDialog.value = false
  }

  function updateItemQuantity(item, value) {
    item.Quantity = Math.max(0, Number(value) || 0)
  }

  function updateItemEstimatedRate(item, value) {
    item.EstimatedRate = Math.max(0, Number(value) || 0)
  }

  function removeItem(item) {
    const actualIndex = items.value.findIndex((entry) => (entry._key || entry.Code) === (item._key || item.Code))
    if (actualIndex === -1) return
    const target = items.value[actualIndex]
    if (target?.Code) deletedItemCodes.value.push(target.Code)
    items.value.splice(actualIndex, 1)
  }

  function buildPayload(targetProgress = prForm.value.Progress, extraFields = {}) {
    return buildPurchaseRequisitionPayload({
      prCode,
      form: prForm.value,
      targetProgress,
      items: items.value,
      deletedItemCodes: deletedItemCodes.value,
      extraFields
    })
  }

  async function updatePr() {
    if (!canUpdate.value) {
      $q.notify({ type: 'warning', message: updateCommentRequired.value ? 'Add a comment before updating this revised PR.' : 'No changes available to update.' })
      return { success: false }
    }

    const extraFields = {}
    if (isRevision.value) {
      extraFields.ProgressRevisionRequiredComment = procurements.appendWorkflowComment(
        prForm.value.ProgressRevisionRequiredComment || '',
        responseComment.value
      )
    }

    saving.value = true
    try {
      const response = await workflowStore.saveComposite(buildPayload(prForm.value.Progress, extraFields))
      if (!response.success) {
        $q.notify({ type: 'negative', message: response.error || response.message || 'Failed to update PR' })
        return { success: false, response }
      }

      $q.notify({ type: 'positive', message: 'Purchase Requisition updated successfully' })
      await loadData()
      return { success: true, response }
    } catch (error) {
      $q.notify({ type: 'negative', message: `Failed to update PR: ${error.message}` })
      return { success: false, response: { error: error.message } }
    } finally {
      saving.value = false
    }
  }

  async function submit() {
    if (!canSubmit.value) {
      $q.notify({ type: 'warning', message: hasUnsavedChanges.value ? 'Update the Purchase Requisition before submitting it.' : 'Add at least one valid item before submitting.' })
      return { success: false }
    }

    return new Promise((resolve) => {
      $q.dialog({
        title: 'Confirm Submit',
        message: 'Submit this Purchase Requisition for approval?',
        cancel: true,
        persistent: true
      }).onOk(async () => {
        const requestResult = procurements.buildEditableSubmitRequests({
          prCode,
          form: prForm.value,
          items: items.value,
          deletedItemCodes: deletedItemCodes.value
        })

        if (!requestResult.success) {
          $q.notify({ type: 'warning', message: requestResult.error })
          resolve({ success: false, response: { error: requestResult.error } })
          return
        }

        submitting.value = true
        try {
          const response = await workflowStore.runBatchRequests(requestResult.requests)
          const failed = (response.data || []).find((entry) => entry?.success === false)
          if (!response.success || failed) {
            const message = failed?.error || failed?.message || response.error || 'Failed to submit PR'
            $q.notify({ type: 'negative', message })
            resolve({ success: false, response: { error: message } })
            return
          }

          $q.notify({ type: 'positive', message: 'Purchase Requisition submitted successfully' })
          await loadData()
          nav.goTo('view', { code: prCode })
          resolve({ success: true, response })
        } catch (error) {
          $q.notify({ type: 'negative', message: `Failed to submit PR: ${error.message}` })
          resolve({ success: false, response: { error: error.message } })
        } finally {
          submitting.value = false
        }
      }).onCancel(() => {
        resolve({ success: false, cancelled: true })
      })
    })
  }

  async function silentRefresh() {
    if (hasUnsavedChanges.value) return
    try {
      await Promise.all([
        prResource.reload(),
        itemsResource.reload()
      ])
      const pr = prResource.items.value.find((row) => row.Code === prCode)
      if (!pr) return
      prForm.value = { ...pr }
      items.value = itemsResource.items.value
        .filter((item) => item.PurchaseRequisitionCode === prCode)
        .map((item, index) => ({ ...item, _key: item.Code || `new-${index}` }))
      deletedItemCodes.value = []
      await nextTick()
      loadedSnapshot.value = buildSnapshot()
    } catch {
      // silent refresh
    }
  }

  onMounted(async () => {
    await loadData()
    pollTimer = setInterval(silentRefresh, 30000)
  })

  onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer)
  })

  return {
    nav,
    loading,
    saving,
    submitting,
    prForm,
    items,
    deletedItemCodes,
    responseComment,
    warehouses,
    loadingWarehouses,
    skuInfoByCode,
    skuOptions,
    itemSearch,
    addDialog,
    newItem,
    focusedField,
    types,
    priorities,
    isRevision,
    revisionThread,
    rejectedComment,
    revisionThreadHtml,
    rejectedCommentHtml,
    filteredItems,
    totalQty,
    grandTotal,
    selectedWarehouse,
    needsRefCode,
    hasUnsavedChanges,
    updateCommentRequired,
    canUpdate,
    canSubmit,
    itemColumns,
    statusChipStyle,
    formatDate,
    formatCurrency,
    openAddItemDialog,
    filterSkus,
    confirmAddItem,
    updateItemQuantity,
    updateItemEstimatedRate,
    removeItem,
    updatePr,
    saveDraft: updatePr,
    submit,
    buildPayload,
    loadData
  }
}

export function usePurchaseRequisitionReviewFlow() {
  return usePurchaseRequisitionEditableFlow()
}
