import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../../../../stores/auth.js'
import { useRecord } from '../../../resources/useRecord.js'
import { useResourceNav } from '../../../resources/useResourceNav.js'
import { useResourceConfig } from '../../../resources/useResourceConfig.js'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { useProductSkuResolver } from 'src/composables/master/products/useProductSkuResolver'
import { todayISO, text, active } from '../outletOperationsMeta.js'
import { compositeSaveRequest, resourceBulkRequest, executeActionRequest, responseFailed, failureMessage, batchResultCode } from '../outletOperationsBatch.js'
import { batchRef } from 'src/utils/appHelpers'
import { toNumber } from '../outletStockLogic.js'

export function useDirectRestock() {
  const $q = useQuasar()
  const resourceIoStore = useResourceIoStore()
  const authStore = useAuthStore()
  const nav = useResourceNav()
  const { allowed } = useResourceConfig()
  const { skuInfo } = useProductSkuResolver()

  // Resource caches
  const warehouses = useRecord(ref('Warehouses'))
  const warehouseStorages = useRecord(ref('WarehouseStorages'))
  const outlets = useRecord(ref('Outlets'))
  const outletStorages = useRecord(ref('OutletStorages'))
  const skus = useRecord(ref('SKUs'))
  const products = useRecord(ref('Products'))
  const visits = useRecord(ref('OutletVisits'))

  // Wizard state
  const loading = ref(false)
  const saving = ref(false)
  const step = ref(1)

  const selectedWarehouseCode = ref(localStorage.getItem('last_direct_restock_warehouse_code') || '')
  const selectedOutletCode = ref('')
  const selectedVisitCode = ref('')
  const quantities = ref({}) // SKU -> number
  const submissionMode = ref('APPROVED') // 'APPROVED' | 'PENDING_APPROVAL' | 'DRAFT'
  const submitComment = ref('')

  // Computed options & records
  const warehouseOptions = computed(() => {
    return warehouses.items.value
      .filter(active)
      .map(w => ({ label: text(w.Name || w.Code), value: text(w.Code) }))
  })

  const outletOptions = computed(() => {
    return outlets.items.value
      .filter(active)
      .map(o => ({ label: text(o.Name), value: text(o.Code) }))
  })

  const plannedVisits = computed(() => {
    return visits.items.value
      .filter(active)
      .filter(v => text(v.Progress).toUpperCase() === 'PLANNED' && text(v.OutletCode) === selectedOutletCode.value)
      .sort((a, b) => Date.parse(text(a.Date)) - Date.parse(text(b.Date)))
  })

  const visitOptions = computed(() => {
    return plannedVisits.value.map(v => ({
      label: `${text(v.Code)} - ${text(v.Date).slice(0, 10)}`,
      value: text(v.Code)
    }))
  })

  // Watchers to auto-select and load storage rows
  watch(warehouseOptions, (newOptions) => {
    if (newOptions.length === 1) {
      selectedWarehouseCode.value = newOptions[0].value
    } else if (newOptions.length > 1 && !selectedWarehouseCode.value) {
      const stored = localStorage.getItem('last_direct_restock_warehouse_code')
      if (stored && newOptions.some(o => o.value === stored)) {
        selectedWarehouseCode.value = stored
      }
    }
  })

  watch([selectedWarehouseCode, selectedOutletCode], () => {
    quantities.value = {}
  })

  const wsRows = computed(() => {
    if (!selectedWarehouseCode.value) return []
    return warehouseStorages.items.value.filter(active)
      .filter(ws => text(ws.WarehouseCode) === selectedWarehouseCode.value && toNumber(ws.Quantity) > 0)
  })

  const osRows = computed(() => {
    if (!selectedOutletCode.value) return []
    return outletStorages.items.value.filter(active)
      .filter(os => text(os.OutletCode) === selectedOutletCode.value && toNumber(os.Quantity) > 0)
  })

  const rows = computed(() => {
    if (!selectedWarehouseCode.value || !selectedOutletCode.value) return []
    const skuRows = {}
    const combined = [...wsRows.value, ...osRows.value]

    combined.forEach(row => {
      const sku = row.SKU
      if (!sku) return

      if (skuRows[sku]) {
        skuRows[sku].Code += ('/' + row.Code)
        const skuRow = skuRows[sku]
        const loc = row.OutletCode ? 'Outlet' : 'Warehouse'
        skuRow[loc + 'Code'] = row[loc + 'Code']
        if (loc === 'Warehouse') skuRow.WarehouseStorageName = row.StorageName
        skuRow[loc + 'Quantity'] += toNumber(row.Quantity || 0)
      } else {
        const Code = row.Code
        const SKU = row.SKU
        const OutletCode = row.OutletCode || ''
        const WarehouseCode = row.WarehouseCode || ''
        const WarehouseStorageCode = OutletCode ? '' : row.Code
        const OutletStorageCode = OutletCode ? row.Code : ''
        const Quantity = toNumber(row.Quantity || 0)
        const WarehouseStorageName = row.StorageName || ''
        const WarehouseQuantity = OutletCode ? 0 : Quantity
        const OutletQuantity = OutletCode ? Quantity : 0

        const info = skuInfo(row.SKU) || {}

        skuRows[SKU] = {
          ...info,
          SKU,
          Code,
          OutletCode,
          WarehouseCode,
          WarehouseStorageCode,
          OutletStorageCode,
          WarehouseStorageName,
          WarehouseQuantity,
          OutletQuantity
        }
      }
    })

    return Object.values(skuRows).map(item => {
      const variantStr = item.variantValues?.filter(Boolean).join(" / ") || ''
      return {
        ...item,
        Quantity: quantities.value[item.SKU] || 0,
        skuLabel: [item.SKU, variantStr].filter(Boolean).join(": ")
      }
    })
  })

  function currentUserName() {
    const user = authStore.user || {}
    return text(user.Name || user.name || user.UserName || user.Username || user.email || user.Email || user.UserID || user.Code)
  }

  async function loadInitialData(forceSync = false) {
    loading.value = true
    try {
      await resourceIoStore.fetchResources([
        'Warehouses',
        'WarehouseStorages',
        'Outlets',
        'OutletStorages',
        'SKUs',
        'Products',
        'OutletVisits'
      ], { forceSync })
    } finally {
      loading.value = false
    }
  }

  function selectWarehouse(code) {
    selectedWarehouseCode.value = text(code)
    localStorage.setItem('last_direct_restock_warehouse_code', text(code))
  }

  function selectOutlet(outletCode) {
    selectedOutletCode.value = text(outletCode)
    // Auto-select visit if there's one planned today or upcoming
    const today = new Date().toISOString().slice(0, 10)
    const matchingVisit = plannedVisits.value.find(v => text(v.Date).slice(0, 10) === today) || plannedVisits.value[0]
    selectedVisitCode.value = matchingVisit ? text(matchingVisit.Code) : ''
    step.value = 2
  }

  function updateQuantity(sku, val) {
    const matchedRow = rows.value.find(r => r.SKU === sku)
    if (!matchedRow) return
    const num = Math.max(0, Math.floor(toNumber(val)))
    quantities.value = {
      ...quantities.value,
      [sku]: Math.min(matchedRow.WarehouseQuantity, num)
    }
  }

  function adjustQuantity(sku, delta) {
    const current = quantities.value[sku] || 0
    updateQuantity(sku, current + delta)
  }

  const addedItems = computed(() => rows.value.filter(r => r.Quantity > 0))

  async function submitRestock() {
    if (!addedItems.value.length) {
      $q.notify({ type: 'warning', message: 'Please adjust at least one product restock quantity.', position: 'top' })
      return false
    }

    const mode = submissionMode.value
    const isDirect = mode === 'APPROVED'

    const requiredPerms = { outletRestock: 'create' }
    if (isDirect) {
      requiredPerms.stockMovement = 'create'
      if (selectedVisitCode.value) {
        requiredPerms.outletVisit = 'update'
      }
    }

    if (!allowed(requiredPerms)) {
      $q.notify({ type: 'negative', message: 'You do not have permission to perform this restock submission.', position: 'top' })
      return false
    }

    saving.value = true
    try {
      const requests = []

      // 1. Composite save of the parent restock and its items
      const restockPayload = {
        resource: 'OutletRestocks',
        data: {
          Date: todayISO(),
          OutletCode: selectedOutletCode.value,
          RequestedUser: currentUserName(),
          Progress: mode, // 'APPROVED' | 'PENDING_APPROVAL' | 'DRAFT'
          Status: 'Active',
          ProgressSubmittedComment: submitComment.value
        },
        children: [{
          resource: 'OutletRestockItems',
          records: addedItems.value.map(row => ({
            _action: 'create',
            data: {
              SKU: row.SKU,
              Quantity: row.Quantity,
              WarehouseCode: isDirect ? selectedWarehouseCode.value : '',
              StorageName: isDirect ? '_default' : '',
              Progress: isDirect ? 'ALLOCATED' : 'PENDING',
              Status: 'Active'
            }
          }))
        }]
      }
      requests.push(compositeSaveRequest(restockPayload))

      // 2. If approved directly, deduct stock from warehouse via StockMovements
      if (isDirect) {
        const movements = addedItems.value.map(row => ({
          WarehouseCode: selectedWarehouseCode.value,
          StorageName: '_default',
          SKU: row.SKU,
          QtyChange: -Math.abs(row.Quantity),
          ReferenceType: 'OutletRestock',
          ReferenceCode: batchRef('OutletRestocks.latest.code'),
          Status: 'Active'
        }))
        requests.push(resourceBulkRequest('StockMovements', movements, ['WarehouseStorages']))
      }

      // 3. Mark visit complete if selected
      if (isDirect && selectedVisitCode.value) {
        requests.push(executeActionRequest('OutletVisits', selectedVisitCode.value, {
          action: 'Complete',
          column: 'Progress',
          columnValue: 'COMPLETED'
        }, {
          ProgressCompletedComment: 'Completed from direct restock submit.'
        }, ['OutletVisits']))
      }

      if (isDirect) {
        requests.push({
          action: 'get',
          resource: 'OutletMovements',
          payload: {}
        })
        requests.push({
          action: 'get',
          resource: 'OutletStorages',
          payload: {}
        })
      }

      const response = await resourceIoStore.runBatchRequests(requests)
      if (responseFailed(response)) {
        $q.notify({ type: 'negative', message: failureMessage(response, 'Failed to submit restock.'), position: 'top' })
        return false
      }

      const newCode = batchResultCode(response, 0)
      $q.notify({ type: 'positive', message: `Restock ${newCode} submitted successfully.`, position: 'top' })

      // Navigate to standard view page
      nav.goTo('view', { code: newCode })
      return true
    } catch (e) {
      $q.notify({ type: 'negative', message: 'Failed to process restock transaction.', position: 'top' })
      return false
    } finally {
      saving.value = false
    }
  }

  function cancel() {
    nav.goTo('index')
  }

  return {
    loading,
    saving,
    step,
    selectedWarehouseCode,
    selectedOutletCode,
    selectedVisitCode,
    rows,
    submissionMode,
    submitComment,
    warehouseOptions,
    outletOptions,
    visitOptions,
    addedItems,
    loadInitialData,
    selectWarehouse,
    selectOutlet,
    updateQuantity,
    adjustQuantity,
    submitRestock,
    cancel
  }
}

