import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../../../stores/auth.js'
import { useResourceData } from '../../resources/useResourceData.js'
import { useResourceNav } from '../../resources/useResourceNav.js'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { active, formatDate, progressMeta, sortTime, text, todayISO } from './outletOperationsMeta.js'
import { toNumber } from './outletStockLogic.js'
import { batchRef } from '../../batchRefs.js'
import { executeActionRequest, responseFailed, failureMessage } from './outletOperationsBatch.js'

const isTrue = (val) => val === true || String(val).toUpperCase() === 'TRUE'

export function useOutletReturns() {
  const $q = useQuasar()
  const resourceIoStore = useResourceIoStore()
  const authStore = useAuthStore()
  const nav = useResourceNav()

  const returnsConfig = computed(() =>
    (Array.isArray(authStore.resources) ? authStore.resources : [])
      .find((r) => r.name === 'OutletReturns') || null
  )
  const returnsPermissions = computed(() => returnsConfig.value?.permissions || {})
  const canCreate = computed(() => !!returnsPermissions.value.canWrite)

  const returns = useResourceData(ref('OutletReturns'))
  const outlets = useResourceData(ref('Outlets'))
  const skus = useResourceData(ref('SKUs'))
  const products = useResourceData(ref('Products'))
  const warehouses = useResourceData(ref('Warehouses'))
  const warehouseStorages = useResourceData(ref('WarehouseStorages'))

  const loading = ref(false)
  const saving = ref(false)
  const acting = ref(false)
  const searchTerm = ref('')
  const activeTab = ref('active')

  const form = ref({
    Date: todayISO(),
    Username: currentUserName(),
    Progress: 'SUBMITTED',
    Status: 'Active',
    OutletCode: '',
    SKU: '',
    Qty: 1,
    Reason: 'DAMAGE',
    ReasonComment: '',
    InvoiceAdjustmentRequired: false,
    InvoiceAdjustmentDone: false,
    WarehouseActionRequired: false,
    WarehouseActionCompleted: false,
    WarehouseCode: ''
  })

  function currentUserName() {
    const user = authStore.user || {}
    return text(user.Name || user.name || user.UserName || user.Username || user.email || user.Email || user.UserID || 'system')
  }

  function productName(productCode) {
    return products.items.value.find((row) => row.Code === productCode)?.Name || productCode || 'Product'
  }

  function skuName(skuCode) {
    const sku = skus.items.value.find((row) => row.Code === skuCode)
    if (!sku) return skuCode || 'Item'
    
    const prodName = productName(sku.ProductCode)
    const siblingSkus = skus.items.value.filter(s => s.ProductCode === sku.ProductCode)
    
    const variants = [sku.Variant1, sku.Variant2, sku.Variant3, sku.Variant4, sku.Variant5]
      .map(text)
      .filter(Boolean)
      .join(' / ')
      
    if (siblingSkus.length <= 1 || !variants) {
      return prodName
    }
    return `${prodName} - ${variants}`
  }

  function outletName(outletCode) {
    return outlets.items.value.find((row) => row.Code === outletCode)?.Name || outletCode || 'Outlet'
  }

  function warehouseName(warehouseCode) {
    return warehouses.items.value.find((row) => row.Code === warehouseCode)?.Name || warehouseCode || 'Warehouse'
  }

  const items = computed(() =>
    returns.items.value
      .filter(active)
      .filter(matchesSearch)
      .sort((a, b) => sortTime(b) - sortTime(a))
  )

  const activeItems = computed(() =>
    items.value.filter(row => text(row.Progress) !== 'CANCELLED' && text(row.Progress) !== 'COMPLETED')
  )

  const completedItems = computed(() =>
    items.value.filter(row => text(row.Progress) === 'CANCELLED' || text(row.Progress) === 'COMPLETED')
  )

  const outletOptions = computed(() =>
    outlets.items.value.filter(active).map((row) => ({ label: text(row.Name || row.Code), value: row.Code }))
  )

  const skuOptions = computed(() =>
    skus.items.value.filter(active).map((sku) => ({ value: sku.Code, label: skuName(sku.Code) }))
  )

  const warehouseOptions = computed(() =>
    warehouses.items.value.filter(active).map((row) => ({ label: text(row.Name || row.Code), value: row.Code }))
  )

  const reasonOptions = [
    { label: 'Damage ⚠️', value: 'DAMAGE' },
    { label: 'Expired 📅', value: 'EXPIRED' },
    { label: 'Slow Moving 🐢', value: 'SLOW_MOVING' },
    { label: 'Recall 🚫', value: 'RECALL' },
    { label: 'Overstock 📦', value: 'OVERSTOCK' },
    { label: 'Specification Mismatch 🔄', value: 'SPECIFICATION_MISMATCH' },
    { label: 'Other ❓', value: 'OTHER' }
  ]

  function matchesSearch(row) {
    const term = searchTerm.value.toLowerCase()
    if (!term) return true
    return (
      JSON.stringify(row).toLowerCase().includes(term) ||
      outletName(row.OutletCode).toLowerCase().includes(term) ||
      skuName(row.SKU).toLowerCase().includes(term)
    )
  }

  function getReturnRecord(code) {
    return returns.items.value.find((row) => row.Code === code) || null
  }

  async function reload(forceSync = false) {
    loading.value = true
    try {
      await resourceIoStore.fetchResources(['OutletReturns', 'Outlets', 'SKUs', 'Products', 'Warehouses', 'WarehouseStorages'], { forceSync })
      if (!form.value.OutletCode && outletOptions.value[0]) {
        form.value.OutletCode = outletOptions.value[0].value
      }
      if (!form.value.SKU && skuOptions.value[0]) {
        form.value.SKU = skuOptions.value[0].value
      }
      if (!form.value.WarehouseCode && warehouseOptions.value[0]) {
        form.value.WarehouseCode = warehouseOptions.value[0].value
      }
    } finally {
      loading.value = false
    }
  }

  function validateBeforeSubmit() {
    if (!text(form.value.OutletCode)) return 'Outlet is required.'
    if (!text(form.value.SKU)) return 'SKU is required.'
    if (toNumber(form.value.Qty) <= 0) return 'Returned quantity must be greater than 0.'
    if (form.value.WarehouseActionRequired && !text(form.value.WarehouseCode)) {
      return 'Target warehouse is required when returning stock to warehouse.'
    }
    return ''
  }

  async function saveReturn() {
    const error = validateBeforeSubmit()
    if (error) {
      $q.notify({ type: 'warning', message: error, position: 'top' })
      return
    }

    saving.value = true
    try {
      const needInvoice = form.value.InvoiceAdjustmentRequired
      const needWarehouse = form.value.WarehouseActionRequired
      if (!needInvoice && !needWarehouse) {
        form.value.Progress = 'COMPLETED'
      } else {
        form.value.Progress = 'SUBMITTED'
      }

      // Prepare record with capital TRUE/FALSE strings for backend
      const preparedRecord = {
        ...form.value,
        InvoiceAdjustmentRequired: form.value.InvoiceAdjustmentRequired ? 'TRUE' : 'FALSE',
        InvoiceAdjustmentDone: form.value.InvoiceAdjustmentDone ? 'TRUE' : 'FALSE',
        WarehouseActionRequired: form.value.WarehouseActionRequired ? 'TRUE' : 'FALSE',
        WarehouseActionCompleted: form.value.WarehouseActionCompleted ? 'TRUE' : 'FALSE'
      }

      // Generate batch requests
      const returnRef = batchRef('OutletReturns.latest.code')
      const requests = [
        {
          action: 'create',
          resource: 'OutletReturns',
          payload: {
            record: preparedRecord
          }
        }
      ]

      // Synchronously compute the instant stock movement QtyChange
      let qtyChange = 0
      const adjReq = form.value.InvoiceAdjustmentRequired
      const whReq = form.value.WarehouseActionRequired
      const qty = toNumber(form.value.Qty)

      if (adjReq && !whReq) {
        qtyChange = qty // Placed back on shelf -> stock goes up
      } else if (!adjReq && whReq) {
        qtyChange = -qty // Removed from shelf -> stock goes down
      }

      if (qtyChange !== 0) {
        requests.push({
          action: 'create',
          resource: 'OutletMovements',
          payload: {
            record: {
              OutletCode: form.value.OutletCode,
              StorageName: '_default',
              SKU: form.value.SKU,
              QtyChange: qtyChange,
              ReferenceType: 'OutletReturn',
              ReferenceCode: returnRef, // Batch Ref resolves to new return code atomically
              Status: 'Active'
            }
          }
        })
      }

      const response = await resourceIoStore.runBatchRequests(requests)
      if (responseFailed(response)) {
        $q.notify({ type: 'negative', message: failureMessage(response, 'Failed to save return.'), position: 'top' })
        return
      }

      const returnCode = response && Array.isArray(response.data?.results) ? response.data.results[0]?.code : ''
      $q.notify({ type: 'positive', message: `Return ${returnCode || ''} submitted successfully.`, position: 'top' })
      nav.goTo('list')
    } catch (err) {
      $q.notify({ type: 'negative', message: 'An error occurred during submission.', position: 'top' })
    } finally {
      saving.value = false
    }
  }

  async function cancelReturn(record, reason) {
    if (!record?.Code) return false
    if (text(record.Progress) === 'CANCELLED') {
      $q.notify({ type: 'warning', message: 'Return is already cancelled.', position: 'top' })
      return false
    }
    if (!reason) {
      $q.notify({ type: 'warning', message: 'Cancellation reason is required.', position: 'top' })
      return false
    }

    acting.value = true
    try {
      const requests = [
        executeActionRequest('OutletReturns', record.Code, { action: 'Cancel', column: 'Progress', columnValue: 'CANCELLED' }, { ProgressCancelledComment: reason })
      ]

      // Synchronously compute the balancing stock reversal QtyChange
      let qtyChange = 0
      const adjReq = isTrue(record.InvoiceAdjustmentRequired)
      const whReq = isTrue(record.WarehouseActionRequired)
      const qty = toNumber(record.Qty)

      if (adjReq && !whReq) {
        qtyChange = -qty // Reversal of customer return -> stock goes down
      } else if (!adjReq && whReq) {
        qtyChange = qty // Reversal of shelf removal -> stock goes up
      }

      if (qtyChange !== 0) {
        requests.push({
          action: 'create',
          resource: 'OutletMovements',
          payload: {
            record: {
              OutletCode: record.OutletCode,
              StorageName: '_default',
              SKU: record.SKU,
              QtyChange: qtyChange,
              ReferenceType: 'OutletReturn',
              ReferenceCode: record.Code,
              Status: 'Active'
            }
          }
        })
      }

      const result = await resourceIoStore.runBatchRequests(requests)
      if (responseFailed(result)) {
        $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to cancel return.'), position: 'top' })
        return false
      }

      await reload(true)
      $q.notify({ type: 'positive', message: `Return ${record.Code} successfully cancelled.`, position: 'top' })
      return true
    } catch (e) {
      $q.notify({ type: 'negative', message: 'An error occurred during cancellation.', position: 'top' })
      return false
    } finally {
      acting.value = false
    }
  }

  async function markInvoiceAdjusted(record, comment) {
    if (!record?.Code) return false
    acting.value = true
    try {
      const updatePayload = { InvoiceAdjustmentDone: 'TRUE' }
      const isWhCompleted = isTrue(record.WarehouseActionCompleted) || !isTrue(record.WarehouseActionRequired)
      if (isWhCompleted) {
        updatePayload.Progress = 'COMPLETED'
      }

      const result = await resourceIoStore.runBatchRequests([
        executeActionRequest('OutletReturns', record.Code, { action: 'MarkInvoiceAdjusted', column: 'InvoiceAdjustmentDone', columnValue: 'TRUE' }, { ProgressInvoiceAdjustedComment: comment || 'Invoice adjusted manually.' }),
        {
          action: 'update',
          resource: 'OutletReturns',
          payload: {
            code: record.Code,
            record: updatePayload
          }
        }
      ])
      if (responseFailed(result)) {
        $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to mark invoice adjusted.'), position: 'top' })
        return false
      }
      await reload(true)
      $q.notify({ type: 'positive', message: `Invoice adjustment marked completed for ${record.Code}.`, position: 'top' })
      return true
    } catch (e) {
      return false
    } finally {
      acting.value = false
    }
  }

  async function markWarehouseActionCompleted(record, actionType, storageName, comment) {
    if (!record?.Code) return false
    acting.value = true
    try {
      const isDisposed = actionType === 'Disposed'
      const updatePayload = {
        WarehouseActionCompleted: 'TRUE',
        WarehouseAction: isDisposed ? 'Disposed' : 'Stocked'
      }
      if (isDisposed) {
        updatePayload.WarehouseActionDisposedReason = comment || ''
      }
      
      const isInvCompleted = isTrue(record.InvoiceAdjustmentDone) || !isTrue(record.InvoiceAdjustmentRequired)
      if (isInvCompleted) {
        updatePayload.Progress = 'COMPLETED'
      }

      const requests = []
      if (isDisposed) {
        requests.push(
          executeActionRequest(
            'OutletReturns',
            record.Code,
            { action: 'Dispose', column: 'WarehouseAction', columnValue: 'Disposed' },
            { WarehouseActionDisposedReason: comment || 'Disposed' }
          )
        )
      } else {
        requests.push(
          executeActionRequest(
            'OutletReturns',
            record.Code,
            { action: 'Stock', column: 'WarehouseAction', columnValue: 'Stocked' }
          )
        )
      }

      requests.push({
        action: 'update',
        resource: 'OutletReturns',
        payload: {
          code: record.Code,
          record: updatePayload
        }
      })

      if (!isDisposed && record.WarehouseCode) {
        requests.push({
          action: 'create',
          resource: 'StockMovements',
          payload: {
            record: {
              WarehouseCode: record.WarehouseCode,
              StorageName: storageName || '_default',
              SKU: record.SKU,
              QtyChange: toNumber(record.Qty),
              ReferenceType: 'OutletReturn',
              ReferenceCode: record.Code,
              Status: 'Active'
            }
          }
        })
      }

      const result = await resourceIoStore.runBatchRequests(requests)
      if (responseFailed(result)) {
        $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to confirm warehouse action.'), position: 'top' })
        return false
      }

      await reload(true)
      $q.notify({ type: 'positive', message: `Warehouse action completed for ${record.Code}.`, position: 'top' })
      return true
    } catch (e) {
      return false
    } finally {
      acting.value = false
    }
  }

  function getProgressMeta(progress) {
    return progressMeta(progress)
  }

  function formatDisplayDate(value) {
    return formatDate(value) || '-'
  }

  function cancel() {
    nav.goTo('list')
  }

  function navigateTo(code) {
    nav.goTo('view', { code })
  }

  function navigateToAdd() {
    nav.goTo('add')
  }

  return {
    loading,
    saving,
    acting,
    searchTerm,
    activeTab,
    form,
    items,
    activeItems,
    completedItems,
    outletOptions,
    skuOptions,
    warehouseOptions,
    reasonOptions,
    warehouseStorages,
    reload,
    saveReturn,
    cancelReturn,
    markInvoiceAdjusted,
    markWarehouseActionCompleted,
    getReturnRecord,
    getProgressMeta,
    formatDisplayDate,
    skuName,
    outletName,
    warehouseName,
    cancel,
    navigateTo,
    navigateToAdd,
    canCreate,
    text,
    todayISO,
    isTrue
  }
}
