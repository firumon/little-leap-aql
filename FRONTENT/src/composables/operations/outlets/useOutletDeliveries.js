import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../../../stores/auth.js'
import { useRecord } from '../../resources/useRecord.js'
import { useResourceNav } from '../../resources/useResourceNav.js'
import { useResourceConfig } from '../../resources/useResourceConfig.js'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { OUTLET_OPERATION_RESOURCES, DELIVERY_PROGRESS_ORDER, active, progressMeta, sortTime, text, todayISO } from './outletOperationsMeta.js'
import { toNumber, validateDeliveryItems } from './outletStockLogic.js'
import { buildOdCancelBatchRequests, buildOdCreateBatchRequests, buildOdDeliverBatchRequests } from './outletDeliveryPayload.js'
import { batchResultCode, failureMessage, responseFailed } from './outletOperationsBatch.js'

const CRITERIA_MAP = {
  Outlet:       { isTwoLevel: false, key: row => row.outletCode, label: row => row.outletName },
  City:         { isTwoLevel: true, key: row => row.outletCity, label: row => row.outletCity || 'Unknown City', subKey: row => row.outletCode, subLabel: row => [row.outletName,row.outletCity].join(", ") },
  Product:      { isTwoLevel: true, key: row => row.productCode, label: row => row.productName || 'Unknown Product', subKey: row => row.outletCode, subLabel: row => [row.outletName,row.outletCity].join(", ") },
  Date:         { isTwoLevel: true, key: row => row.ORDate, label: row => row.ORDate || 'No Date', subKey: row => row.outletCode, subLabel: row => [row.outletName,row.outletCity].join(", ") },
  Qty:          { isTwoLevel: false, key: row => row.outletCode, label: row => row.outletName },
  RequestUser:  { isTwoLevel: true, key: row => row.requestUser, label: row => row.requestUser || 'Unknown', subKey: row => row.outletCode, subLabel: row => [row.outletName,row.outletCity].join(", ") },
  ApprovedUser: { isTwoLevel: true, key: row => row.approvedUser, label: row => row.approvedUser || 'Unknown', subKey: row => row.outletCode, subLabel: row => [row.outletName,row.outletCity].join(", ") }
}

