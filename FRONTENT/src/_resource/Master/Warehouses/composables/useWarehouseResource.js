import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { defineSharedComposable } from 'src/utils/appHelpers'

// Pure Warehouse enrichment function
export const enrichWarehouse = (wh) => {
  if (!wh || !wh.Code) return null
  const type = wh.Type || 'Main'
  const isMain = type.trim().toLowerCase() === 'main'

  return {
    // Every raw sheet column, untouched — an enricher decorates, it never narrows
    // (CORE_ARCHITECTURE_RULES §6, Non-Destructive Entity Travel).
    ...wh,

    code: wh.Code,
    warehouseCode: wh.Code,
    name: wh.Name || '',
    area: wh.Area || '',
    city: wh.City || '',
    province: wh.Province || '',
    country: wh.Country || '',
    type,
    isMain,
    licence: wh.Licence || '',
    taxRegistrationNumber: wh.TaxRegistrationNumber || '',
    taxRegistrationName: wh.TaxRegistrationName || '',
    accessRegion: wh.AccessRegion || '',
    status: wh.Status || 'Active',
    createdAt: wh.CreatedAt || '',
    updatedAt: wh.UpdatedAt || '',
    createdBy: wh.CreatedBy || '',
    updatedBy: wh.UpdatedBy || '',
    _raw: wh
  }
}

// Composable for Warehouses master resource//
// ONCE PER APP (CORE_ARCHITECTURE_RULES §6) — see `useSkuResource` for the rationale.
const shared = defineSharedComposable((dataStore) => {

  const warehouses = computed(() => {
    const raw = dataStore.getRecords('Warehouses') || []
    return raw.map(enrichWarehouse).filter(Boolean)
  })

  const activeWarehouses = computed(() => warehouses.value.filter((w) => w.status === 'Active'))

  const mainWarehouse = computed(() => {
    return activeWarehouses.value.find((w) => w.isMain) || activeWarehouses.value[0] || null
  })

  const warehouseMap = computed(() => new Map(warehouses.value.map((w) => [w.code, w])))

  const getWarehouse = (code) => {
    if (!code) return null
    return warehouseMap.value.get(code) || null
  }

  // Options for any Warehouse selector. Built once per app (CORE_ARCHITECTURE_RULES §6).
  const warehouseOptions = computed(() => activeWarehouses.value.map((warehouse) => ({
    label: [warehouse.code, warehouse.name].filter(Boolean).join(' · '),
    value: warehouse.code
  })))

  return {
    warehouses,
    allWarehouses: warehouses,
    activeWarehouses,
    warehouseOptions,
    mainWarehouse,
    warehouseMap,
    getWarehouse
  }
})

export function useWarehouseResource() {
  return shared(useDataStore())
}
