import { ref, computed } from 'vue'
import { useResourceData } from '../../resources/useResourceData.js'
import { useResourceNav } from '../../resources/useResourceNav.js'
import { useWorkflowStore } from '../../../stores/workflow.js'
import { OUTLET_OPERATION_RESOURCES, active, sortTime, text } from './outletOperationsMeta.js'
import { toNumber } from './outletStockLogic.js'

export function useOutletStock() {
  const workflowStore = useWorkflowStore(); const nav = useResourceNav(); const storages = useResourceData(ref('OutletStorages')); const movements = useResourceData(ref('OutletMovements')); const outlets = useResourceData(ref('Outlets')); const skus = useResourceData(ref('SKUs'))
  const loading = ref(false); const searchTerm = ref(''); const selectedOutletCode = ref(''); const showZero = ref(false)
  const stockRows = computed(() => storages.items.value.filter(row => (!selectedOutletCode.value || row.OutletCode === selectedOutletCode.value) && (showZero.value || toNumber(row.Quantity) !== 0)).filter(row => !searchTerm.value || JSON.stringify(row).toLowerCase().includes(searchTerm.value.toLowerCase())).sort((a, b) => text(a.OutletCode).localeCompare(text(b.OutletCode)) || text(a.SKU).localeCompare(text(b.SKU))))
  const outletOptions = computed(() => outlets.items.value.filter(active).map(row => ({ label: `${row.Code} · ${row.Name}`, value: row.Code })))
  const movementTimeline = computed(() => movements.items.value.filter(active).filter(row => !selectedOutletCode.value || row.OutletCode === selectedOutletCode.value).sort((a, b) => sortTime(b) - sortTime(a)))
  const totalQty = computed(() => stockRows.value.reduce((sum, row) => sum + toNumber(row.Quantity), 0))
  async function reload(forceSync = false) { loading.value = true; try { await workflowStore.fetchResources(OUTLET_OPERATION_RESOURCES, { includeInactive: true, forceSync }) } finally { loading.value = false } }
  function skuLabel(code) { const sku = skus.items.value.find(row => row.Code === code); return sku ? `${sku.Code} · ${sku.Variant1 || sku.ProductCode || ''}` : code } function outletLabel(code) { const outlet = outlets.items.value.find(row => row.Code === code); return outlet ? `${outlet.Code} · ${outlet.Name}` : code } function getStorage(code) { return storages.items.value.find(row => row.Code === code) || null } function selectOutlet(code) { selectedOutletCode.value = code || '' } function navigateTo(code) { nav.goTo('view', { code }) }
  return { loading, searchTerm, selectedOutletCode, showZero, stockRows, outletOptions, movementTimeline, totalQty, reload, skuLabel, outletLabel, getStorage, selectOutlet, navigateTo }
}
