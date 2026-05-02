import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../../../stores/auth.js'
import { useResourceData } from '../../resources/useResourceData.js'
import { useResourceNav } from '../../resources/useResourceNav.js'
import { useWorkflowStore } from '../../../stores/workflow.js'
import { OUTLET_OPERATION_RESOURCES, DELIVERY_PROGRESS_ORDER, active, progressMeta, sortTime, text } from './outletOperationsMeta.js'
import { aggregateItemsBySku, parseItemsJSON, parseStorageAllocations, validateDelivery, toNumber } from './outletStockLogic.js'
import { buildCancelDeliveryBatchRequests, buildDeliverDeliveryBatchRequests, buildScheduleDeliveryBatchRequests } from './outletRestockPayload.js'
import { batchResultCode, failureMessage, responseFailed } from './outletOperationsBatch.js'

export function useOutletDeliveries() {
  const $q = useQuasar()
  const workflowStore = useWorkflowStore()
  const authStore = useAuthStore()
  const nav = useResourceNav()
  const deliveries = useResourceData(ref('OutletDeliveries'))
  const restocks = useResourceData(ref('OutletRestocks'))
  const restockItems = useResourceData(ref('OutletRestockItems'))
  const outlets = useResourceData(ref('Outlets'))
  const skus = useResourceData(ref('SKUs'))
  const products = useResourceData(ref('Products'))
  const warehouses = useResourceData(ref('Warehouses'))
  const loading = ref(false)
  const saving = ref(false)
  const searchTerm = ref('')
  const selectedRestockCode = ref('')
  const selectedWarehouseCode = ref('')
  const rows = ref([])
  const expandedGroup = ref('SCHEDULED')

  const items = computed(() => deliveries.items.value.filter(active).filter(matchesSearch).sort((a, b) => sortTime(b) - sortTime(a)))
  const groups = computed(() => DELIVERY_PROGRESS_ORDER.map(key => ({ key, meta: progressMeta(key), items: items.value.filter(row => (DELIVERY_PROGRESS_ORDER.includes(text(row.Progress)) ? text(row.Progress) : 'OTHER') === key) })).filter(group => group.items.length || group.key === 'SCHEDULED'))
  const eligibleRestocks = computed(() => restocks.items.value.filter(active).filter(row => ['APPROVED', 'PARTIALLY_DELIVERED'].includes(text(row.Progress))).filter(row => !deliveries.items.value.some(od => active(od) && text(od.OutletRestockCode) === text(row.Code) && text(od.Progress) === 'SCHEDULED')))
  const selectedRestock = computed(() => restocks.items.value.find(row => text(row.Code) === text(selectedRestockCode.value)) || null)
  const warehouseOptions = computed(() => warehouses.items.value.filter(active).map(row => ({ label: `${row.Code} · ${row.Name || 'Warehouse'}`, value: row.Code })))
  const selectedItemRows = computed(() => restockItems.items.value.filter(row => text(row.OutletRestockCode) === text(selectedRestockCode.value)).filter(active))
  const selectedItemsJSON = computed(() => JSON.stringify(rows.value.map(row => ({ sku: row.SKU, storage: row.StorageName, qty: toNumber(row.Qty || row.Quantity) })).filter(row => row.sku && row.qty > 0)))

  function currentUserName() { const user = authStore.user || {}; return text(user.Name || user.name || user.UserName || user.Username || user.email || user.Email || user.UserID || user.Code) }
  function outletName(code) { const outlet = outlets.items.value.find(row => text(row.Code) === text(code)); return outlet?.Name || code }
  function skuLabel(code) { const sku = skus.items.value.find(row => text(row.Code) === text(code)); const product = products.items.value.find(row => text(row.Code) === text(sku?.ProductCode)); const variants = [sku?.Variant1, sku?.Variant2, sku?.Variant3, sku?.Variant4, sku?.Variant5].map(text).filter(Boolean).join(' / '); return `${code}${product?.Name ? ` · ${product.Name}` : ''}${variants ? ` · ${variants}` : ''}` }
  function itemsSummary(value) { const items = aggregateItemsBySku(value); const qty = items.reduce((total, item) => total + toNumber(item.qty), 0); return `${items.length} SKU${items.length === 1 ? '' : 's'} · Qty ${qty}` }
  function restockCardSummary(restock = {}) { const children = restockItems.items.value.filter(row => text(row.OutletRestockCode) === text(restock.Code)).filter(active); return `${children.length} item${children.length === 1 ? '' : 's'} · ${progressMeta(restock.Progress).label}` }
  function matchesSearch(row = {}) { const needle = searchTerm.value.toLowerCase(); return !needle || JSON.stringify(row).toLowerCase().includes(needle) || outletName(row.OutletCode).toLowerCase().includes(needle) }

  async function reload(forceSync = false) { loading.value = true; try { await workflowStore.fetchResources(OUTLET_OPERATION_RESOURCES, { includeInactive: true, forceSync }) } finally { loading.value = false } }
  async function reloadIndex(forceSync = false) { loading.value = true; try { await workflowStore.fetchResources(['OutletDeliveries', 'Outlets'], { includeInactive: true, forceSync }) } finally { loading.value = false } }
  async function reloadAdd(forceSync = false) { loading.value = true; try { await workflowStore.fetchResources(['OutletRestocks', 'OutletRestockItems', 'OutletDeliveries', 'Outlets', 'Warehouses', 'SKUs', 'Products'], { includeInactive: true, forceSync }) } finally { loading.value = false } }
  async function reloadView(forceSync = false) { loading.value = true; try { await workflowStore.fetchResources(['OutletDeliveries', 'OutletRestocks', 'OutletRestockItems', 'Outlets', 'Warehouses', 'SKUs', 'Products', 'OutletMovements', 'StockMovements'], { includeInactive: true, forceSync }) } finally { loading.value = false } }

  function selectRestock(code) {
    selectedRestockCode.value = code || ''
    rows.value = selectedItemRows.value.flatMap(item => parseStorageAllocations(item.StorageAllocationJSON).map(allocation => ({ Code: `${item.Code}:${allocation.storage_name}`, OutletRestockItemCode: item.Code, SKU: item.SKU, ProductLabel: skuLabel(item.SKU), StorageName: allocation.storage_name, Quantity: toNumber(allocation.quantity), Qty: toNumber(allocation.quantity) })))
  }

  async function scheduleDelivery() {
    const validation = validateDelivery(selectedRestock.value, selectedItemsJSON.value)
    if (!selectedWarehouseCode.value) validation.errors.push('Warehouse is required for scheduling.')
    if (!validation.valid || validation.errors.length) return $q.notify({ type: 'warning', message: validation.errors[0], position: 'top' })
    saving.value = true
    try {
      const result = await workflowStore.runBatchRequests(buildScheduleDeliveryBatchRequests(selectedRestock.value, selectedItemRows.value, selectedWarehouseCode.value, selectedItemsJSON.value, currentUserName()))
      if (responseFailed(result)) return $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to schedule delivery.'), position: 'top' })
      const code = batchResultCode(result, 0)
      $q.notify({ type: 'positive', message: 'Delivery scheduled.', position: 'top' })
      if (code) nav.goTo('view', { code })
      return true
    } finally { saving.value = false }
  }

  async function deliverDelivery(code) {
    const od = getDelivery(code)
    const validation = validateDelivery({ Code: od?.OutletRestockCode, Progress: 'APPROVED' }, od?.ItemsJSON)
    if (!od || text(od.Progress) !== 'SCHEDULED') validation.errors.push('Only scheduled deliveries can be delivered.')
    if (!validation.valid || validation.errors.length) return $q.notify({ type: 'warning', message: validation.errors[0], position: 'top' })
    saving.value = true
    try {
      const result = await workflowStore.runBatchRequests(buildDeliverDeliveryBatchRequests(code, od, od.ItemsJSON, currentUserName(), deliveryRestockProgress(od)))
      if (responseFailed(result)) return $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to deliver scheduled OD.'), position: 'top' })
      $q.notify({ type: 'positive', message: 'Delivery marked delivered.', position: 'top' })
      return true
    } finally { saving.value = false }
  }

  async function cancelDelivery(code, comment = '') {
    const od = getDelivery(code)
    if (!od || text(od.Progress) !== 'SCHEDULED') return $q.notify({ type: 'warning', message: 'Only scheduled deliveries can be cancelled.', position: 'top' })
    saving.value = true
    try {
      const result = await workflowStore.runBatchRequests(buildCancelDeliveryBatchRequests(code, od, od.ItemsJSON, currentUserName(), comment))
      if (responseFailed(result)) return $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to cancel scheduled OD.'), position: 'top' })
      $q.notify({ type: 'positive', message: 'Delivery cancelled.', position: 'top' })
      return true
    } finally { saving.value = false }
  }

  function deliveryRestockProgress(od = {}) {
    const requested = selectedOrLoadedRestockItems(od.OutletRestockCode).reduce((total, item) => total + toNumber(item.Quantity), 0)
    const delivered = aggregateItemsBySku(od.ItemsJSON).reduce((total, item) => total + toNumber(item.qty), 0)
    return delivered >= requested ? 'DELIVERED' : 'PARTIALLY_DELIVERED'
  }
  function selectedOrLoadedRestockItems(restockCode) { return restockItems.items.value.filter(row => text(row.OutletRestockCode) === text(restockCode)).filter(active) }
  function setExpandedGroup(key) { expandedGroup.value = expandedGroup.value === key ? '' : key }
  function getDelivery(code) { return deliveries.items.value.find(row => text(row.Code) === text(code)) || null }
  function parseDeliveryItems(delivery = {}) { return parseItemsJSON(delivery.ItemsJSON) }
  function deliveredTotal(delivery) { return parseDeliveryItems(delivery).reduce((total, row) => total + toNumber(row.qty), 0) }
  function movementLinksForDelivery(delivery = {}) {
    const code = text(delivery.Code)
    if (!code) return []
    if (text(delivery.Progress) === 'DELIVERED') return [{ label: 'Outlet movement entries', resource: 'OutletMovements', referenceType: 'RestockDelivery', referenceCode: code }]
    if (text(delivery.Progress) === 'CANCELLED') return [{ label: 'Warehouse reversal entries', resource: 'StockMovements', referenceType: 'OutletDeliveryCancel', referenceCode: code }]
    return []
  }
  function movementsForDelivery(code) { return movementLinksForDelivery(getDelivery(code)) }
  function navigateTo(code) { nav.goTo('view', { code }) }
  function navigateToAdd() { nav.goTo('add') }
  function cancel() { nav.goTo('list') }

  return { loading, saving, searchTerm, selectedRestockCode, selectedWarehouseCode, rows, items, groups, expandedGroup, eligibleRestocks, selectedRestock, warehouseOptions, reload, reloadIndex, reloadAdd, reloadView, selectRestock, scheduleDelivery, deliverDelivery, cancelDelivery, setExpandedGroup, parseDeliveryItems, getDelivery, deliveredTotal, itemsSummary, restockCardSummary, outletName, skuLabel, movementsForDelivery, movementLinksForDelivery, navigateTo, navigateToAdd, cancel }
}
