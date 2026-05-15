import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../../../stores/auth.js'
import { useResourceData } from '../../resources/useResourceData.js'
import { useResourceNav } from '../../resources/useResourceNav.js'
import { useWorkflowStore } from '../../../stores/workflow.js'
import { OUTLET_OPERATION_RESOURCES, DELIVERY_PROGRESS_ORDER, active, progressMeta, sortTime, text, todayISO } from './outletOperationsMeta.js'
import { toNumber, validateDeliveryItems } from './outletStockLogic.js'
import { buildOdCancelBatchRequests, buildOdCreateBatchRequests, buildOdDeliverBatchRequests } from './outletDeliveryPayload.js'
import { batchResultCode, failureMessage, responseFailed } from './outletOperationsBatch.js'

export function useOutletDeliveries() {
  const $q = useQuasar()
  const workflowStore = useWorkflowStore()
  const authStore = useAuthStore()
  const nav = useResourceNav()
  const deliveries = useResourceData(ref('OutletDeliveries'))
  const deliveryItems = useResourceData(ref('OutletDeliveryItems'))
  const restocks = useResourceData(ref('OutletRestocks'))
  const restockItems = useResourceData(ref('OutletRestockItems'))
  const outlets = useResourceData(ref('Outlets'))
  const skus = useResourceData(ref('SKUs'))
  const products = useResourceData(ref('Products'))
  const outletMovements = useResourceData(ref('OutletMovements'))
  const loading = ref(false)
  const saving = ref(false)
  const searchTerm = ref('')
  const selectedItemCodes = ref([])
  const expandedGroup = ref('DRAFT')

  const items = computed(() => deliveries.items.value.filter(active).filter(matchesSearch).sort((a, b) => sortTime(b) - sortTime(a)))
  const groups = computed(() => DELIVERY_PROGRESS_ORDER.map(key => ({ key, meta: progressMeta(key), items: items.value.filter(row => (DELIVERY_PROGRESS_ORDER.includes(text(row.Progress)) ? text(row.Progress) : 'OTHER') === key) })).filter(group => group.items.length || group.key === 'DRAFT'))
  const activeDeliveryItemCodes = computed(() => new Set(deliveryItems.items.value.filter(active).map(row => text(row.OutletRestockItemCode))))
  const availableItems = computed(() => restockItems.items.value.filter(active).filter(row => text(row.Progress) === 'ALLOCATED' && !activeDeliveryItemCodes.value.has(text(row.Code))).filter(matchesItemSearch).map(enrichOrsi))
  const selectedItems = computed(() => availableItems.value.filter(row => selectedItemCodes.value.includes(text(row.Code))))

  const odConfig = computed(() => (Array.isArray(authStore.resources) ? authStore.resources : []).find(r => r.name === 'OutletDeliveries') || null)
  const odPermissions = computed(() => odConfig.value?.permissions || {})
  const canCreate = computed(() => !!odPermissions.value.canWrite)
  const canDeliver = computed(() => !!odPermissions.value.canUpdate)
  const canCancel = computed(() => !!odPermissions.value.canUpdate)

  function currentUserName() {
    const user = authStore.user || {}
    return text(user.Name || user.name || user.UserName || user.Username || user.email || user.Email || user.UserID || user.Code)
  }
  function outletName(code) { const outlet = outlets.items.value.find(row => text(row.Code) === text(code)); return outlet?.Name || code }
  function restockForOrsi(orsi = {}) { return restocks.items.value.find(row => text(row.Code) === text(orsi.OutletRestockCode)) || null }
  function outletForOrsi(orsi = {}) { return outletName(restockForOrsi(orsi)?.OutletCode) }
  function skuLabel(code) {
    const sku = skus.items.value.find(row => text(row.Code) === text(code))
    const product = products.items.value.find(row => text(row.Code) === text(sku?.ProductCode))
    const variants = [sku?.Variant1, sku?.Variant2, sku?.Variant3, sku?.Variant4, sku?.Variant5].map(text).filter(Boolean).join(' / ')
    return `${code}${product?.Name ? ` - ${product.Name}` : ''}${variants ? ` - ${variants}` : ''}`
  }
  function enrichOrsi(row = {}) {
    const restock = restockForOrsi(row)
    return { ...row, OutletCode: restock?.OutletCode || '', OutletName: outletName(restock?.OutletCode), SKUName: skuLabel(row.SKU), RestockDate: restock?.Date || '' }
  }
  function matchesSearch(row = {}) {
    const needle = searchTerm.value.toLowerCase()
    if (!needle) return true
    const summary = deliverySummary(row)
    return JSON.stringify(row).toLowerCase().includes(needle) || summary.outlets.join(' ').toLowerCase().includes(needle)
  }
  function matchesItemSearch(row = {}) {
    const needle = searchTerm.value.toLowerCase()
    if (!needle) return true
    const restock = restockForOrsi(row)
    return [row.Code, row.SKU, skuLabel(row.SKU), outletName(restock?.OutletCode), restock?.Code].some(value => text(value).toLowerCase().includes(needle))
  }

  async function reload(forceSync = false) { loading.value = true; try { await workflowStore.fetchResources(OUTLET_OPERATION_RESOURCES, { includeInactive: true, forceSync }) } finally { loading.value = false } }
  async function reloadIndex(forceSync = false) { loading.value = true; try { await workflowStore.fetchResources(['OutletDeliveries', 'OutletDeliveryItems', 'OutletRestocks', 'OutletRestockItems', 'Outlets', 'SKUs', 'Products'], { includeInactive: true, forceSync }) } finally { loading.value = false } }
  async function reloadAdd(forceSync = false) { loading.value = true; try { await workflowStore.fetchResources(['OutletDeliveries', 'OutletDeliveryItems', 'OutletRestocks', 'OutletRestockItems', 'Outlets', 'SKUs', 'Products'], { includeInactive: true, forceSync }) } finally { loading.value = false } }
  async function reloadView(forceSync = false) { loading.value = true; try { await workflowStore.fetchResources(['OutletDeliveries', 'OutletDeliveryItems', 'OutletRestocks', 'OutletRestockItems', 'Outlets', 'SKUs', 'Products', 'OutletMovements'], { includeInactive: true, forceSync }) } finally { loading.value = false } }

  function toggleItem(code) {
    const key = text(code)
    selectedItemCodes.value = selectedItemCodes.value.includes(key) ? selectedItemCodes.value.filter(item => item !== key) : selectedItemCodes.value.concat(key)
  }
  function selectAllAvailable() { selectedItemCodes.value = availableItems.value.map(row => text(row.Code)) }
  function clearSelection() { selectedItemCodes.value = [] }
  async function createDraft() {
    const validation = validateDeliveryItems(selectedItems.value)
    if (!validation.valid) return notifyWarning(validation.errors[0])
    saving.value = true
    try {
      const result = await workflowStore.runBatchRequests(buildOdCreateBatchRequests({ Date: todayISO(), UserName: currentUserName(), AccessRegion: selectedItems.value[0]?.AccessRegion }, selectedItems.value))
      if (responseFailed(result)) return notifyError(failureMessage(result, 'Failed to create delivery.'))
      const code = batchResultCode(result, 0)
      $q.notify({ type: 'positive', message: 'Delivery draft created.', position: 'top' })
      clearSelection()
      if (code) nav.goTo('view', { code })
      return true
    } finally { saving.value = false }
  }

  function getDelivery(code) { return deliveries.items.value.find(row => text(row.Code) === text(code)) || null }
  function getRestock(code) { return restocks.items.value.find(row => text(row.Code) === text(code)) || null }
  function childDeliveryItems(code) { return deliveryItems.items.value.filter(row => text(row.OutletDeliveryCode) === text(code)).filter(active) }
  function deliveryOrsiRows(code) { return childDeliveryItems(code).map(odi => restockItems.items.value.find(row => text(row.Code) === text(odi.OutletRestockItemCode))).filter(Boolean) }
  function deliveryItemViewRows(code) {
    return childDeliveryItems(code).map(odi => {
      const orsi = restockItems.items.value.find(row => text(row.Code) === text(odi.OutletRestockItemCode)) || {}
      const restock = restockForOrsi(orsi) || {}
      return { ...odi, orsi, restock, OutletCode: restock.OutletCode, OutletName: outletName(restock.OutletCode), SKU: orsi.SKU, SKUName: skuLabel(orsi.SKU), Quantity: toNumber(orsi.Quantity), WarehouseCode: orsi.WarehouseCode, StorageName: orsi.StorageName }
    })
  }
  function deliverySummary(od = {}) {
    const rows = deliveryItemViewRows(od.Code)
    const delivered = rows.filter(row => text(row.Progress) === 'DELIVERED').length
    const outlets = Array.from(new Set(rows.map(row => row.OutletName).filter(Boolean)))
    return { total: rows.length, delivered, outlets, quantity: rows.reduce((sum, row) => sum + toNumber(row.Quantity), 0) }
  }
  function groupedDeliveryItems(code) {
    const groups = new Map()
    deliveryItemViewRows(code).forEach(row => {
      const key = row.OutletCode || 'unknown'
      if (!groups.has(key)) groups.set(key, { key, outletName: row.OutletName || key, items: [] })
      groups.get(key).items.push(row)
    })
    return Array.from(groups.values())
  }

  async function markItemDelivered(odiRow, comment = '') {
    const od = getDelivery(odiRow.OutletDeliveryCode)
    const orsi = restockItems.items.value.find(row => text(row.Code) === text(odiRow.OutletRestockItemCode))
    const restock = restockForOrsi(orsi)
    if (!od || !orsi || !restock) return notifyWarning('Delivery item source data is incomplete.')
    if (text(odiRow.Progress) === 'DELIVERED') return notifyWarning('This item is already delivered.')
    saving.value = true
    try {
      const result = await workflowStore.runBatchRequests(buildOdDeliverBatchRequests(odiRow, od, orsi, { odiRows: childDeliveryItems(od.Code), orsiRows: restockItems.items.value.filter(row => text(row.OutletRestockCode) === text(restock.Code)).filter(active), restock }, currentUserName(), comment))
      if (responseFailed(result)) return notifyError(failureMessage(result, 'Failed to mark item delivered.'))
      $q.notify({ type: 'positive', message: 'Item delivered.', position: 'top' })
      await reloadView(true)
      return true
    } finally { saving.value = false }
  }

  async function markAllDelivered(odCode, comment = '') {
    const pending = childDeliveryItems(odCode).filter(row => text(row.Progress) !== 'DELIVERED')
    for (const row of pending) {
      const ok = await markItemDelivered(row, comment)
      if (!ok) return false
    }
    return true
  }

  async function cancelDraft(odCode, comment = '') {
    const od = getDelivery(odCode)
    const odis = childDeliveryItems(odCode)
    if (!od) return notifyWarning('Delivery not found.')
    if (odis.some(row => text(row.Progress) === 'DELIVERED')) return notifyWarning('A delivery with delivered items cannot be cancelled.')
    saving.value = true
    try {
      const result = await workflowStore.runBatchRequests(buildOdCancelBatchRequests(od, odis, deliveryOrsiRows(odCode), currentUserName(), comment))
      if (responseFailed(result)) return notifyError(failureMessage(result, 'Failed to cancel delivery.'))
      $q.notify({ type: 'positive', message: 'Delivery cancelled.', position: 'top' })
      await reloadView(true)
      return true
    } finally { saving.value = false }
  }

  function movementsForDelivery(code) { return outletMovements.items.value.filter(row => text(row.ReferenceType) === 'RestockDelivery' && text(row.ReferenceCode) === text(code)) }
  function setExpandedGroup(key) { expandedGroup.value = expandedGroup.value === key ? '' : key }
  function navigateTo(code) { nav.goTo('view', { code }) }
  function navigateToAdd() { nav.goTo('add') }
  function cancel() { nav.goTo('list') }
  function timeAgo(dateValue) {
    if (!dateValue) return ''
    const date = new Date(text(dateValue))
    if (isNaN(date.getTime())) return text(dateValue).slice(0, 10)
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  function notifyWarning(message) { $q.notify({ type: 'warning', message, position: 'top' }); return false }
  function notifyError(message) { $q.notify({ type: 'negative', message, position: 'top' }); return false }

  return {
    loading, saving, searchTerm, selectedItemCodes, selectedItems, items, groups, expandedGroup, availableItems,
    reload, reloadIndex, reloadAdd, reloadView, toggleItem, selectAllAvailable, clearSelection, createDraft, markItemDelivered, markAllDelivered, cancelDraft,
    setExpandedGroup, getDelivery, getRestock, childDeliveryItems, deliveryItemViewRows, groupedDeliveryItems, deliverySummary,
    outletName, outletForOrsi, skuLabel, movementsForDelivery, navigateTo, navigateToAdd, cancel, canCreate, canDeliver, canCancel, timeAgo
  }
}
