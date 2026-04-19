import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useWorkflowStore } from 'src/stores/workflow'
import { useStockMovements } from 'src/composables/operations/stock/useStockMovements'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { buildPurchaseRequisitionPayload } from './purchaseRequisitionPayload'
import { buildCodeOnlySkuOptions, filterCodeOnlySkuOptions } from './purchaseRequisitionSkuOptions'

export function usePurchaseRequisitionDraftFlow() {
  const route = useRoute()
  const nav = useResourceNav()
  const $q = useQuasar()
  const workflowStore = useWorkflowStore()
  const { loadWarehouses } = useStockMovements()

  const prCode = route.params.code
  const prForm = ref({})
  const items = ref([])
  const originalItems = ref([])
  const deletedItemCodes = ref([])
  const saving = ref(false)
  const submitting = ref(false)
  const loading = ref(true)
  const responseComment = ref('')
  const warehouses = ref([])
  const allSkus = ref([])
  const skuOptions = ref([])
  const showAddItemDialog = ref(false)
  const newItem = ref({ SKU: null, Quantity: 1, EstimatedRate: 0 })

  const prResource = useResourceData(ref('PurchaseRequisitions'))
  const itemsResource = useResourceData(ref('PurchaseRequisitionItems'))
  const skusResource = useResourceData(ref('SKUs'))

  const warehouseOptions = computed(() => warehouses.value.map((warehouse) => ({ label: `${warehouse.Name} (${warehouse.Code})`, value: warehouse.Code })))

  const itemColumns = [
    { name: 'SKU', label: 'SKU', field: 'SKU', align: 'left' },
    { name: 'UOM', label: 'UOM', field: 'UOM', align: 'left' },
    { name: 'Quantity', label: 'Quantity', field: 'Quantity', align: 'left' },
    { name: 'EstimatedRate', label: 'Estimated Rate', field: 'EstimatedRate', align: 'left' },
    { name: 'Total', label: 'Total', field: (row) => (row.Quantity * row.EstimatedRate).toFixed(2), align: 'left' },
    { name: 'Actions', label: 'Actions', align: 'right' }
  ]

  function progressColor(progress) {
    if (progress === 'Draft') return 'grey'
    if (progress === 'Review') return 'warning'
    return 'primary'
  }

  function goBack() {
    nav.goTo('list')
  }

  async function loadData() {
    loading.value = true
    try {
      await Promise.all([
        prResource.reload(),
        itemsResource.reload(),
        skusResource.reload(),
        loadWarehouses().then((value) => { warehouses.value = value })
      ])

      const prRecord = prResource.getRecordByCode(prCode)
      if (prRecord) {
        prForm.value = prRecord
        if (!['Draft', 'Review'].includes(prForm.value.Progress)) {
          nav.goTo('view')
        }
      } else {
        $q.notify({ type: 'negative', message: 'PR not found' })
        nav.goTo('list')
        return
      }

      items.value = itemsResource.items.value.filter((item) => item.PurchaseRequisitionCode === prCode)
      originalItems.value = JSON.parse(JSON.stringify(items.value))
      allSkus.value = skusResource.items.value.filter((sku) => sku.Status === 'Active')
      skuOptions.value = buildCodeOnlySkuOptions(allSkus.value)
    } catch {
      $q.notify({ type: 'negative', message: 'Failed to load PR details' })
    } finally {
      loading.value = false
    }
  }

  function filterSkus(value, update) {
    update(() => {
      skuOptions.value = filterCodeOnlySkuOptions(allSkus.value, value)
    })
  }

  function confirmAddItem() {
    if (!newItem.value.SKU || newItem.value.Quantity <= 0) {
      $q.notify({ type: 'warning', message: 'Please select a valid SKU and positive quantity' })
      return
    }

    const existing = items.value.find((item) => item.SKU === newItem.value.SKU.value)
    if (existing) {
      existing.Quantity += newItem.value.Quantity
    } else {
      items.value.push({
        SKU: newItem.value.SKU.value,
        UOM: newItem.value.SKU.UOM || '',
        Quantity: newItem.value.Quantity,
        EstimatedRate: newItem.value.EstimatedRate
      })
    }

    showAddItemDialog.value = false
    newItem.value = { SKU: null, Quantity: 1, EstimatedRate: 0 }
  }

  function removeItem(index) {
    const item = items.value[index]
    if (item.Code) {
      deletedItemCodes.value.push(item.Code)
    }
    items.value.splice(index, 1)
  }

  function buildPayload(targetProgress = prForm.value.Progress) {
    return buildPurchaseRequisitionPayload({
      prCode,
      form: prForm.value,
      targetProgress,
      items: items.value,
      deletedItemCodes: deletedItemCodes.value,
      responseComment: responseComment.value,
      appendResponseComment: prForm.value.Progress === 'Review'
    })
  }

  async function saveDraft() {
    saving.value = true
    try {
      const response = await workflowStore.saveComposite(buildPayload())
      if (response.success) {
        $q.notify({ type: 'positive', message: 'Draft saved successfully' })
        deletedItemCodes.value = []
        await loadData()
      }
    } catch (error) {
      $q.notify({ type: 'negative', message: `Failed to save draft: ${error.message}` })
    } finally {
      saving.value = false
    }
  }

  async function submitPR() {
    if (items.value.length === 0) {
      $q.notify({ type: 'warning', message: 'Add at least one item before submitting' })
      return
    }

    $q.dialog({
      title: 'Confirm Submit',
      message: 'Are you sure you want to submit this Purchase Requisition? It will move out of Draft status.',
      cancel: true,
      persistent: true
    }).onOk(async () => {
      submitting.value = true
      try {
        const response = await workflowStore.saveComposite(buildPayload('New'))
        if (response.success) {
          $q.notify({ type: 'positive', message: 'PR Submitted successfully' })
          nav.goTo('view')
        }
      } catch (error) {
        $q.notify({ type: 'negative', message: `Failed to submit PR: ${error.message}` })
      } finally {
        submitting.value = false
      }
    })
  }

  onMounted(() => {
    loadData()
  })

  return {
    prCode,
    prForm,
    items,
    originalItems,
    deletedItemCodes,
    saving,
    submitting,
    loading,
    responseComment,
    warehouses,
    warehouseOptions,
    allSkus,
    skuOptions,
    showAddItemDialog,
    newItem,
    itemColumns,
    progressColor,
    goBack,
    loadData,
    filterSkus,
    confirmAddItem,
    removeItem,
    buildPayload,
    saveDraft,
    submitPR
  }
}

