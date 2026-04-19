import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { format } from 'date-fns'
import { useStockMovements } from 'src/composables/operations/stock/useStockMovements'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useAuthStore } from 'src/stores/auth'
import { useWorkflowStore } from 'src/stores/workflow'
import { useDataStore } from 'src/stores/data'
import { useResourceData } from 'src/composables/resources/useResourceData'
import { formatSkuVariants, todayIsoSlash, todayLongLabel } from 'src/utils/appHelpers'
import {
  mapPurchaseRequisitionPriorityOptions,
  mapPurchaseRequisitionTypeOptions,
  purchaseRequisitionNeedsRefCode
} from './purchaseRequisitionMeta'
import {
  buildPurchaseRequisitionCreateItemRecords,
  buildPurchaseRequisitionFormData
} from './purchaseRequisitionPayload'

export function usePurchaseRequisitionCreateFlow() {
  const $q = useQuasar()
  const nav = useResourceNav()
  const auth = useAuthStore()
  const workflowStore = useWorkflowStore()
  const dataStore = useDataStore()
  const { loadWarehouses } = useStockMovements()

  const productsResource = useResourceData(ref('Products'))
  const skusResource = useResourceData(ref('SKUs'))
  const stockResource = useResourceData(ref('WarehouseStorages'))
  const prResource = useResourceData(ref('PurchaseRequisitions'))
  const itemResource = useResourceData(ref('PurchaseRequisitionItems'))

  const steps = [
    { n: 1, key: 'setup', label: 'Setup' },
    { n: 2, key: 'items', label: 'Items' },
    { n: 3, key: 'done', label: 'Done' }
  ]

  const currentStep = ref(1)
  const loadingWarehouses = ref(false)
  const warehouses = ref([])
  const loadingItems = ref(false)
  const products = ref([])
  const skus = ref([])
  const stockData = ref([])
  const searchQuery = ref('')
  const itemSort = ref('product')
  const showAllWh = ref(true)
  const saving = ref(false)
  const createdCode = ref('PR26000009')

  const form = ref({
    Type: 'STOCK',
    Priority: 'Medium',
    WarehouseCode: '',
    RequiredDate: '',
    TypeReferenceCode: ''
  })

  const types = computed(() => mapPurchaseRequisitionTypeOptions(auth.appOptionsMap.PurchaseRequisitionType || []))

  const priorities = computed(() => mapPurchaseRequisitionPriorityOptions(auth.appOptionsMap.PurchaseRequisitionPriority || []))

  const selectedType = computed(() => types.value.find((type) => type.value === form.value.Type) || types.value[0])
  const needsRefCode = computed(() => purchaseRequisitionNeedsRefCode(form.value.Type))
  const isStep1Valid = computed(() => !!form.value.Type && !!form.value.Priority && (!needsRefCode.value || !!form.value.TypeReferenceCode))
  const selectedSkusCount = computed(() => skus.value.filter((sku) => sku.requiredQuantity > 0).length)
  const totalQty = computed(() => skus.value.reduce((sum, sku) => sum + (sku.requiredQuantity || 0), 0))
  const warehouseName = computed(() => warehouses.value.find((warehouse) => warehouse.Code === form.value.WarehouseCode)?.Name || '')
  const today = todayIsoSlash()
  const todayFormatted = todayLongLabel()

  async function loadItemsAndStock() {
    loadingItems.value = true
    try {
      await Promise.all([
        productsResource.reload(),
        skusResource.reload(),
        stockResource.reload()
      ])
      products.value = (productsResource.items.value || []).filter((product) => product.Status === 'Active' || !product.Status)
      skus.value = (skusResource.items.value || [])
        .filter((sku) => sku.Status === 'Active' || !sku.Status)
        .map((sku) => ({ ...sku, requiredQuantity: 0 }))
      stockData.value = stockResource.items.value || []

      if (!products.value.length || !skus.value.length) {
        $q.notify({ type: 'warning', message: `Some catalog data is empty. Products: ${products.value.length}, SKUs: ${skus.value.length}` })
      }
    } catch (error) {
      $q.notify({ type: 'negative', message: `Failed to load catalog data: ${error.message}` })
    } finally {
      loadingItems.value = false
    }
  }

  function goToStep2() {
    if (!isStep1Valid.value) return
    showAllWh.value = !form.value.WarehouseCode
    currentStep.value = 2
    if (products.value.length === 0) {
      loadItemsAndStock()
    }
  }

  function getSkuStock(skuCode) {
    let rows = stockData.value.filter((stock) => stock.SKU === skuCode)
    if (!showAllWh.value && form.value.WarehouseCode) {
      rows = rows.filter((stock) => stock.WarehouseCode === form.value.WarehouseCode)
    }
    return rows.reduce((sum, item) => sum + (Number(item.Quantity) || 0), 0)
  }

  function stockClass(skuCode) {
    const stock = getSkuStock(skuCode)
    if (stock === 0) return 'text-negative'
    if (stock < 5) return 'text-warning'
    return 'text-grey-6'
  }

  const sortedItems = computed(() => {
    let filtered = skus.value
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      filtered = filtered.filter((sku) => {
        const product = products.value.find((entry) => entry.Code === sku.ProductCode)
        const productName = product ? product.Name.toLowerCase() : ''
        return sku.Code.toLowerCase().includes(query)
          || productName.includes(query)
          || formatSkuVariants(sku).toLowerCase().includes(query)
      })
    }

    const grouped = {}
    filtered.forEach((sku) => {
      if (!grouped[sku.ProductCode]) {
        const product = products.value.find((entry) => entry.Code === sku.ProductCode)
        grouped[sku.ProductCode] = {
          ProductCode: sku.ProductCode,
          ProductName: product ? product.Name : 'Unknown Product',
          skus: [],
          totalStock: 0
        }
      }
      grouped[sku.ProductCode].skus.push(sku)
      grouped[sku.ProductCode].totalStock += getSkuStock(sku.Code)
    })

    return Object.values(grouped).sort((left, right) => {
      if (itemSort.value === 'sku') {
        const leftMax = left.skus.reduce((max, sku) => Math.max(max, getSkuStock(sku.Code)), 0)
        const rightMax = right.skus.reduce((max, sku) => Math.max(max, getSkuStock(sku.Code)), 0)
        return leftMax - rightMax
      }
      return (left.totalStock ?? 0) - (right.totalStock ?? 0)
    })
  })

  function viewCreatedPR() {
    nav.goTo('view', { code: createdCode.value })
  }

  async function savePR() {
    const itemsToSave = skus.value.filter((sku) => sku.requiredQuantity > 0)
    if (!itemsToSave.length) return

    saving.value = true
    try {
      const prDate = format(new Date(), 'yyyy-MM-dd')
      const batchResponse = await workflowStore.runBatchRequests([
        {
          action: 'compositeSave',
          resource: 'PurchaseRequisitions',
          scope: 'operation',
          data: {
            ...buildPurchaseRequisitionFormData({
              ...form.value,
              TypeReferenceCode: needsRefCode.value ? form.value.TypeReferenceCode : ''
            }, { targetProgress: 'Draft' }),
            PRDate: prDate,
            Status: 'Active'
          },
          children: [{
            resource: 'PurchaseRequisitionItems',
            records: buildPurchaseRequisitionCreateItemRecords(itemsToSave)
          }]
        },
        { action: 'get', resource: 'PurchaseRequisitions', scope: 'operation', includeInactive: true },
        { action: 'get', resource: 'PurchaseRequisitionItems', scope: 'operation', includeInactive: true }
      ])

      const saveResult = batchResponse?.data?.[0]
      const prResult = batchResponse?.data?.[1]
      const itemResult = batchResponse?.data?.[2]

      if (saveResult?.success && saveResult?.data?.parentCode) {
        createdCode.value = saveResult.data.parentCode

        const prHeaders = prResource.lastHeaders.value || []
        const itemHeaders = itemResource.lastHeaders.value || []
        if (prResult?.rows?.length && prHeaders.length) {
          await dataStore.cacheResourceRows('PurchaseRequisitions', prHeaders, prResult.rows)
        }
        if (itemResult?.rows?.length && itemHeaders.length) {
          await dataStore.cacheResourceRows('PurchaseRequisitionItems', itemHeaders, itemResult.rows)
        }

        $q.notify({ type: 'positive', message: 'Purchase Requisition Created' })
        currentStep.value = 3
      } else {
        $q.notify({ type: 'negative', message: saveResult?.message || saveResult?.error || 'Failed to create PR' })
      }
    } catch (error) {
      $q.notify({ type: 'negative', message: `Failed to create PR: ${error.message}` })
    } finally {
      saving.value = false
    }
  }

  onMounted(async () => {
    loadingWarehouses.value = true
    warehouses.value = await loadWarehouses()
    loadingWarehouses.value = false
  })

  return {
    steps,
    currentStep,
    loadingWarehouses,
    warehouses,
    form,
    types,
    priorities,
    selectedType,
    needsRefCode,
    isStep1Valid,
    goToStep2,
    loadingItems,
    products,
    skus,
    stockData,
    searchQuery,
    itemSort,
    showAllWh,
    saving,
    sortedItems,
    selectedSkusCount,
    totalQty,
    warehouseName,
    today,
    todayFormatted,
    createdCode,
    getSkuStock,
    stockClass,
    viewCreatedPR,
    savePR
  }
}