export function useOutletDeliveries() {
  const $q = useQuasar()
  const resourceIoStore = useResourceIoStore()
  const authStore = useAuthStore()
  const nav = useResourceNav()
  const { allowed } = useResourceConfig()
  const deliveries = useRecord(ref('OutletDeliveries'))
  const restocks = useRecord(ref('OutletRestocks'))
  const restockItems = useRecord(ref('OutletRestockItems'))
  const outlets = useRecord(ref('Outlets'))
  const skus = useRecord(ref('SKUs'))
  const products = useRecord(ref('Products'))
  const warehouses = useRecord(ref('Warehouses'))
  const outletMovements = useRecord(ref('OutletMovements'))
  const loading = ref(false)
  const isInitialLoad = ref(true)
  const saving = ref(false)
  const searchTerm = ref('')
  const selectedItemCodes = ref([])
  const expandedGroup = ref('DRAFT')
  const criteria = ref('Outlet')
  const selectedWarehouseCode = ref('')

  const items = computed(() => deliveries.items.value.filter(active).filter(matchesSearch).sort((a, b) => sortTime(b) - sortTime(a)))
  const groups = computed(() => DELIVERY_PROGRESS_ORDER.map(key => ({ key, meta: progressMeta(key), items: items.value.filter(row => (DELIVERY_PROGRESS_ORDER.includes(text(row.Progress)) ? text(row.Progress) : 'OTHER') === key) })).filter(group => group.items.length))

  const orioRows = computed(() => {
    const result = []
    for (const row of restockItems.items.value) {
      if (!active(row)) continue
      if (text(row.Progress) !== 'ALLOCATED') continue
      const restock = restocks.items.value.find(r => text(r.Code) === text(row.OutletRestockCode))
      if (!restock) continue
      const outlet = outlets.items.value.find(o => text(o.Code) === text(restock.OutletCode))
      const sku = skus.items.value.find(s => text(s.Code) === text(row.SKU))
      const product = products.items.value.find(p => text(p.Code) === text(sku?.ProductCode))
      const warehouse = warehouses.items.value.find(w => text(w.Code) === text(row.WarehouseCode))
      const variants = [sku?.Variant1, sku?.Variant2, sku?.Variant3, sku?.Variant4, sku?.Variant5].map(text).filter(Boolean).join(' / ')
      result.push({
        skuCode: text(row.SKU),
        skuLabel: `${product?.Name ? `${product.Name}` : ''}${variants ? ` - ${variants}` : ''}`,
        variantsSlug: variants,
        productCode: text(sku?.ProductCode),
        productName: text(product?.Name),
        qty: toNumber(row.Quantity),
        storageName: text(row.StorageName),
        warehouseCode: text(row.WarehouseCode),
        warehouseName: text(warehouse?.Name),
        requestUser: text(restock?.RequestedUser),
        approvedUser: text(restock?.ApprovedUser),
        ORDate: text(restock?.Date),
        ORCode: text(restock?.Code),
        ORICode: text(row.Code),
        outletCity: text(outlet?.City),
        outletName: text(outlet?.Name),
        outletCode: text(outlet?.Code),
        rawOrsi: row,
        rawRestock: restock
      })
    }
    return result
  })

  const warehouseOptions = computed(() => {
    const names = new Map()
    for (const row of orioRows.value) {
      if (row.warehouseCode && row.warehouseName && !names.has(row.warehouseCode)) {
        names.set(row.warehouseCode, row.warehouseName)
      }
    }
    return [{ label: 'All', value: '' }, ...Array.from(names.entries()).map(([value, label]) => ({ label, value }))]
  })

  const filteredOrioRows = computed(() => {
    if (!selectedWarehouseCode.value) return orioRows.value
    return orioRows.value.filter(row => row.warehouseCode === selectedWarehouseCode.value)
  })

  const usedOrsiCodes = computed(() => {
    const codes = new Set()
    for (const od of deliveries.items.value) {
      if (!active(od)) continue
      if (text(od.Progress) === 'CANCELLED') continue
      const csv = text(od.OutletRestockItemCodes)
      if (csv) csv.split(',').filter(Boolean).forEach(c => codes.add(c.trim()))
    }
    return codes
  })

  const availableItems = computed(() => filteredOrioRows.value.filter(row => !usedOrsiCodes.value.has(row.ORICode)))

  const selectedItems = computed(() => availableItems.value.filter(row => selectedItemCodes.value.includes(row.ORICode)))

  const groupedSearchResults = computed(() => {
    let rows = availableItems.value
    const needle = text(searchTerm.value).toLowerCase()
    if (needle) {
      rows = rows.filter(row =>
        [row.skuLabel, row.outletName, row.productName, row.ORCode, row.ORICode, row.warehouseName]
          .some(v => text(v).toLowerCase().includes(needle))
      )
    }
    const criterion = CRITERIA_MAP[criteria.value] || CRITERIA_MAP.Outlet

    if (criterion.isTwoLevel) {
      const topMap = new Map()
      for (const row of rows) {
        const key = criterion.key(row)
        if (!topMap.has(key)) topMap.set(key, { key, label: criterion.label(row), items: [] })
        topMap.get(key).items.push(row)
      }
      let topEntries = Array.from(topMap.values())
      if (criteria.value === 'Date') topEntries.sort((a, b) => String(a.key).localeCompare(String(b.key)))
      return topEntries.map(g => {
        const childMap = new Map()
        for (const row of g.items) {
          const sk = criterion.subKey(row)
          if (!childMap.has(sk)) childMap.set(sk, { key: sk, label: criterion.subLabel(row), items: [] })
          childMap.get(sk).items.push(row)
        }
        return { key: g.key, label: g.label, count: g.items.length, children: Array.from(childMap.values()) }
      })
    }

    if (criteria.value === 'Qty') {
      const groups = new Map()
      for (const row of rows) {
        const key = criterion.key(row)
        if (!groups.has(key)) groups.set(key, { key, label: criterion.label(row), items: [] })
        groups.get(key).items.push(row)
      }
      return Array.from(groups.values()).sort((a, b) => {
        const sumA = a.items.reduce((s, r) => s + r.qty, 0)
        const sumB = b.items.reduce((s, r) => s + r.qty, 0)
        return sumB - sumA
      })
    }

    const groups = new Map()
    for (const row of rows) {
      const key = criterion.key(row)
      if (!groups.has(key)) groups.set(key, { key, label: criterion.label(row), items: [] })
      groups.get(key).items.push(row)
    }
    return Array.from(groups.values())
  })

  const odConfig = computed(() => (Array.isArray(authStore.resources) ? authStore.resources : []).find(r => r.name === 'OutletDeliveries') || null)
  const odPermissions = computed(() => odConfig.value?.permissions || {})
  const canCreate = computed(() => allowed('CREATE'))
  const canDeliver = computed(() => allowed('create') || allowed('update'))
  const canCancel = computed(() => allowed('create') || allowed('update'))

  function currentUserName() {
    const user = authStore.user || {}
    return text(user.Name || user.name || user.UserName || user.Username || user.email || user.Email || user.UserID || user.Code)
  }

  function matchesSearch(row = {}) {
    const needle = searchTerm.value.toLowerCase()
    if (!needle) return true
    const summary = deliverySummary(row)
    return JSON.stringify(row).toLowerCase().includes(needle) || summary.outlets.join(' ').toLowerCase().includes(needle)
  }

  async function reload(forceSync = false) { loading.value = true; try { await resourceIoStore.fetchResources(OUTLET_OPERATION_RESOURCES, { forceSync }) } finally { loading.value = false } }
  async function reloadIndex(forceSync = false) { loading.value = true; try { await resourceIoStore.fetchResources(['OutletDeliveries', 'OutletRestocks', 'OutletRestockItems', 'Outlets', 'SKUs', 'Products'], { forceSync }) } finally { loading.value = false; isInitialLoad.value = false } }
  async function reloadAdd(forceSync = false) { loading.value = true; try { await resourceIoStore.fetchResources(['OutletDeliveries', 'OutletRestocks', 'OutletRestockItems', 'Outlets', 'SKUs', 'Products', 'Warehouses'], { forceSync }) } finally { loading.value = false } }
  async function reloadView(forceSync = false) { loading.value = true; try { await resourceIoStore.fetchResources(['OutletDeliveries', 'OutletRestocks', 'OutletRestockItems', 'Outlets', 'SKUs', 'Products', 'OutletMovements'], { forceSync }) } finally { loading.value = false } }

  function toggleItem(code) {
    const key = text(code)
    selectedItemCodes.value = selectedItemCodes.value.includes(key) ? selectedItemCodes.value.filter(item => item !== key) : selectedItemCodes.value.concat(key)
  }
  function selectAllAvailable() { selectedItemCodes.value = availableItems.value.map(row => row.ORICode) }
  function clearSelection() { selectedItemCodes.value = [] }
  function selectNone() { clearSelection() }
  function invertSelection() {
    const available = new Set(availableItems.value.map(row => row.ORICode))
    selectedItemCodes.value = availableItems.value.filter(row => !selectedItemCodes.value.includes(row.ORICode)).map(row => row.ORICode)
  }

  async function createDraft() {
    if (!allowed({ outletDelivery: 'create' })) {
      return notifyError('You do not have permission to create a delivery draft.')
    }
    const validation = validateDeliveryItems(selectedItems.value.map(row => row.rawOrsi))
    if (!validation.valid) return notifyWarning(validation.errors[0])
    saving.value = true
    try {
      const result = await resourceIoStore.runBatchRequests(buildOdCreateBatchRequests({ Date: todayISO(), UserName: currentUserName() }, selectedItems.value.map(row => row.rawOrsi)))
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

  function deliveryOrsiCodes(code) {
    const od = getDelivery(code)
    if (!od) return []
    return (text(od.OutletRestockItemCodes) || '').split(',').filter(Boolean).map(c => c.trim())
  }

  function deliveryOrsiRows(code) {
    const codes = deliveryOrsiCodes(code)
    return codes.map(c => restockItems.items.value.find(r => text(r.Code) === c)).filter(Boolean)
  }

  function deliveryItemViewRows(code) {
    return deliveryOrsiRows(code).map(orsi => {
      const restock = restocks.items.value.find(r => text(r.Code) === text(orsi.OutletRestockCode)) || {}
      const outlet = outlets.items.value.find(o => text(o.Code) === text(restock.OutletCode))
      return {
        Code: text(orsi.Code),
        OutletDeliveryCode: code,
        orsi, restock,
        OutletCode: text(restock.OutletCode),
        OutletName: text(outlet?.Name),
        SKU: text(orsi.SKU),
        SKUName: skuLabel(text(orsi.SKU)),
        Quantity: toNumber(orsi.Quantity),
        WarehouseCode: text(orsi.WarehouseCode),
        StorageName: text(orsi.StorageName),
        Progress: text(orsi.Progress) || 'ALLOCATED'
      }
    })
  }

  function deliverySummary(od = {}) {
    const rows = deliveryItemViewRows(od.Code)
    const delivered = rows.filter(row => text(row.Progress) === 'DELIVERED').length
    const outlets = Array.from(new Set(rows.map(row => row.OutletName).filter(Boolean)))
    return { total: rows.length, delivered, outlets, quantity: rows.reduce((sum, row) => sum + toNumber(row.Quantity), 0) }
  }

  function groupedDeliveryItems(code) {
    const rows = deliveryOrsiRows(code)
    const outletMap = new Map()
    for (const orsi of rows) {
      const restock = restocks.items.value.find(r => text(r.Code) === text(orsi.OutletRestockCode)) || {}
      const outlet = outlets.items.value.find(o => text(o.Code) === text(restock.OutletCode))
      const sku = skus.items.value.find(s => text(s.Code) === text(orsi.SKU))
      const product = products.items.value.find(p => text(p.Code) === text(sku?.ProductCode))
      const variants = [sku?.Variant1, sku?.Variant2, sku?.Variant3, sku?.Variant4, sku?.Variant5].map(text).filter(Boolean).join(' / ')
      const outletKey = text(outlet?.Code) || 'unknown'
      const skuKey = text(orsi.SKU)
      if (!outletMap.has(outletKey)) {
        outletMap.set(outletKey, { key: outletKey, outletName: text(outlet?.Name) || outletKey, skuMap: new Map() })
      }
      const outletGroup = outletMap.get(outletKey)
      if (!outletGroup.skuMap.has(skuKey)) {
        outletGroup.skuMap.set(skuKey, {
          key: skuKey,
          skuCode: skuKey,
          skuName: `${product?.Name ? product.Name : ''}${variants ? ` - ${variants}` : ''}`,
          totalQty: 0,
          orsiCodes: [],
          allDelivered: true,
          anyDelivered: false
        })
      }
      const skuItem = outletGroup.skuMap.get(skuKey)
      skuItem.totalQty += toNumber(orsi.Quantity)
      skuItem.orsiCodes.push(text(orsi.Code))
      if (text(orsi.Progress) !== 'DELIVERED') skuItem.allDelivered = false
      if (text(orsi.Progress) === 'DELIVERED') skuItem.anyDelivered = true
    }
    return Array.from(outletMap.values()).map(g => ({
      key: g.key,
      outletName: g.outletName,
      items: Array.from(g.skuMap.values()).map(item => ({
        ...item,
        progress: item.allDelivered ? 'DELIVERED' : 'IN_TRANSIT'
      }))
    }))
  }

  function hasPendingDeliveryItems(code) {
    return deliveryOrsiCodes(code).some(c => {
      const orsi = restockItems.items.value.find(r => text(r.Code) === c)
      return orsi && text(orsi.Progress) !== 'DELIVERED'
    })
  }

  function hasDeliveredDeliveryItems(code) {
    return deliveryOrsiCodes(code).some(c => {
      const orsi = restockItems.items.value.find(r => text(r.Code) === c)
      return orsi && text(orsi.Progress) === 'DELIVERED'
    })
  }

  async function markItemDelivered(orsiCode, comment = '') {
    const canDeliver = allowed('create', 'outletDelivery') || allowed('update', 'outletDelivery')
    const canRestock = allowed('create', 'outletRestock') || allowed('update', 'outletRestock')
    if (!canDeliver || !canRestock || !allowed('create', 'outletMovement')) {
      return notifyError('You do not have permission to mark items delivered.')
    }
    const od = getDelivery(orsiCode.OutletDeliveryCode)
    const orsi = restockItems.items.value.find(row => text(row.Code) === text(orsiCode.Code))
    const restock = restocks.items.value.find(r => text(r.Code) === text(orsi?.OutletRestockCode))
    if (!od || !orsi || !restock) return notifyWarning('Delivery item source data is incomplete.')
    if (text(orsi.Progress) === 'DELIVERED') return notifyWarning('This item is already delivered.')
    const odCodes = deliveryOrsiCodes(text(od.Code))
    const restockCodes = new Set(odCodes.map(code => {
      const r = restockItems.items.value.find(row => text(row.Code) === code)
      return r ? text(r.OutletRestockCode) : null
    }).filter(Boolean))
    const allOrsis = restockItems.items.value.filter(r => restockCodes.has(text(r.OutletRestockCode))).filter(active)
    const allRestocks = restocks.items.value.filter(r => restockCodes.has(text(r.Code)))
    saving.value = true
    try {
      const result = await resourceIoStore.runBatchRequests(buildOdDeliverBatchRequests(od, [text(orsi.Code)], { orsiRows: allOrsis, restocks: allRestocks }, currentUserName(), comment))
      if (responseFailed(result)) return notifyError(failureMessage(result, 'Failed to mark item delivered.'))
      $q.notify({ type: 'positive', message: 'Item delivered.', position: 'top' })
      await reloadView(true)
      return true
    } finally { saving.value = false }
  }

  async function markSelectedDelivered(odCode, selectedCodes, comment = '') {
    const canDeliver = allowed('create', 'outletDelivery') || allowed('update', 'outletDelivery')
    const canRestock = allowed('create', 'outletRestock') || allowed('update', 'outletRestock')
    if (!canDeliver || !canRestock || !allowed('create', 'outletMovement')) {
      return notifyError('You do not have permission to mark items delivered.')
    }
    const od = getDelivery(odCode)
    if (!od) return notifyWarning('Delivery not found.')
    const pendingCodes = selectedCodes.filter(code => {
      const orsi = restockItems.items.value.find(r => text(r.Code) === code)
      return orsi && text(orsi.Progress) !== 'DELIVERED'
    })
    if (!pendingCodes.length) return notifyWarning('No pending items to deliver.')
    const restockCodes = new Set()
    for (const code of deliveryOrsiCodes(odCode)) {
      const orsi = restockItems.items.value.find(r => text(r.Code) === code)
      if (orsi?.OutletRestockCode) restockCodes.add(text(orsi.OutletRestockCode))
    }
    const allOrsis = restockItems.items.value.filter(r => restockCodes.has(text(r.OutletRestockCode))).filter(active)
    const allRestocks = restocks.items.value.filter(r => restockCodes.has(text(r.Code)))
    saving.value = true
    try {
      const result = await resourceIoStore.runBatchRequests(buildOdDeliverBatchRequests(od, pendingCodes, { orsiRows: allOrsis, restocks: allRestocks }, currentUserName(), comment))
      if (responseFailed(result)) return notifyError(failureMessage(result, 'Failed to mark selected items delivered.'))
      $q.notify({ type: 'positive', message: `${pendingCodes.length} item(s) delivered.`, position: 'top' })
      await reloadView(true)
      return true
    } finally { saving.value = false }
  }

  async function markAllDelivered(odCode, comment = '') {
    const codes = deliveryOrsiCodes(odCode)
    return markSelectedDelivered(odCode, codes, comment)
  }

  async function cancelDraft(odCode, comment = '') {
    const canDeliver = allowed('create', 'outletDelivery') || allowed('update', 'outletDelivery')
    const canRestock = allowed('create', 'outletRestock') || allowed('update', 'outletRestock')
    if (!canDeliver || !canRestock) {
      return notifyError('You do not have permission to cancel this delivery draft.')
    }
    const od = getDelivery(odCode)
    if (!od) return notifyWarning('Delivery not found.')
    const codes = deliveryOrsiCodes(odCode)
    const deliveredCodes = codes.filter(code => {
      const orsi = restockItems.items.value.find(r => text(r.Code) === code)
      return orsi && text(orsi.Progress) === 'DELIVERED'
    })
    if (deliveredCodes.length) return notifyWarning('A delivery with delivered items cannot be cancelled.')
    const allOrsis = restockItems.items.value.filter(r => codes.includes(text(r.Code)))
    saving.value = true
    try {
      const result = await resourceIoStore.runBatchRequests(buildOdCancelBatchRequests(od, allOrsis, currentUserName(), comment))
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
  function skuLabel(code) {
    const sku = skus.items.value.find(row => text(row.Code) === text(code))
    const product = products.items.value.find(row => text(row.Code) === text(sku?.ProductCode))
    const variants = [sku?.Variant1, sku?.Variant2, sku?.Variant3, sku?.Variant4, sku?.Variant5].map(text).filter(Boolean).join(' / ')
    return `${code}${product?.Name ? ` - ${product.Name}` : ''}${variants ? ` - ${variants}` : ''}`
  }
  function notifyWarning(message) { $q.notify({ type: 'warning', message, position: 'top' }); return false }
  function notifyError(message) { $q.notify({ type: 'negative', message, position: 'top' }); return false }

  return {
    loading, isInitialLoad, saving, searchTerm, selectedItemCodes, selectedItems, items, groups, expandedGroup, availableItems,
    orioRows, criteria, selectedWarehouseCode, warehouseOptions, groupedSearchResults,
    reload, reloadIndex, reloadAdd, reloadView, toggleItem, selectAllAvailable, clearSelection, selectNone, invertSelection, createDraft, markItemDelivered, markSelectedDelivered, markAllDelivered, cancelDraft,
    setExpandedGroup, getDelivery, getRestock, deliveryOrsiCodes, deliveryOrsiRows, deliveryItemViewRows, groupedDeliveryItems, hasPendingDeliveryItems, hasDeliveredDeliveryItems, deliverySummary,
    skuLabel, movementsForDelivery, navigateTo, navigateToAdd, cancel, canCreate, canDeliver, canCancel, timeAgo, currentUserName, CRITERIA_MAP
  }
}
