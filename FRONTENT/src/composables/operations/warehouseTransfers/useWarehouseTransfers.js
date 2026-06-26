import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useWarehouseStockList } from 'src/composables/masters/warehouses/useWarehouseStockList'
import { useProductSkuResolver } from 'src/composables/masters/products/useProductSkuResolver'
import { batchRef } from 'src/composables/batchRefs'
import { useRecord } from '../../resources/useRecord.js'

export function useWarehouseTransfers() {
  const route = useRoute()
  const $q = useQuasar()
  const authStore = useAuthStore()
  const resourceIoStore = useResourceIoStore()
  const nav = useResourceNav()
  const { skuInfo } = useProductSkuResolver()

  const loadedItemCodes = ref([])
  const isEditMode = computed(() => {
    return !!route.params.code && route.path.endsWith('/_edit')
  })
  const editCode = computed(() => route.params.code)

  const loading = ref(false)
  const saving = ref(false)
  const viewMode = ref('storage')

  const transfers = useRecord(ref('WarehouseTransfers'))
  const transferItems = useRecord(ref('WarehouseTransferItems'))
  const skus = useRecord(ref('SKUs'))
  const products = useRecord(ref('Products'))
  const warehouses = useRecord(ref('Warehouses'))
  const warehouseStorages = useRecord(ref('WarehouseStorages'))

  const form = ref({
    SourceWarehouseCode: '',
    DestinationWarehouseCode: '',
    Date: new Date().toISOString().substring(0, 10),
    Reference: '',
    IsInstant: false,
    InstantDestinationStorageName: '_default'
  })
  const addedItems = ref([])
  const sourceWarehouseCode = computed(() => form.value.SourceWarehouseCode)
  const sourceWarehouse = computed(() => warehouses.items.value.find((w) => w.Code === sourceWarehouseCode.value))
  const sourceStock = useWarehouseStockList(sourceWarehouseCode)
  const destinationWarehouseCode = computed(() => form.value.DestinationWarehouseCode)
  const destinationWarehouse = computed(() => warehouses.items.value.find((w) => w.Code === destinationWarehouseCode.value))

  const active = (row) => (row.Status || 'Active') === 'Active'
  const text = (value) => (value || '').toString().trim()
  const number = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const sourceStockRows = computed(() =>
    sourceStock.stockRows.value
      .filter((row) => number(row.QuantityValue) > 0)
      .map((row) => ({
        ...row,
        TransferItemKey: transferRowKey(row),
        TransferQuantity: transferQuantityFor(row),
        sourceWarehouseCode: sourceWarehouseCode.value,
        destinationWarehouseCode: destinationWarehouseCode.value
      }))
  )

  const sourceWarehouseTotalItems = computed(() => sourceStockRows.value.length)
  const sourceWarehouseTotalQuantity = computed(() =>
    sourceStockRows.value.reduce((sum, row) => sum + number(row.QuantityValue), 0)
  )
  const selectedTransferQuantity = computed(() =>
    addedItems.value.reduce((sum, row) => sum + number(row.Quantity), 0)
  )
  const canProceedBasic = computed(() =>
    !!form.value.SourceWarehouseCode
    && form.value.SourceWarehouseCode !== form.value.DestinationWarehouseCode
  )
  const canProceedItems = computed(() => addedItems.value.length > 0)
  const submitLabel = computed(() =>
    !form.value.DestinationWarehouseCode || form.value.IsInstant ? 'Submit Transfer' : 'Send for Approval'
  )
  const headerStats = computed(() => [
    { label: 'Source Items', value: sourceWarehouseTotalItems.value },
    { label: 'Selected', value: addedItems.value.length },
    { label: 'Qty', value: selectedTransferQuantity.value }
  ])

  const warehouseOptions = computed(() =>
    warehouses.items.value.filter(active).map((row) => ({
      label: `${row.Code} - ${row.Name || row.Code}`,
      value: row.Code
    }))
  )

  const skuOptions = computed(() =>
    skus.items.value.filter(active).map((sku) => ({
      value: sku.Code,
      label: `${sku.Code} - ${skuName(sku.Code)}`
    }))
  )

  function skuName(skuCode) {
    const info = skuInfo(skuCode) || {}
    const variants = (info.variantValues || []).filter(Boolean).join(' / ')
    if (info.productName && variants) return `${info.productName} - ${variants}`
    return info.productName || skuCode || 'Item'
  }

  function transferRowKey(row) {
    return `${text(row.SKUCode || row.SKU)}::${text(row.StorageName || '_default')}`
  }

  function groupKey(row) {
    return viewMode.value === 'storage' ? row.StorageLabel : row.ProductName
  }

  function itemLabel(row) {
    const variants = (row.VariantValues || row.variantValues || []).filter(Boolean).join(' / ')
    return viewMode.value === 'storage'
      ? row.ProductName
      : [row.SKUCode || row.SKU, variants].filter(Boolean).join(' - ')
  }

  function itemCaption(row) {
    const variants = (row.VariantValues || row.variantValues || []).filter(Boolean).join(' / ')
    return viewMode.value === 'storage'
      ? [row.SKUCode || row.SKU, variants].filter(Boolean).join(' - ')
      : row.StorageLabel
  }

  function transferQuantityFor(row) {
    const key = typeof row === 'string' ? row : transferRowKey(row)
    return number(addedItems.value.find((item) => item.TransferItemKey === key)?.Quantity)
  }

  function updateTransferQuantity(row, qty) {
    if (!row) return
    const requestedQty = Math.max(0, number(qty))
    const quantity = Math.min(requestedQty, number(row.QuantityValue))
    if (requestedQty > number(row.QuantityValue)) {
      $q.notify({ type: 'warning', message: 'Transfer quantity cannot exceed available stock.', position: 'top' })
    }

    const key = transferRowKey(row)
    const index = addedItems.value.findIndex((item) => item.TransferItemKey === key)
    if (quantity <= 0) {
      if (index !== -1) addedItems.value.splice(index, 1)
      return
    }

    const item = {
      TransferItemKey: key,
      SKUCode: row.SKUCode || row.SKU,
      Quantity: quantity,
      SourceStorageName: row.StorageName || '_default',
      DestinationStorageName: '_default',
      skuLabel: skuName(row.SKUCode || row.SKU),
      ProductName: row.ProductName,
      VariantValues: row.VariantValues || row.variantValues || [],
      StorageLabel: row.StorageLabel,
      AvailableQuantity: number(row.QuantityValue)
    }
    if (index === -1) {
      addedItems.value.push(item)
    } else {
      addedItems.value[index] = item
    }
  }

  function totalItemsInSourceWarehouse() {
    return sourceWarehouseTotalItems.value
  }

  function getStorageOptionsForWarehouse(warehouseCode) {
    if (!warehouseCode) return [{ label: '_default', value: '_default' }]
    const list = warehouseStorages.items.value
      .filter((row) => row.WarehouseCode === warehouseCode)
      .map((row) => row.StorageName)
      .filter(Boolean)
    const unique = Array.from(new Set(list))
    if (!unique.includes('_default')) unique.push('_default')
    return unique.map((name) => ({ label: name, value: name }))
  }

  async function reload(forceSync = false) {
    loading.value = true
    try {
      await resourceIoStore.fetchResources([
        'WarehouseTransfers',
        'WarehouseTransferItems',
        'SKUs',
        'Products',
        'Warehouses',
        'WarehouseStorages'
      ], { forceSync })
    } finally {
      loading.value = false
    }
  }

  function addTransferItem(item) {
    const stockRow = sourceStockRows.value.find((row) =>
      text(row.SKUCode || row.SKU) === text(item.SKUCode) &&
      text(row.StorageName || '_default') === text(item.SourceStorageName || '_default')
    )
    if (stockRow) {
      updateTransferQuantity(stockRow, transferQuantityFor(stockRow) + number(item.Quantity))
      return
    }
    if (!item.SKUCode) {
      $q.notify({ type: 'warning', message: 'Please select a product/SKU.', position: 'top' })
      return
    }
    if (number(item.Quantity) <= 0) {
      $q.notify({ type: 'warning', message: 'Quantity must be greater than 0.', position: 'top' })
    }
  }

  function removeTransferItem(itemOrIndex) {
    if (typeof itemOrIndex === 'number') {
      addedItems.value.splice(itemOrIndex, 1)
      return
    }
    const index = addedItems.value.findIndex((item) => item.TransferItemKey === itemOrIndex?.TransferItemKey)
    if (index !== -1) addedItems.value.splice(index, 1)
  }

  function validateBeforeSubmit(mode = 'submit') {
    if (!form.value.SourceWarehouseCode) return 'Source Warehouse is required.'
    if (form.value.IsInstant && !form.value.DestinationWarehouseCode) return 'Destination Warehouse is required for instant transfers.'
    if (form.value.SourceWarehouseCode === form.value.DestinationWarehouseCode) return 'Source and Destination Warehouses cannot be the same.'
    if (addedItems.value.length === 0) return 'At least one item must be added to the transfer.'
    const overdrawn = addedItems.value.find((item) => number(item.Quantity) > number(item.AvailableQuantity))
    if (overdrawn) return `${overdrawn.SKUCode} exceeds available stock.`
    if (mode === 'draft') return ''
    return ''
  }

  function buildTransferRecord(progress) {
    return {
      SourceWarehouseCode: form.value.SourceWarehouseCode,
      DestinationWarehouseCode: form.value.DestinationWarehouseCode || '',
      Date: form.value.Date,
      Username: authStore.user?.name || authStore.user?.id || 'System',
      Reference: form.value.Reference || '',
      IsInstant: form.value.IsInstant ? 'TRUE' : 'FALSE',
      Progress: progress,
      Status: 'Active'
    }
  }

  function buildTransferItem(item, transferCode = '') {
    // For instant transfers, the user may have chosen a specific destination storage.
    // Fall back to item.DestinationStorageName (set during CompleteTransfer) or _default.
    const destStorage = form.value.IsInstant && form.value.InstantDestinationStorageName
      ? form.value.InstantDestinationStorageName
      : (item.DestinationStorageName || '_default')
    return {
      ...(transferCode ? { WarehouseTransferCode: transferCode } : {}),
      SKUCode: item.SKUCode,
      Quantity: item.Quantity,
      SourceStorageName: item.SourceStorageName || '_default',
      DestinationStorageName: destStorage,
      Progress: 'PENDING',
      Status: 'Active'
    }
  }

  function responseFailed(response) {
    return !response?.success || (Array.isArray(response.data) && response.data.some((entry) => entry?.success === false))
  }

  function failureMessage(response, fallback) {
    const failed = Array.isArray(response?.data) ? response.data.find((entry) => entry?.success === false) : null
    return failed?.error || failed?.message || response?.error || response?.message || fallback
  }

  function resetForm() {
    form.value = {
      SourceWarehouseCode: '',
      DestinationWarehouseCode: '',
      Date: new Date().toISOString().substring(0, 10),
      Reference: '',
      IsInstant: false,
      InstantDestinationStorageName: '_default'
    }
    addedItems.value = []
  }

  async function saveDraftTransfer() {
    const childrenRecords = []
    if (isEditMode.value && loadedItemCodes.value.length > 0) {
      for (const itemCode of loadedItemCodes.value) {
        childrenRecords.push({
          _action: 'deactivate',
          _originalCode: itemCode,
          data: { Status: 'Inactive' }
        })
      }
    }
    for (const item of addedItems.value) {
      childrenRecords.push({
        _action: 'create',
        data: buildTransferItem(item, isEditMode.value ? editCode.value : '')
      })
    }

    const payload = {
      resource: 'WarehouseTransfers',
      data: buildTransferRecord('DRAFT'),
      children: [
        {
          resource: 'WarehouseTransferItems',
          records: childrenRecords
        }
      ]
    }

    if (isEditMode.value) {
      payload.code = editCode.value
    }

    const response = await resourceIoStore.saveComposite(payload)
    if (!response?.success) {
      $q.notify({ type: 'negative', message: response?.error || 'Failed to save transfer draft.', position: 'top' })
      return false
    }
    $q.notify({ type: 'positive', message: 'Warehouse Transfer draft saved.', position: 'top' })
    resetForm()
    nav.goTo('index')
    return true
  }

  async function submitTransfer() {
    const isInstant = form.value.IsInstant
    const destWH = form.value.DestinationWarehouseCode || ''

    // Determine workflow progress transition action
    let actionName = 'Approve'
    let columnValue = 'APPROVED'
    if (destWH) {
      actionName = isInstant ? 'Complete' : 'Submit'
      columnValue = isInstant ? 'COMPLETED' : 'PENDING_APPROVAL'
    }

    const wtCodeRef = isEditMode.value ? editCode.value : batchRef('WarehouseTransfers.latest.code')

    // 1. Composite Save Request (saves WT parent and WTI children as DRAFT first)
    const childrenRecords = []
    if (isEditMode.value && loadedItemCodes.value.length > 0) {
      for (const itemCode of loadedItemCodes.value) {
        childrenRecords.push({
          _action: 'deactivate',
          _originalCode: itemCode,
          data: { Status: 'Inactive' }
        })
      }
    }
    for (const item of addedItems.value) {
      childrenRecords.push({
        _action: 'create',
        data: buildTransferItem(item, isEditMode.value ? editCode.value : '')
      })
    }

    const compositePayload = {
      resource: 'WarehouseTransfers',
      data: buildTransferRecord('DRAFT'),
      children: [
        {
          resource: 'WarehouseTransferItems',
          records: childrenRecords
        }
      ]
    }

    if (isEditMode.value) {
      compositePayload.code = editCode.value
    }

    const compositeRequest = {
      action: 'compositeSave',
      resource: 'WarehouseTransfers',
      payload: compositePayload
    }

    // 2. Negative Stock Movements Request (Source Warehouse Deduction)
    const movements = addedItems.value.map((item) => ({
      WarehouseCode: form.value.SourceWarehouseCode,
      StorageName: item.SourceStorageName || '_default',
      SKU: item.SKUCode,
      QtyChange: -Math.abs(Number(item.Quantity)),
      ReferenceType: 'WarehouseTransfer',
      ReferenceCode: wtCodeRef,
      Status: 'Active'
    }))

    const stockRequest = {
      action: 'bulk',
      resource: 'StockMovements',
      payload: {
        targetResource: 'StockMovements',
        records: movements,
        lastUpdatedAtResources: ['StockMovements', 'WarehouseStorages']
      }
    }

    // 3. Execute Action Request to transition progress out of DRAFT
    const actionRequest = {
      action: 'executeAction',
      resource: 'WarehouseTransfers',
      payload: {
        code: wtCodeRef,
        actionName: actionName,
        column: 'Progress',
        columnValue: columnValue,
        fields: {},
        lastUpdatedAtResources: ['WarehouseTransfers', 'WarehouseTransferItems']
      }
    }

    const getStoragesRequest = {
      action: 'get',
      resource: 'WarehouseStorages',
      payload: {}
    }

    const requests = [compositeRequest, stockRequest, actionRequest, getStoragesRequest]

    const response = await resourceIoStore.runBatchRequests(requests)
    if (responseFailed(response)) {
      $q.notify({ type: 'negative', message: failureMessage(response, 'Failed to submit Warehouse Transfer.'), position: 'top' })
      return false
    }

    $q.notify({ type: 'positive', message: 'Warehouse Transfer submitted successfully.', position: 'top' })
    resetForm()
    nav.goTo('index')
    return true
  }

  async function saveTransfer(mode = 'submit') {
    const error = validateBeforeSubmit(mode)
    if (error) {
      $q.notify({ type: 'warning', message: error, position: 'top' })
      return false
    }
    saving.value = true
    try {
      return mode === 'draft' ? await saveDraftTransfer() : await submitTransfer()
    } catch (e) {
      $q.notify({ type: 'negative', message: 'An error occurred during submission.', position: 'top' })
      return false
    } finally {
      saving.value = false
    }
  }

  async function executeAction(code, actionName, fields = {}) {
    saving.value = true
    try {
      const columnValue = actionName === 'Approve' ? 'APPROVED'
        : actionName === 'Reject' ? 'REJECTED'
        : 'COMPLETED'

      const requests = [
        {
          action: 'executeAction',
          resource: 'WarehouseTransfers',
          payload: {
            code,
            actionName,
            column: 'Progress',
            columnValue,
            fields,
            lastUpdatedAtResources: ['WarehouseTransfers']
          }
        },
        {
          action: 'get',
          resource: 'WarehouseTransferItems',
          payload: { lastUpdatedAtResources: ['WarehouseTransferItems'] }
        }
      ]

      // Reject reverses stock movements → WarehouseStorages changes too
      if (actionName === 'Reject') {
        requests.push({
          action: 'get',
          resource: 'WarehouseStorages',
          payload: {}
        })
      }

      const response = await resourceIoStore.runBatchRequests(requests)
      if (response?.success) {
        $q.notify({ type: 'positive', message: `${actionName} action completed successfully.` })
        return true
      }
      $q.notify({ type: 'negative', message: response?.error || `Failed to execute ${actionName} action.` })
      return false
    } catch (e) {
      $q.notify({ type: 'negative', message: 'Action execution failed.' })
      return false
    } finally {
      saving.value = false
    }
  }

  async function completeItem(itemCode, destStorage) {
    saving.value = true
    try {
      const response = await resourceIoStore.updateResourceRecord('WarehouseTransferItems', itemCode, {
        DestinationStorageName: destStorage || '_default',
        Progress: 'TRANSFERRED'
      })
      if (response?.success) {
        $q.notify({ type: 'positive', message: 'Item transferred successfully.' })
        await reload(true)
        return true
      }
      $q.notify({ type: 'negative', message: response?.error || 'Failed to complete item transfer.' })
      return false
    } catch (e) {
      $q.notify({ type: 'negative', message: 'Failed to complete item transfer.' })
      return false
    } finally {
      saving.value = false
    }
  }

  async function completeWarehouseTransfer(wtCode, destWH, itemsList) {
    saving.value = true
    try {
      const requests = []

      // Step 1: Set DestinationStorageName + Quantity on each WTI — keep Progress=PENDING
      // so the Complete action picks them all up in one pass and writes correct stock.
      for (const item of itemsList) {
        if (!item.Code) continue
        const splits = item.splits.filter(s => (Number(s.qty) || 0) > 0 && s.storage)
        if (splits.length === 0) continue

        // Update original WTI with first split's storage and qty (keep PENDING)
        requests.push({
          action: 'update',
          resource: 'WarehouseTransferItems',
          payload: {
            code: item.Code,
            record: {
              Quantity: splits[0].qty,
              DestinationStorageName: splits[0].storage
            },
            lastUpdatedAtResources: ['WarehouseTransferItems']
          }
        })

        // For each additional split, create a new WTI row (PENDING) so the
        // Complete action writes a separate stock movement for each storage
        for (let i = 1; i < splits.length; i++) {
          requests.push({
            action: 'create',
            resource: 'WarehouseTransferItems',
            payload: {
              record: {
                WarehouseTransferCode: wtCode,
                SKUCode: item.SKUCode,
                Quantity: splits[i].qty,
                SourceStorageName: item.SourceStorageName || '_default',
                DestinationStorageName: splits[i].storage,
                Progress: 'PENDING',
                Status: 'Active'
              },
              lastUpdatedAtResources: ['WarehouseTransferItems']
            }
          })
        }
      }

      // Step 2: Complete the transfer — GAS loops all PENDING items, writes a stock
      // movement per item using each item's qty and DestinationStorageName, then marks
      // items TRANSFERRED and the WT header COMPLETED.
      const transfer = transfers.items.value.find(t => t.Code === wtCode)
      const alreadyHasDestination = !!transfer?.DestinationWarehouseCode
      requests.push({
        action: 'executeAction',
        resource: 'WarehouseTransfers',
        payload: {
          code: wtCode,
          actionName: alreadyHasDestination ? 'Complete' : 'ClaimAndComplete',
          column: 'Progress',
          columnValue: 'COMPLETED',
          fields: alreadyHasDestination ? {} : { DestinationWarehouseCode: destWH },
          lastUpdatedAtResources: ['WarehouseTransfers', 'WarehouseTransferItems']
        }
      })

      // Step 3: Refresh WarehouseStorages so stock levels reflect the new movements
      requests.push({
        action: 'get',
        resource: 'WarehouseStorages',
        payload: {}
      })

      const response = await resourceIoStore.runBatchRequests(requests)
      if (responseFailed(response)) {
        $q.notify({ type: 'negative', message: failureMessage(response, 'Failed to complete transfer.'), position: 'top' })
        return false
      }

      $q.notify({ type: 'positive', message: 'Transfer completed successfully.', position: 'top' })
      return true
    } catch (e) {
      $q.notify({ type: 'negative', message: 'Failed to complete transfer.', position: 'top' })
      return false
    } finally {
      saving.value = false
    }
  }

  function initializeEditData(codeVal) {
    const parent = transfers.items.value.find((r) => r.Code === codeVal)
    if (!parent) return

    form.value = {
      SourceWarehouseCode: parent.SourceWarehouseCode || '',
      DestinationWarehouseCode: parent.DestinationWarehouseCode || '',
      Date: parent.Date || new Date().toISOString().substring(0, 10),
      Reference: parent.Reference || '',
      IsInstant: parent.IsInstant === 'TRUE' || parent.IsInstant === true
    }

    const items = transferItems.items.value.filter(
      (item) => item.WarehouseTransferCode === codeVal && active(item)
    )

    loadedItemCodes.value = items.map((item) => item.Code)

    addedItems.value = items.map((item) => {
      const key = `${item.SKUCode}::${item.SourceStorageName || '_default'}`
      const info = skuInfo(item.SKUCode) || {}
      const variants = info.variantValues || []

      // Look up available qty in warehouse storage
      const storageRow = warehouseStorages.items.value.find(
        (s) => s.WarehouseCode === parent.SourceWarehouseCode &&
               s.SKU === item.SKUCode &&
               (s.StorageName || '_default') === (item.SourceStorageName || '_default')
      )
      const availableQty = storageRow ? number(storageRow.Quantity) : 0

      return {
        TransferItemKey: key,
        SKUCode: item.SKUCode,
        Quantity: number(item.Quantity),
        SourceStorageName: item.SourceStorageName || '_default',
        DestinationStorageName: item.DestinationStorageName || '_default',
        skuLabel: skuName(item.SKUCode),
        ProductName: info.productName || item.SKUCode,
        VariantValues: variants,
        StorageLabel: item.SourceStorageName === '_default' || !item.SourceStorageName ? 'Default' : item.SourceStorageName,
        AvailableQuantity: availableQty
      }
    })
  }

  watch(
    () => [isEditMode.value, editCode.value, transfers.loading.value, transferItems.loading.value],
    ([isEdit, codeVal, wtLoading, wtiLoading]) => {
      if (isEdit && codeVal && !wtLoading && !wtiLoading) {
        initializeEditData(codeVal)
      }
    },
    { immediate: true }
  )

  watch(() => form.value.SourceWarehouseCode, (newVal, oldVal) => {
    if (oldVal && newVal !== oldVal) {
      addedItems.value = []
    }
  })

  watch(() => form.value.DestinationWarehouseCode, (value) => {
    if (!value) {
      form.value.IsInstant = false
      form.value.InstantDestinationStorageName = '_default'
    }
  })

  watch(() => form.value.IsInstant, (value) => {
    if (!value) form.value.InstantDestinationStorageName = '_default'
  })

  return {
    isEditMode,
    loading, saving, viewMode, transfers, transferItems, skus, products, warehouses, warehouseStorages,
    form, addedItems, warehouseOptions, skuOptions, sourceStockRows, sourceWarehouseTotalItems, sourceWarehouseTotalQuantity,
    selectedTransferQuantity, canProceedBasic, canProceedItems, submitLabel, headerStats, skuName, groupKey, itemLabel,
    itemCaption, transferQuantityFor, updateTransferQuantity, totalItemsInSourceWarehouse, getStorageOptionsForWarehouse,
    reload, addTransferItem, removeTransferItem, saveTransfer, executeAction, completeItem, completeWarehouseTransfer
  }
}
