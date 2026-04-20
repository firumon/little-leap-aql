import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { useStockMovements } from 'src/composables/operations/stock/useStockMovements'
import { useAuthStore } from 'src/stores/auth'
import { useWorkflowStore } from 'src/stores/workflow'
import {
  mapPurchaseRequisitionPriorityOptions,
  mapPurchaseRequisitionTypeOptions
} from './purchaseRequisitionMeta'
import { buildPurchaseRequisitionPayload } from './purchaseRequisitionPayload'
import {
  buildPurchaseRequisitionSkuInfo,
  buildRichSkuOptions,
  filterRichSkuOptions
} from './purchaseRequisitionSkuOptions'

export function usePurchaseRequisitionReviewFlow() {
  const route = useRoute()
  const $q = useQuasar()
  const nav = useResourceNav()
  const { loadWarehouses } = useStockMovements()
  const auth = useAuthStore()
  const workflowStore = useWorkflowStore()

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
  const headerExpanded = ref(false)
  const focusedField = ref(null)
  const hasLocalEdits = ref(false)

  let loadDone = false
  let pollTimer = null

  const types = computed(() => mapPurchaseRequisitionTypeOptions(auth.appOptionsMap.PurchaseRequisitionType || []))

  const priorities = computed(() => mapPurchaseRequisitionPriorityOptions(auth.appOptionsMap.PurchaseRequisitionPriority || []))

  const isRevision = computed(() => ['Review', 'Revision Required', 'Revision'].includes(prForm.value.Progress))
  const filteredItems = computed(() => {
    const keyword = (itemSearch.value || '').toLowerCase()
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
  const headerComplete = computed(() => {
    const form = prForm.value
    if (!form.Type || !form.Priority) return false
    if (['PROJECT', 'SALES'].includes(form.Type) && !form.TypeReferenceCode) return false
    return true
  })
  const selectedWarehouse = computed(() => warehouses.value.find((warehouse) => warehouse.Code === prForm.value.WarehouseCode) || null)

  function statusChipStyle(progress) {
    const map = {
      Draft: { bg: 'rgba(212,168,67,0.16)', fg: '#F2D682' },
      Review: { bg: 'rgba(201,123,26,0.20)', fg: '#FFC58F' },
      'Revision Required': { bg: 'rgba(201,123,26,0.20)', fg: '#FFC58F' },
      New: { bg: 'rgba(26,122,74,0.20)', fg: '#83E3B0' },
      Submitted: { bg: 'rgba(26,122,74,0.20)', fg: '#83E3B0' },
      'Pending Approval': { bg: 'rgba(3,105,161,0.20)', fg: '#93C5FD' },
      Approved: { bg: 'rgba(26,122,74,0.20)', fg: '#83E3B0' },
      Rejected: { bg: 'rgba(192,54,44,0.20)', fg: '#FFA59A' },
      Closed: { bg: 'rgba(71,85,105,0.20)', fg: '#CBD5E1' }
    }
    const style = map[progress] || map.Draft
    return `background:${style.bg};color:${style.fg};border:1px solid rgba(255,255,255,0.08)`
  }

  function statusDotColor(progress) {
    const map = {
      Draft: '#D4A843',
      Review: '#FFB060',
      'Revision Required': '#FFB060',
      New: '#3DD584',
      Submitted: '#3DD584',
      'Pending Approval': '#60A5FA',
      Approved: '#3DD584',
      Rejected: '#FF6B5C',
      Closed: '#94A3B8'
    }
    return map[progress] || '#D4A843'
  }

  function typeIcon(value) {
    return types.value.find((type) => type.value === value)?.icon || 'inventory_2'
  }

  function priorityHexColor(value) {
    return priorities.value.find((priority) => priority.value === value)?.color || '#0F2B4A'
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

  function isOverdue(value) {
    if (!value) return false
    return new Date(value) < new Date()
  }

  async function loadData() {
    loading.value = true
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

      allSkus.value = skusResource.items.value.filter((sku) => sku.Status === 'Active')
      allProducts.value = productsResource.items.value || []

      skuInfoByCode.value = buildPurchaseRequisitionSkuInfo(allSkus.value, allProducts.value)
      skuOptions.value = buildRichSkuOptions(allSkus.value, skuInfoByCode.value)
      headerExpanded.value = !headerComplete.value
    } catch (error) {
      $q.notify({ type: 'negative', message: `Failed to load: ${error.message}` })
    } finally {
      loading.value = false
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
    if (existing) {
      existing.Quantity += newItem.value.Quantity
      $q.notify({ type: 'info', message: `Qty updated for ${skuCode}` })
    } else {
      items.value.push({
        _key: `new-${Date.now()}`,
        SKU: skuCode,
        UOM: skuObj?.UOM || '',
        Quantity: newItem.value.Quantity,
        EstimatedRate: newItem.value.EstimatedRate
      })
    }
    addDialog.value = false
  }

  function removeItem(index) {
    const actualIndex = items.value.indexOf(filteredItems.value[index])
    const item = items.value[actualIndex]
    if (item?.Code) deletedItemCodes.value.push(item.Code)
    items.value.splice(actualIndex, 1)
  }

  function buildPayload(targetProgress) {
    return buildPurchaseRequisitionPayload({
      prCode,
      form: prForm.value,
      targetProgress,
      items: items.value,
      deletedItemCodes: deletedItemCodes.value,
      responseComment: responseComment.value,
      appendResponseComment: isRevision.value
    })
  }

  async function saveDraft() {
    saving.value = true
    try {
      const response = await workflowStore.saveComposite(buildPayload('Draft'))
      if (!response.success) {
        $q.notify({ type: 'negative', message: response.error || response.message || 'Failed to save draft' })
        return { success: false, response }
      }

      $q.notify({ type: 'positive', message: 'Draft saved successfully' })
      deletedItemCodes.value = []
      hasLocalEdits.value = false
      await loadData()
      return { success: true, response }
    } catch (error) {
      $q.notify({ type: 'negative', message: `Failed to save draft: ${error.message}` })
      return { success: false, response: { error: error.message } }
    } finally {
      saving.value = false
    }
  }

  async function submit() {
    if (!items.value.length) {
      $q.notify({ type: 'warning', message: 'Add at least one item before submitting' })
      return { success: false }
    }

    return new Promise((resolve) => {
      $q.dialog({
        title: 'Confirm Submit',
        message: 'Are you sure you want to submit this Purchase Requisition?',
        cancel: true,
        persistent: true
      }).onOk(async () => {
        submitting.value = true
        try {
          const response = await workflowStore.saveComposite(buildPayload('New'))
          if (!response.success) {
            $q.notify({ type: 'negative', message: response.error || response.message || 'Failed to submit PR' })
            resolve({ success: false, response })
            return
          }

          $q.notify({ type: 'positive', message: 'Purchase Requisition submitted successfully' })
          deletedItemCodes.value = []
          hasLocalEdits.value = false
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

  watch([items, prForm], () => {
    if (loadDone) hasLocalEdits.value = true
  }, { deep: true })

  async function silentRefresh() {
    if (hasLocalEdits.value) return
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
    } catch {
      // silent refresh
    }
  }

  onMounted(async () => {
    await loadData()
    await nextTick()
    loadDone = true
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
    headerExpanded,
    focusedField,
    types,
    priorities,
    isRevision,
    filteredItems,
    totalQty,
    grandTotal,
    selectedWarehouse,
    statusChipStyle,
    statusDotColor,
    typeIcon,
    priorityHexColor,
    formatDate,
    formatCurrency,
    isOverdue,
    openAddItemDialog,
    filterSkus,
    confirmAddItem,
    removeItem,
    saveDraft,
    submit,
    buildPayload,
    loadData
  }
}

