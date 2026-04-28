import { computed, ref } from 'vue'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { useResourceData } from 'src/composables/resources/useResourceData'
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

export function useWarehouseStockList() {
  const nav = useResourceNav()
  const { code } = useResourceConfig()
  const warehouses = useResourceData(ref('Warehouses'))
  const storages = useResourceData(ref('WarehouseStorages'))
  const skus = useResourceData(ref('SKUs'))
  const products = useResourceData(ref('Products'))
  const searchTerm = ref('')

  const loading = computed(() =>
    warehouses.loading.value ||
    storages.loading.value ||
    skus.loading.value ||
    products.loading.value
  )

  const productByCode = computed(() => new Map(products.items.value.map((product) => [product.Code, product])))
  const skuByCode = computed(() => new Map(skus.items.value.map((sku) => [sku.Code, sku])))

  const activeWarehouses = computed(() =>
    warehouses.items.value.filter((warehouse) => text(warehouse.Status || 'Active') === 'Active')
  )

  const currentWarehouse = computed(() =>
    activeWarehouses.value.find((warehouse) => warehouse.Code === code.value) ||
    warehouses.items.value.find((warehouse) => warehouse.Code === code.value) ||
    null
  )

  const stockRows = computed(() => {
    const warehouseCode = code.value
    if (!warehouseCode) return []

    return storages.items.value
      .filter((row) => text(row.WarehouseCode) === warehouseCode)
      .map((row) => {
        const sku = skuByCode.value.get(row.SKU) || {}
        const product = productByCode.value.get(sku.ProductCode) || {}
        return {
          ...row,
          StorageLabel: storageLabel(row.StorageName),
          QuantityValue: number(row.Quantity),
          ProductName: product.Name || row.ProductName || sku.ProductName || 'Unknown Product',
          VariantCaption: formatSkuVariants(sku),
          SearchText: [
            row.Code,
            row.SKU,
            storageLabel(row.StorageName),
            product.Name,
            formatSkuVariants(sku)
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

    return activeWarehouses.value.map((warehouse) => {
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
