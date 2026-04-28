import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useDataStore } from 'src/stores/data'
import { useWorkflowStore } from 'src/stores/workflow'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useStockMovements } from './useStockMovements'

function text(value) {
  return (value ?? '').toString().trim()
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function storageSubmitValue(value) {
  const raw = text(typeof value === 'object' ? value?.value : value)
  return raw || '_default'
}

function storageUiValue(value) {
  const raw = text(value)
  return raw === '_default' ? '' : raw
}

export function useGrnStockEntry() {
  const $q = useQuasar()
  const dataStore = useDataStore()
  const workflowStore = useWorkflowStore()
  const nav = useResourceNav()
  const stockMovements = useStockMovements()

  const loading = ref(false)
  const submitting = ref(false)
  const warehouses = ref([])
  const selectedWarehouse = ref(null)
  const selectedGrnCode = ref('')
  const skus = ref([])
  const storages = ref([])
  const allocations = ref([])

  const goodsReceipts = computed(() => dataStore.getRecords('GoodsReceipts'))
  const goodsReceiptItems = computed(() => dataStore.getRecords('GoodsReceiptItems'))
  const purchaseOrders = computed(() => dataStore.getRecords('PurchaseOrders'))
  const stockMovementRows = computed(() => dataStore.getRecords('StockMovements'))

  const skuByCode = computed(() => new Map(skus.value.map((sku) => [sku.SKU || sku.Code, sku])))
  const purchaseOrderByCode = computed(() => new Map(purchaseOrders.value.map((po) => [po.Code, po])))
  const postedGrnCodes = computed(() => new Set(
    stockMovementRows.value
      .filter((row) => text(row.ReferenceType).toUpperCase() === 'GRN' && text(row.ReferenceCode))
      .map((row) => text(row.ReferenceCode))
  ))

  const eligibleGrns = computed(() => {
    const warehouseCode = selectedWarehouse.value?.Code || ''
    if (!warehouseCode) return []

    return goodsReceipts.value
      .filter((grn) => text(grn.Status || 'Active') === 'Active')
      .filter((grn) => !postedGrnCodes.value.has(text(grn.Code)))
      .filter((grn) => {
        const po = purchaseOrderByCode.value.get(grn.PurchaseOrderCode)
        return text(po?.ShipToWarehouseCode) === warehouseCode
      })
      .map((grn) => {
        const po = purchaseOrderByCode.value.get(grn.PurchaseOrderCode)
        return {
          ...grn,
          label: `${grn.Code} - ${po?.Code || grn.PurchaseOrderCode || 'PO'}`
        }
      })
  })

  const selectedGrn = computed(() => eligibleGrns.value.find((grn) => grn.Code === selectedGrnCode.value) || null)

  const selectedItems = computed(() => {
    if (!selectedGrn.value) return []
    return goodsReceiptItems.value
      .filter((item) => item.GoodsReceiptCode === selectedGrn.value.Code && text(item.Status || 'Active') === 'Active')
      .filter((item) => number(item.Qty) > 0)
      .map((item) => {
        const sku = skuByCode.value.get(item.SKU) || {}
        return {
          ...item,
          Qty: number(item.Qty),
          ProductName: sku.ProductName || item.ProductName || item.SKU,
          VariantCaption: sku.label || item.SKU
        }
      })
  })

  const storageOptions = computed(() => {
    const names = new Set([''])
    storages.value.forEach((row) => {
      const name = storageUiValue(row.StorageName)
      if (name) names.add(name)
    })
    allocations.value.forEach((row) => {
      const name = storageUiValue(row.storageName)
      if (name) names.add(name)
    })
    return Array.from(names).map((name) => ({
      label: name || 'Default',
      value: name
    }))
  })

  const allocationGroups = computed(() => {
    const groups = {}
    allocations.value.forEach((row) => {
      if (!groups[row.itemCode]) groups[row.itemCode] = []
      groups[row.itemCode].push(row)
    })
    return groups
  })

  const allocationSummary = computed(() => {
    const summary = {}
    selectedItems.value.forEach((item) => {
      const rows = allocationGroups.value[item.Code] || []
      const allocated = rows.reduce((sum, row) => sum + number(row.qty), 0)
      summary[item.Code] = {
        required: number(item.Qty),
        allocated,
        remaining: number(item.Qty) - allocated
      }
    })
    return summary
  })

  const canSubmit = computed(() => {
    if (!selectedWarehouse.value || !selectedGrn.value || !selectedItems.value.length) return false
    return selectedItems.value.every((item) => {
      const summary = allocationSummary.value[item.Code]
      return summary && Math.abs(summary.remaining) < 0.00001 && summary.allocated > 0
    })
  })

  async function loadInitialData(forceSync = false) {
    loading.value = true
    try {
      const [warehouseRows, skuRows] = await Promise.all([
        stockMovements.loadWarehouses(),
        stockMovements.loadSkusWithProducts(),
        workflowStore.fetchResources(['GoodsReceipts', 'GoodsReceiptItems', 'PurchaseOrders', 'StockMovements'], { includeInactive: true, forceSync })
      ])
      warehouses.value = warehouseRows
      skus.value = skuRows
    } finally {
      loading.value = false
    }
  }

  async function selectWarehouse(warehouse) {
    selectedWarehouse.value = warehouse
    selectedGrnCode.value = ''
    allocations.value = []
    storages.value = warehouse?.Code
      ? await stockMovements.loadStoragesForWarehouse(warehouse.Code)
      : []
  }

  function selectGrn(code) {
    selectedGrnCode.value = code || ''
    allocations.value = selectedItems.value.map((item) => ({
      id: `${item.Code}_${Date.now()}_${Math.random()}`,
      itemCode: item.Code,
      sku: item.SKU,
      storageName: '',
      qty: number(item.Qty)
    }))
  }

  function itemByCode(itemCode) {
    return selectedItems.value.find((item) => item.Code === itemCode) || null
  }

  function normalizeAllocations(itemCode, changedRowId = '') {
    const item = itemByCode(itemCode)
    if (!item) return

    const required = number(item.Qty)
    const rows = allocations.value.filter((row) => row.itemCode === itemCode)
    if (!rows.length) {
      allocations.value.push({
        id: `${itemCode}_${Date.now()}_${Math.random()}`,
        itemCode,
        sku: item.SKU,
        storageName: '',
        qty: required
      })
      return
    }

    rows.forEach((row) => {
      row.qty = Math.max(0, number(row.qty))
    })

    const changedIndex = Math.max(0, rows.findIndex((row) => row.id === changedRowId))
    let usedThroughChanged = 0
    for (let i = 0; i <= changedIndex; i++) {
      rows[i].qty = Math.min(rows[i].qty, Math.max(required - usedThroughChanged, 0))
      usedThroughChanged += rows[i].qty
    }

    let remaining = Math.max(required - usedThroughChanged, 0)
    for (let i = changedIndex + 1; i < rows.length; i++) {
      rows[i].qty = Math.min(number(rows[i].qty), remaining)
      remaining -= rows[i].qty
    }

    if (remaining > 0) {
      const emptyFollower = rows.slice(changedIndex + 1).find((row) => number(row.qty) === 0)
      if (emptyFollower) {
        emptyFollower.qty = remaining
        remaining = 0
      }
    }

    if (remaining > 0) {
      rows.push({
        id: `${itemCode}_${Date.now()}_${Math.random()}`,
        itemCode,
        sku: item.SKU,
        storageName: '',
        qty: remaining
      })
      allocations.value.push(rows[rows.length - 1])
    }

    allocations.value = allocations.value.filter((row) => row.itemCode !== itemCode || rows.includes(row))
  }

  function updateAllocation(rowId, patch = {}) {
    const row = allocations.value.find((entry) => entry.id === rowId)
    if (!row) return
    Object.assign(row, patch)
    normalizeAllocations(row.itemCode, rowId)
  }

  function addAllocation(itemCode) {
    const item = itemByCode(itemCode)
    if (!item) return
    allocations.value.push({
      id: `${itemCode}_${Date.now()}_${Math.random()}`,
      itemCode,
      sku: item.SKU,
      storageName: '',
      qty: 0
    })
    normalizeAllocations(itemCode)
  }

  function removeAllocation(rowId) {
    const row = allocations.value.find((entry) => entry.id === rowId)
    if (!row) return
    const siblingCount = allocations.value.filter((entry) => entry.itemCode === row.itemCode).length
    if (siblingCount <= 1) return
    allocations.value = allocations.value.filter((entry) => entry.id !== rowId)
    normalizeAllocations(row.itemCode)
  }

  function currentStockFor(row) {
    const storageName = storageSubmitValue(row.storageName)
    const match = storages.value.find((storage) =>
      text(storage.WarehouseCode) === text(selectedWarehouse.value?.Code) &&
      text(storage.SKU) === text(row.sku) &&
      storageSubmitValue(storage.StorageName) === storageName
    )
    return number(match?.Quantity)
  }

  async function submit() {
    if (!canSubmit.value) {
      $q.notify({ type: 'warning', message: 'Allocate all GRN quantities before posting.', position: 'top' })
      return
    }

    submitting.value = true
    try {
      const rows = allocations.value
        .filter((row) => number(row.qty) > 0)
        .map((row) => ({
          sku: row.sku,
          storageName: storageSubmitValue(row.storageName),
          qtyChange: number(row.qty)
        }))

      const result = await stockMovements.submitBatch({
        warehouseCode: selectedWarehouse.value.Code,
        referenceType: 'GRN',
        referenceCode: selectedGrn.value.Code
      }, rows)

      if (result.succeeded > 0) {
        const warehouseCode = selectedWarehouse.value.Code
        selectedGrnCode.value = ''
        allocations.value = []
        nav.goTo('record-page', {
          scope: 'masters',
          resourceSlug: 'warehouses',
          code: warehouseCode,
          pageSlug: 'stock'
        })
      }
    } finally {
      submitting.value = false
    }
  }

  return {
    loading,
    submitting,
    warehouses,
    selectedWarehouse,
    selectedGrnCode,
    eligibleGrns,
    selectedGrn,
    selectedItems,
    allocations,
    allocationGroups,
    allocationSummary,
    storageOptions,
    canSubmit,
    loadInitialData,
    selectWarehouse,
    selectGrn,
    updateAllocation,
    addAllocation,
    removeAllocation,
    currentStockFor,
    submit
  }
}
