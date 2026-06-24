import { computed, ref, unref } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useRecord } from 'src/composables/resources/useRecord'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { formatSkuVariants } from 'src/utils/appHelpers'

function text(value) {
  return (value ?? '').toString().trim()
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function storageLabel(value) {
  const raw = text(value)
  return raw === '_default' || !raw ? 'Default' : raw
}

import { useProductSkuResolver } from 'src/composables/masters/products/useProductSkuResolver'

export function useWarehouseStockList(warehouseCodeRef = null) {
  const nav = useResourceNav()
  const { code } = useResourceConfig()
  const warehouses = useRecord(ref('Warehouses'))
  const storages = useRecord(ref('WarehouseStorages'))
  const skus = useRecord(ref('SKUs'))
  const products = useRecord(ref('Products'))
  const searchTerm = ref('')
  const { skuInfo } = useProductSkuResolver()

  const selectedWarehouseCode = computed(() =>
    text(unref(warehouseCodeRef)) || text(code.value)
  )

  const loading = computed(() =>
    warehouses.loading.value ||
    warehouses.backgroundSyncing.value ||
    storages.loading.value ||
    storages.backgroundSyncing.value ||
    skus.loading.value ||
    skus.backgroundSyncing.value ||
    products.loading.value ||
    products.backgroundSyncing.value
  )

  const activeWarehouses = computed(() =>
    warehouses.items.value.filter((warehouse) => warehouse && text(warehouse.Status || 'Active') === 'Active')
  )

  const currentWarehouse = computed(() =>
    activeWarehouses.value.find((warehouse) => warehouse && warehouse.Code === selectedWarehouseCode.value) ||
    warehouses.items.value.find((warehouse) => warehouse && warehouse.Code === selectedWarehouseCode.value) ||
    null
  )

  const stockRows = computed(() => {
    const warehouseCode = selectedWarehouseCode.value
    if (!warehouseCode) return []

    return storages.items.value
      .filter((row) => row && text(row.WarehouseCode) === warehouseCode)
      .map((row) => {
        const info = skuInfo(row.SKU) || {}
        const variants = info.variantValues?.filter(Boolean).join(' / ') || ''
        return {
          ...row, ...info,
          SKUCode: info.skuCode || row.SKU || '',
          VariantValues: info.variantValues || [],
          StorageLabel: storageLabel(row.StorageName),
          QuantityValue: number(row.Quantity),
          ProductName: info.productName || row.ProductName || 'Unknown Product',
          VariantCaption: variants,
          SearchText: [
            row.Code,
            row.SKU,
            storageLabel(row.StorageName),
            info.productName || '',
            variants
          ].map(text).join(' ').toLowerCase()
        }
      })
      .sort((a, b) => `${a.ProductName}${a.SKU}${a.StorageLabel}`.localeCompare(`${b.ProductName}${b.SKU}${b.StorageLabel}`))
  })

  const filteredStockRows = computed(() => {
    const keyword = searchTerm.value.trim().toLowerCase()
    if (!keyword) return stockRows.value
    return stockRows.value.filter((row) => row.SearchText.includes(keyword))
  })

  const warehouseCards = computed(() => {
    const stockByWarehouse = new Map()
    storages.items.value.forEach((row) => {
      if (!row) return
      const warehouseCode = text(row.WarehouseCode)
      if (!warehouseCode) return
      if (!stockByWarehouse.has(warehouseCode)) {
        stockByWarehouse.set(warehouseCode, {
          skuSet: new Set(),
          storageSet: new Set(),
          quantity: 0
        })
      }
      const summary = stockByWarehouse.get(warehouseCode)
      if (text(row.SKU)) summary.skuSet.add(text(row.SKU))
      summary.storageSet.add(storageLabel(row.StorageName))
      summary.quantity += number(row.Quantity)
    })

    return activeWarehouses.value
      .filter(Boolean)
      .map((warehouse) => {
        const summary = stockByWarehouse.get(warehouse.Code) || {
          skuSet: new Set(),
          storageSet: new Set(),
          quantity: 0
        }
        return {
          ...warehouse,
          stockSkuCount: summary.skuSet.size,
          stockStorageCount: summary.storageSet.size,
          stockQuantity: summary.quantity
        }
      })
  })

  const stockSummary = computed(() => ({
    skuCount: new Set(stockRows.value.map((row) => row.SKU).filter(Boolean)).size,
    storageCount: new Set(stockRows.value.map((row) => row.StorageLabel)).size,
    quantity: stockRows.value.reduce((sum, row) => sum + number(row.QuantityValue), 0)
  }))

  async function loadData(forceSync = false) {
    await Promise.all([
      warehouses.reload(forceSync),
      storages.reload(forceSync),
      skus.reload(forceSync),
      products.reload(forceSync)
    ])
  }

  function viewWarehouseStock(warehouseCode) {
    if (!warehouseCode) return
    nav.goTo('record-page', {
      scope: 'masters',
      resourceSlug: 'warehouses',
      code: warehouseCode,
      pageSlug: 'stock'
    })
  }

  function goToStockList() {
    nav.goTo('resource-page', {
      scope: 'masters',
      resourceSlug: 'warehouses',
      pageSlug: 'stock-list'
    })
  }

  return {
    loading,
    searchTerm,
    activeWarehouses,
    currentWarehouse,
    stockRows,
    filteredStockRows,
    warehouseCards,
    stockSummary,
    loadData,
    viewWarehouseStock,
    goToStockList
  }
}
