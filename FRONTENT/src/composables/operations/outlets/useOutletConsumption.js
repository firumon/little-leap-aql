import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../../../stores/auth.js'
import { useResourceData } from '../../resources/useResourceData.js'
import { useResourceNav } from '../../resources/useResourceNav.js'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { OUTLET_OPERATION_RESOURCES, CONSUMPTION_PROGRESS_ORDER, active, formatDate, progressMeta, sortTime, text, todayISO, visitProgress } from './outletOperationsMeta.js'
import { toNumber, validateConsumption } from './outletStockLogic.js'
import { batchRef, batchResultCode, compositeSaveRequest, executeActionRequest, failureMessage, OUTLET_ACTIONS, resourceUpdateRequest, responseFailed } from './outletOperationsBatch.js'
import {
  buildConsumptionCompositePayload,
  buildConsumptionInvoiceRequest,
  buildConsumptionInvoiceItemsRequest,
  buildConsumptionMovementRequest,
  buildInvoiceGeneratedRequest,
  buildNextVisitRequest,
  buildRestockCompositeRequest,
  buildRestockSubmitRequest,
  buildVisitCompleteRequest
} from './outletConsumptionPayload.js'
import { resolveInvoicePricing, resolvePriceListCode, resolvePricesForPriceList, getInvoiceTotal, getInvoiceRemaining, resolvePriceListLookup, resolveSkuPrice } from './outletConsumptionPricing.js'

const INVOICE_PROGRESS_ORDER = ['PENDING_PAYMENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'OTHER']

export function useOutletConsumption() {
  const $q = useQuasar()
  const resourceIoStore = useResourceIoStore()
  const authStore = useAuthStore()
  const nav = useResourceNav()
  const consumptions = useResourceData(ref('OutletConsumptions'))
  const consumptionItems = useResourceData(ref('OutletConsumptionItems'))
  const consumptionInvoiceItems = useResourceData(ref('OutletConsumptionInvoiceItems'))
  const invoices = useResourceData(ref('OutletConsumptionInvoices'))
  const storages = useResourceData(ref('OutletStorages'))
  const outlets = useResourceData(ref('Outlets'))
  const visits = useResourceData(ref('OutletVisits'))
  const rules = useResourceData(ref('OutletOperatingRules'))
  const skus = useResourceData(ref('SKUs'))
  const products = useResourceData(ref('Products'))
  const priceLists = useResourceData(ref('PriceList'))
  const priceListItems = useResourceData(ref('PriceListItems'))
  const restocks = useResourceData(ref('OutletRestocks'))
  const returns = useResourceData(ref('OutletReturns'))
  const warehouses = useResourceData(ref('Warehouses'))

  const consumptionConfig = computed(() =>
    (Array.isArray(authStore.resources) ? authStore.resources : [])
      .find(r => r.name === 'OutletConsumptions') || null
  )
  const consumptionPermissions = computed(() => consumptionConfig.value?.permissions || {})
  const canCreate = computed(() => !!consumptionPermissions.value.canWrite)

  const invoiceConfig = computed(() =>
    (Array.isArray(authStore.resources) ? authStore.resources : [])
      .find(r => r.name === 'OutletConsumptionInvoices') || null
  )
  const invoicePermissions = computed(() => invoiceConfig.value?.permissions || {})
  const canReadInvoice = computed(() => !!invoicePermissions.value.canRead)

  const restockConfig = computed(() =>
    (Array.isArray(authStore.resources) ? authStore.resources : [])
      .find(r => r.name === 'OutletRestocks') || null
  )
  const restockPermissions = computed(() => restockConfig.value?.permissions || {})
  const canReadRestock = computed(() => !!restockPermissions.value.canRead)

  const loading = ref(false)
  const saving = ref(false)
  const acting = ref(false)
  const searchTerm = ref('')
  const activeGroupKey = ref('')
  const activeInvoiceGroupKey = ref('')
  const form = ref({ Date: todayISO(), Username: currentUserName(), Progress: 'PENDING_INVOICE_GENERATION', Status: 'Active', OutletVisitCode: '' })
  const stockRows = ref([])
  const restockRows = ref([])
  const checklist = ref({ completeVisit: false, scheduleNextVisit: true, generateInvoice: true, placeRestock: false, submitRestock: false, applyReturnsToInvoice: true })

  const returnMetadata = ref({})

  const returnRows = computed(() => {
    return stockRows.value
      .filter((row) => toNumber(row.CurrentQty) > toNumber(row.SystemQty))
      .map((row) => {
        const qty = toNumber(row.CurrentQty) - toNumber(row.SystemQty)
        if (!returnMetadata.value[row.SKU]) {
          returnMetadata.value[row.SKU] = {
            Reason: 'DAMAGE',
            ReasonComment: '',
            InvoiceAdjustmentRequired: true,
            WarehouseActionRequired: false,
            WarehouseCode: warehouseOptions.value[0]?.value || ''
          }
        }
        return {
          ...row,
          Qty: qty
        }
      })
  })

  const warehouseOptions = computed(() =>
    warehouses.items.value.filter(active).map((row) => ({ label: text(row.Name || row.Code), value: row.Code }))
  )

  const returnConfig = computed(() =>
    (Array.isArray(authStore.resources) ? authStore.resources : [])
      .find((r) => r.name === 'OutletReturns') || null
  )
  const returnPermissions = computed(() => returnConfig.value?.permissions || {})
  const canCreateReturn = computed(() => !!returnPermissions.value.canWrite)

  function addManualReturnSku(skuCode) {
    const sku = skus.items.value.find((entry) => entry.Code === skuCode) || {}
    stockRows.value.push({
      SKU: skuCode,
      ProductCode: sku.ProductCode || '',
      ProductName: productName(sku.ProductCode),
      SkuLabel: `${skuCode}${skuLabelSuffix(sku)}`,
      SystemQty: 0,
      CurrentQty: 1,
      SoldQty: 0,
      isManualReturn: true
    })
    syncChecklist()
  }

  function updateReturnMetadata(sku, patch = {}) {
    if (!returnMetadata.value[sku]) {
      returnMetadata.value[sku] = {
        Reason: 'DAMAGE',
        ReasonComment: '',
        InvoiceAdjustmentRequired: true,
        WarehouseActionRequired: false,
        WarehouseCode: warehouseOptions.value[0]?.value || ''
      }
    }
    returnMetadata.value[sku] = { ...returnMetadata.value[sku], ...patch }
  }

  function removeManualReturnRow(index) {
    stockRows.value.splice(index, 1)
    syncChecklist()
  }

  function currentUserName() {
    const user = authStore.user || {}
    return text(user.Name || user.name || user.UserName || user.Username || user.email || user.Email || user.UserID || user.Code)
  }

  function skuLabelSuffix(sku = {}) {
    const variants = [sku.Variant1, sku.Variant2, sku.Variant3, sku.Variant4, sku.Variant5].map(text).filter(Boolean).join(' / ')
    return variants ? ` / ${variants}` : ''
  }

  function productName(productCode) { return products.items.value.find((row) => row.Code === productCode)?.Name || productCode || 'Product' }
  function outletName(outletCode) { return outlets.items.value.find((row) => row.Code === outletCode)?.Name || outletCode || 'Outlet' }
  function skuName(skuCode) {
    const sku = skus.items.value.find((row) => row.Code === skuCode) || {}
    return `${skuCode}${sku.ProductCode ? ` - ${productName(sku.ProductCode)}` : ''}${skuLabelSuffix(sku)}`
  }
  function visitLabel(visitCode) {
    const visit = visits.items.value.find((row) => row.Code === visitCode)
    return visit ? `${visit.Code} - ${formatDate(visit.Date)}` : text(visitCode)
  }

  const items = computed(() => consumptions.items.value.filter(active).filter(matchesSearch).sort((a, b) => sortTime(b) - sortTime(a)))
  const invoiceItems = computed(() => invoices.items.value.filter(active).filter(matchesSearch).sort((a, b) => sortTime(b) - sortTime(a)))
  const groups = computed(() => CONSUMPTION_PROGRESS_ORDER.map((key) => ({ key, meta: progressMeta(key), items: items.value.filter((row) => groupKey(row.Progress, CONSUMPTION_PROGRESS_ORDER) === key) })).filter((group) => group.items.length))
  const invoiceGroups = computed(() => INVOICE_PROGRESS_ORDER.map((key) => ({ key, meta: progressMeta(key), items: invoiceItems.value.filter((row) => groupKey(row.Progress, INVOICE_PROGRESS_ORDER) === key) })).filter((group) => group.items.length))
  const outletOptions = computed(() => outlets.items.value.filter(active).map((row) => ({ label: text(row.Name || row.Code), value: row.Code })))
  const allPlannedVisits = computed(() => visits.items.value.filter(active).filter((row) => visitProgress(row) === 'PLANNED').sort((a, b) => Date.parse(text(a.Date) || '') - Date.parse(text(b.Date) || '')))
  const plannedVisits = computed(() => visits.items.value.filter(active).filter((row) => visitProgress(row) === 'PLANNED' && text(row.OutletCode) === text(form.value.OutletCode)).sort((a, b) => Date.parse(text(a.Date) || '') - Date.parse(text(b.Date) || '')))
  const plannedVisitDiagnostics = computed(() => {
    const outletCode = text(form.value.OutletCode)
    const totalLoaded = visits.items.value.length
    const outletVisits = visits.items.value.filter((row) => text(row.OutletCode) === outletCode)
    const activeOutletVisits = outletVisits.filter(active)
    const activePlannedForOutlet = activeOutletVisits.filter((row) => visitProgress(row) === 'PLANNED')
    const progressCounts = outletVisits.reduce((counts, row) => {
      const progress = visitProgress(row) || 'BLANK'
      counts[progress] = (counts[progress] || 0) + 1
      return counts
    }, {})
    return {
      totalLoaded,
      selectedOutletCode: outletCode,
      matchingOutletCount: outletVisits.length,
      activeMatchingOutletCount: activeOutletVisits.length,
      activePlannedCount: activePlannedForOutlet.length,
      progressCounts
    }
  })
  const visitOptions = computed(() => plannedVisits.value.map((row) => ({ label: `${row.Code} - ${formatDate(row.Date)}`, value: row.Code })))
  const skuOptions = computed(() => skus.items.value.filter(active).map((sku) => {
    const pName = sku.ProductCode ? productName(sku.ProductCode) : sku.Code
    const variantStr = [sku.Variant1, sku.Variant2, sku.Variant3, sku.Variant4, sku.Variant5].map(text).filter(Boolean).join(' / ')
    return {
      value: sku.Code,
      label: variantStr ? `${pName} (${variantStr})` : pName,
      productName: pName,
      variant: variantStr || sku.Code
    }
  }))
  const selectedVisit = computed(() => visits.items.value.find((row) => row.Code === form.value.OutletVisitCode) || null)
  const soldRows = computed(() => stockRows.value.filter((row) => toNumber(row.SoldQty) > 0))
  const varianceRows = computed(() => stockRows.value.filter((row) => toNumber(row.CurrentQty) > toNumber(row.SystemQty)))
  const pendingInvoiceItems = computed(() => items.value.filter(row => text(row.Progress) === 'PENDING_INVOICE_GENERATION'))
  const invoiceGeneratedItems = computed(() => items.value.filter(row => text(row.Progress) === 'INVOICE_GENERATED'))
  const historyItems = computed(() => items.value.filter(row => text(row.Progress) === 'CANCELLED'))

  const pendingPaymentInvoices = computed(() => invoiceItems.value.filter(row => text(row.Progress) === 'PENDING_PAYMENT'))
  const partiallyPaidInvoices = computed(() => invoiceItems.value.filter(row => text(row.Progress) === 'PARTIALLY_PAID'))
  const paidInvoices = computed(() => invoiceItems.value.filter(row => text(row.Progress) === 'PAID'))
  const cancelledInvoices = computed(() => invoiceItems.value.filter(row => text(row.Progress) === 'CANCELLED'))

  function productDisplayName(skuCode) {
    const sku = skus.items.value.find((row) => row.Code === skuCode) || {}
    const pName = sku.ProductCode ? productName(sku.ProductCode) : skuCode
    return `${pName}${skuLabelSuffix(sku)}`
  }

  function childRestocks(consumptionCode) { return restocks.items.value.filter((row) => text(row.OutletConsumptionCode) === text(consumptionCode) && active(row)) }
  function cancelableRestocks(consumptionCode) { return childRestocks(consumptionCode).filter((row) => !['APPROVED', 'DELIVERED', 'PARTIALLY_DELIVERED', 'REJECTED'].includes(text(row.Progress))) }

  function groupKey(progress, order) { return order.includes(text(progress)) ? text(progress) : 'OTHER' }
  function matchesSearch(row) { return !searchTerm.value || JSON.stringify(row).toLowerCase().includes(searchTerm.value.toLowerCase()) || outletName(row.OutletCode).toLowerCase().includes(searchTerm.value.toLowerCase()) }
  function isGroupExpanded(key) { return activeGroupKey.value === key }
  function toggleGroup(key, opened = true) { activeGroupKey.value = opened ? key : '' }
  function isInvoiceGroupExpanded(key) { return activeInvoiceGroupKey.value === key }
  function toggleInvoiceGroup(key, opened = true) { activeInvoiceGroupKey.value = opened ? key : '' }

  function syncDefaultGroups() {
    if (!activeGroupKey.value) activeGroupKey.value = groups.value.some((group) => group.key === 'PENDING_INVOICE_GENERATION') ? 'PENDING_INVOICE_GENERATION' : (groups.value[0]?.key || '')
    if (!activeInvoiceGroupKey.value) activeInvoiceGroupKey.value = invoiceGroups.value.some((group) => group.key === 'PENDING_PAYMENT') ? 'PENDING_PAYMENT' : (invoiceGroups.value[0]?.key || '')
  }

  function rebuildStockRows() {
    stockRows.value = storages.items.value.filter(active).filter((row) => text(row.OutletCode) === text(form.value.OutletCode)).map((row) => {
      const sku = skus.items.value.find((entry) => entry.Code === row.SKU) || {}
      const systemQty = toNumber(row.Quantity)
      return { SKU: row.SKU, ProductCode: sku.ProductCode || '', ProductName: productName(sku.ProductCode), SkuLabel: `${row.SKU}${skuLabelSuffix(sku)}`, SystemQty: systemQty, CurrentQty: systemQty, SoldQty: 0 }
    })
    restockRows.value = []
    syncChecklist()
  }

  function syncChecklist() {
    checklist.value.completeVisit = !!form.value.OutletVisitCode && checklist.value.completeVisit !== false
    checklist.value.placeRestock = restockRows.value.some((row) => toNumber(row.Quantity) > 0)
    checklist.value.submitRestock = checklist.value.placeRestock && checklist.value.submitRestock !== false
  }

  function recomputeSold(row) { row.SoldQty = Math.max(toNumber(row.SystemQty) - toNumber(row.CurrentQty), 0) }
  function syncRestockFromSold() { restockRows.value = soldRows.value.map((sold) => ({ SKU: sold.SKU, ProductName: sold.ProductName, SkuLabel: sold.SkuLabel, Quantity: toNumber(sold.SoldQty) })) }
  function updateCurrentQty(index, qty) { const row = stockRows.value[index]; if (!row) return; row.CurrentQty = Math.max(0, toNumber(qty)); recomputeSold(row); syncRestockFromSold(); syncChecklist() }
  function incrementCurrent(index, delta = 1) { updateCurrentQty(index, toNumber(stockRows.value[index]?.CurrentQty) + toNumber(delta)) }
  function decrementCurrent(index, delta = 1) { updateCurrentQty(index, toNumber(stockRows.value[index]?.CurrentQty) - toNumber(delta)) }
  function setCurrentToZero(index) { updateCurrentQty(index, 0) }
  function setCurrentToSystem(index) { updateCurrentQty(index, toNumber(stockRows.value[index]?.SystemQty)) }
  function updateRestockRow(index, patch = {}) { restockRows.value[index] = { ...restockRows.value[index], ...patch, ...(patch.SKU ? { SkuLabel: skuName(patch.SKU) } : {}) }; syncChecklist() }
  function addRestockRow() { restockRows.value.push({ SKU: '', Quantity: 0 }); syncChecklist() }
  function removeRestockRow(index) { restockRows.value.splice(index, 1); syncChecklist() }

  function autoSelectVisit() {
    const today = new Date(todayISO())
    const upcoming = plannedVisits.value.filter((row) => Date.parse(text(row.Date) || '') >= today.getTime())
    form.value.OutletVisitCode = upcoming[0]?.Code || ''
    checklist.value.completeVisit = !!form.value.OutletVisitCode
    syncChecklist()
  }

  function selectVisit(code) { form.value.OutletVisitCode = text(code); checklist.value.completeVisit = !!form.value.OutletVisitCode; syncChecklist() }
  function onOutletChange(outletCode) { form.value.OutletCode = outletCode; autoSelectVisit(); rebuildStockRows() }
  function childItems(code) { return consumptionItems.items.value.filter((row) => row.OutletConsumptionCode === code).filter(active) }
  function childInvoiceItems(code) { return consumptionInvoiceItems.items.value.filter((row) => row.OutletConsumptionInvoiceCode === code).filter(active) }
  function childInvoice(code) { return invoices.items.value.find((row) => row.OutletConsumptionCode === code && active(row)) || null }
  function getConsumption(code) { return consumptions.items.value.find((row) => row.Code === code) || null }
  function getInvoice(code) { return invoices.items.value.find((row) => row.Code === code) || null }
  function consumedTotal(code) { return childItems(code).reduce((sum, row) => sum + toNumber(row.Qty), 0) }
  function consumptionItemRows(code) { return childItems(code).map((row) => ({ ...row, displayName: skuName(row.SKU), productName: productName(skus.items.value.find((sku) => sku.Code === row.SKU)?.ProductCode) })) }
  function invoiceLineItems(invoiceCode) {
    return childInvoiceItems(invoiceCode).map((row) => ({
      ...row,
      SKU: text(row.SKU),
      Qty: toNumber(row.Qty),
      Price: toNumber(row.Price),
      LineTotal: toNumber(row.Qty) * toNumber(row.Price)
    }))
  }
  function getProgressMeta(progress) { return progressMeta(progress) }
  function formatDisplayDate(value) { return formatDate(value) || '-' }

  async function reload(forceSync = false) {
    loading.value = true
    try {
      await resourceIoStore.fetchResources(['OutletConsumptions', 'OutletConsumptionInvoices', 'OutletConsumptionInvoiceItems', 'OutletRestocks', 'Outlets', 'SKUs', 'Products', 'OutletStorages', 'OutletOperatingRules', 'PriceList', 'PriceListItems', 'OutletVisits', 'OutletReturns', 'Warehouses'], { forceSync })
      if (!form.value.OutletCode && outletOptions.value[0]) form.value.OutletCode = outletOptions.value[0].value
      syncDefaultGroups()
    } finally { loading.value = false }
  }

  function validateBeforeSubmit() {
    const validation = validateConsumption(form.value, stockRows.value, storages.items.value)
    if (!validation.valid) return validation.errors[0]
    return ''
  }

  function prepareInvoiceReturns(outletCode, newlyCreatedReturns = []) {
    if (!checklist.value.applyReturnsToInvoice) {
      return { appliedCodes: [], returnDeductionTotal: 0, updateRequests: [] }
    }

    // Pre-existing unadjusted returns
    const appliedReturns = returns.items.value.filter(ret =>
      active(ret) &&
      text(ret.OutletCode) === outletCode &&
      text(ret.InvoiceAdjustmentRequired) === 'TRUE' &&
      text(ret.InvoiceAdjustmentDone) !== 'TRUE'
    )

    const appliedCodes = [
      ...appliedReturns.map(r => r.Code),
      ...newlyCreatedReturns.map(r => r.Code)
    ]

    let returnDeductionTotal = 0
    const updateRequests = []

    const pricingListCode = resolvePriceListCode(outletCode, rules.items.value, priceLists.items.value)
    const priceList = priceLists.items.value.find(pl => active(pl) && text(pl.Code) === pricingListCode)
    const priceListLookup = resolvePriceListLookup(authStore.appConfigMap)

    // Gather pre-existing
    appliedReturns.forEach(ret => {
      const sku = text(ret.SKU)
      const qty = toNumber(ret.Qty)
      const price = resolveSkuPrice(sku, priceList, priceListLookup, priceListItems.items.value)
      if (price !== null && price > 0) {
        returnDeductionTotal += qty * price
      }

      const isTrue = (val) => val === true || String(val).toUpperCase() === 'TRUE'
      const isWhCompleted = isTrue(ret.WarehouseActionCompleted) || !isTrue(ret.WarehouseActionRequired)
      const nextProgress = isWhCompleted ? 'COMPLETED' : 'AWAITING_WAREHOUSE_RECEIPT'

      updateRequests.push({
        action: 'update',
        resource: 'OutletReturns',
        payload: {
          code: ret.Code,
          record: {
            InvoiceAdjustmentDone: 'TRUE',
            Progress: nextProgress
          }
        }
      })
    })

    // Gather newly created
    newlyCreatedReturns.forEach(ret => {
      const sku = text(ret.SKU)
      const qty = toNumber(ret.Qty)
      const price = resolveSkuPrice(sku, priceList, priceListLookup, priceListItems.items.value)
      if (price !== null && price > 0) {
        returnDeductionTotal += qty * price
      }

      const isTrue = (val) => val === true || String(val).toUpperCase() === 'TRUE'
      const isWhCompleted = isTrue(ret.WarehouseActionCompleted) || !isTrue(ret.WarehouseActionRequired)
      const nextProgress = isWhCompleted ? 'COMPLETED' : 'AWAITING_WAREHOUSE_RECEIPT'

      updateRequests.push({
        action: 'update',
        resource: 'OutletReturns',
        payload: {
          code: ret.Code,
          record: {
            InvoiceAdjustmentDone: 'TRUE',
            Progress: nextProgress
          }
        }
      })
    })

    return { appliedCodes, returnDeductionTotal, updateRequests }
  }

  async function saveConsumption() {
    const error = validateBeforeSubmit()
    if (error) return $q.notify({ type: 'warning', message: error, position: 'top' })
    saving.value = true
    let consumptionCode = ''
    try {
      // 1. Save returns first if present
      let savedReturnsList = []
      if (returnRows.value.length > 0) {
        const createReturnRequests = []
        returnRows.value.forEach((row, rIndex) => {
          const meta = returnMetadata.value[row.SKU] || {}
          const returnQty = toNumber(row.Qty)
          
          const preparedRecord = {
            OutletCode: text(form.value.OutletCode),
            Date: text(form.value.Date) || todayISO(),
            Username: text(form.value.Username),
            SKU: text(row.SKU),
            Qty: returnQty,
            Reason: text(meta.Reason || 'DAMAGE'),
            ReasonComment: text(meta.ReasonComment || ''),
            InvoiceAdjustmentRequired: meta.InvoiceAdjustmentRequired ? 'TRUE' : 'FALSE',
            InvoiceAdjustmentDone: 'FALSE',
            WarehouseActionRequired: meta.WarehouseActionRequired ? 'TRUE' : 'FALSE',
            WarehouseActionCompleted: 'FALSE',
            WarehouseCode: meta.WarehouseActionRequired ? text(meta.WarehouseCode) : '',
            Progress: 'SUBMITTED',
            Status: 'Active'
          }

          createReturnRequests.push({
            action: 'create',
            resource: 'OutletReturns',
            payload: {
              record: preparedRecord
            }
          })

          let qtyChange = 0
          if (meta.InvoiceAdjustmentRequired && !meta.WarehouseActionRequired) {
            qtyChange = returnQty
          } else if (!meta.InvoiceAdjustmentRequired && meta.WarehouseActionRequired) {
            qtyChange = -returnQty
          }

          if (qtyChange !== 0) {
            createReturnRequests.push({
              action: 'create',
              resource: 'OutletMovements',
              payload: {
                record: {
                  OutletCode: text(form.value.OutletCode),
                  StorageName: '_default',
                  SKU: text(row.SKU),
                  QtyChange: qtyChange,
                  ReferenceType: 'OutletReturn',
                  ReferenceCode: batchRef(`OutletReturns.records.${rIndex}.Code`),
                  MovementDate: text(form.value.Date) || todayISO(),
                  Status: 'Active'
                }
              }
            })
          }
        })

        const returnsResponse = await resourceIoStore.runBatchRequests(createReturnRequests)
        if (responseFailed(returnsResponse)) {
          $q.notify({ type: 'negative', message: failureMessage(returnsResponse, 'Failed to save outlet returns.'), position: 'top' })
          return
        }

        if (returnsResponse?.data?.results) {
          returnsResponse.data.results.forEach(res => {
            if (res?.resource === 'OutletReturns' && res?.code) {
              const matchingRow = returnRows.value.find(row => {
                const matchIndex = createReturnRequests.findIndex(req => req.resource === 'OutletReturns' && req.payload.record.SKU === row.SKU)
                return matchIndex !== -1
              })
              savedReturnsList.push({
                Code: res.code,
                SKU: matchingRow ? matchingRow.SKU : '',
                Qty: matchingRow ? matchingRow.Qty : 0,
                WarehouseActionRequired: matchingRow ? returnMetadata.value[matchingRow.SKU]?.WarehouseActionRequired : false,
                WarehouseActionCompleted: false
              })
            }
          })
        }
      }

      // 2. Pricing and Invoice returns pre-computation
      let pricing = null
      let returnsInfo = { appliedCodes: [], returnDeductionTotal: 0, updateRequests: [] }
      
      if (checklist.value.generateInvoice) {
        const sold = stockRows.value.filter((row) => toNumber(row.SoldQty) > 0).map((row) => ({ SKU: text(row.SKU), Qty: toNumber(row.SoldQty) }))
        pricing = resolveInvoicePricing({
          outletCode: form.value.OutletCode,
          rules: rules.items.value,
          priceLists: priceLists.items.value,
          priceListItems: priceListItems.items.value,
          appConfigMap: authStore.appConfigMap,
          consumptionItemRows: sold
        })
        if (pricing.error) return $q.notify({ type: 'warning', message: `Cannot generate invoice: ${pricing.error}`, position: 'top' })

        returnsInfo = prepareInvoiceReturns(form.value.OutletCode, savedReturnsList)
      }

      // 3. Build requests
      const consumptionRef = batchRef('OutletConsumptions.latest.code')
      const restockRef = batchRef('OutletRestocks.latest.code')
      const requests = [compositeSaveRequest(buildConsumptionCompositePayload(form.value, stockRows.value, checklist.value))]
      requests.push(buildConsumptionMovementRequest(consumptionRef, form.value.OutletCode, stockRows.value, form.value))
      
      if (checklist.value.generateInvoice && pricing) {
        const invoiceRef = batchRef('OutletConsumptionInvoices.latest.code')
        requests.push(
          buildConsumptionInvoiceRequest(consumptionRef, form.value, { 
            priceListCode: pricing.priceListCode, 
            subtotal: pricing.subtotal,
            returnDeductionTotal: returnsInfo.returnDeductionTotal,
            outletReturnCodes: returnsInfo.appliedCodes.join(', ')
          }),
          buildConsumptionInvoiceItemsRequest(invoiceRef, pricing.items),
          buildInvoiceGeneratedRequest(consumptionRef, 'Invoice generated during consumption submit.')
        )

        if (returnsInfo.updateRequests.length > 0) {
          requests.push(...returnsInfo.updateRequests)
        }
      }
      if (checklist.value.completeVisit && selectedVisit.value && visitProgress(selectedVisit.value) === 'PLANNED') requests.push(buildVisitCompleteRequest(form.value))
      if (checklist.value.scheduleNextVisit) {
        const rule = rules.items.value.find((row) => active(row) && text(row.OutletCode) === text(form.value.OutletCode))
        requests.push(buildNextVisitRequest(form.value, toNumber(rule?.VisitFrequencyDays) || 14, consumptionRef))
      }
      if (checklist.value.placeRestock) {
        requests.push(buildRestockCompositeRequest(form.value, restockRows.value, consumptionRef))
        if (checklist.value.submitRestock) requests.push(buildRestockSubmitRequest(restockRef))
      }

      const phase1 = await resourceIoStore.runBatchRequests(requests)
      if (responseFailed(phase1)) return $q.notify({ type: 'negative', message: failureMessage(phase1, 'Failed to save outlet consumption.'), position: 'top' })
      consumptionCode = batchResultCode(phase1, 0)
      if (!consumptionCode) return $q.notify({ type: 'negative', message: 'Consumption saved but code not returned.', position: 'top' })

      $q.notify({ type: 'positive', message: `Consumption ${consumptionCode} saved.`, position: 'top' })
      nav.goTo('view', { code: consumptionCode })
    } finally { saving.value = false }
  }

  async function generateInvoiceForConsumption(record = {}) {
    if (!record?.Code) return false
    if (text(record.Progress) !== 'PENDING_INVOICE_GENERATION') return $q.notify({ type: 'warning', message: 'Only pending invoice consumptions can generate an invoice.', position: 'top' })
    if (childInvoice(record.Code)) return $q.notify({ type: 'warning', message: 'An active invoice already exists for this consumption.', position: 'top' })

    const consumptionItems = childItems(record.Code).map((row) => ({ SKU: text(row.SKU), Qty: toNumber(row.Qty) }))
    if (!consumptionItems.length) return $q.notify({ type: 'warning', message: 'No active consumption items found for this consumption.', position: 'top' })

    const pricing = resolveInvoicePricing({
      outletCode: record.OutletCode,
      rules: rules.items.value,
      priceLists: priceLists.items.value,
      priceListItems: priceListItems.items.value,
      appConfigMap: authStore.appConfigMap,
      consumptionItemRows: consumptionItems
    })
    if (pricing.error) return $q.notify({ type: 'warning', message: `Cannot generate invoice: ${pricing.error}`, position: 'top' })

    acting.value = true
    try {
      const returnsInfo = prepareInvoiceReturns(record.OutletCode, [])
      const comment = 'Invoice generated from pending outlet consumption.'
      const invoiceRef = batchRef('OutletConsumptionInvoices.latest.code')
      
      const batchRequests = [
        buildConsumptionInvoiceRequest(record.Code, { ...record, InvoiceComment: comment }, { 
          priceListCode: pricing.priceListCode, 
          subtotal: pricing.subtotal,
          returnDeductionTotal: returnsInfo.returnDeductionTotal,
          outletReturnCodes: returnsInfo.appliedCodes.join(', ')
        }),
        buildConsumptionInvoiceItemsRequest(invoiceRef, pricing.items),
        buildInvoiceGeneratedRequest(record.Code, comment)
      ]

      if (returnsInfo.updateRequests.length > 0) {
        batchRequests.push(...returnsInfo.updateRequests)
      }

      const result = await resourceIoStore.runBatchRequests(batchRequests)
      if (responseFailed(result)) {
        $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to generate invoice.'), position: 'top' })
        return false
      }
      await reload(true)
      $q.notify({ type: 'positive', message: 'Invoice generated.', position: 'top' })
      return true
    } finally { acting.value = false }
  }

  async function cancelConsumption(record = {}, reason = '') {
    if (!record?.Code) return false
    if (text(record.Progress) === 'CANCELLED') return $q.notify({ type: 'warning', message: 'This consumption is already cancelled.', position: 'top' })
    if (!reason) { $q.notify({ type: 'warning', message: 'Cancellation reason is required.', position: 'top' }); return false }

    const now = new Date()
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    const user = authStore.user || {}
    const userName = text(user.Name || user.name || user.UserName || user.Username || user.email || user.Email || user.UserID || user.Code || 'Unknown')
    const comment = `Dependent Outlet consumption ${record.Code} cancelled by ${userName} at ${timeStr}`

    const requests = [
      executeActionRequest('OutletConsumptions', record.Code, OUTLET_ACTIONS.cancelConsumption, { ProgressCancelledComment: reason })
    ]

    const invoice = childInvoice(record.Code)
    if (invoice && text(invoice.Progress) !== 'CANCELLED' && text(invoice.Progress) !== 'PAID') {
      requests.push(executeActionRequest('OutletConsumptionInvoices', invoice.Code, { action: 'Cancel', column: 'Progress', columnValue: 'CANCELLED' }, { ProgressCancelledComment: comment }))
    }

    const restocks = cancelableRestocks(record.Code)
    for (const restock of restocks) {
      requests.push(executeActionRequest('OutletRestocks', restock.Code, OUTLET_ACTIONS.rejectRestock, { ProgressRejectedComment: comment }))
    }

    acting.value = true
    try {
      const result = await resourceIoStore.runBatchRequests(requests)
      if (responseFailed(result)) {
        $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to cancel consumption.'), position: 'top' })
        return false
      }
      await reload(true)
      $q.notify({ type: 'positive', message: `Consumption ${record.Code} cancelled.`, position: 'top' })
      return true
    } finally { acting.value = false }
  }

  function navigateTo(code) { nav.goTo('view', { code }) }
  function navigateToAdd(outletCode = '', step = 1) {
    const params = {}
    if (outletCode) params.query = { outletCode }
    if (step > 1) params.query = { ...(params.query || {}), step: String(step) }
    nav.goTo('add', Object.keys(params).length ? params : undefined)
  }
  function navigateToInvoice(code) { nav.goTo('view', { scope: 'operations', resourceSlug: 'outlet-consumption-invoices', code }) }
  function navigateToInvoiceAdd(consumptionCode) { nav.goTo('add', { scope: 'operations', resourceSlug: 'outlet-consumption-invoices', query: { consumptionCode } }) }
  function navigateToRestock(code) { nav.goTo('view', { scope: 'operations', resourceSlug: 'outlet-restocks', code }) }
  function navigateToConsumption(code) { nav.goTo('view', { scope: 'operations', resourceSlug: 'outlet-consumptions', code }) }
  
  async function saveInvoiceFromConsumption({ consumptionCode, consumptionRecord, items = [], discount = 0, tax = 0, priceListCode = '' }) {
    if (!consumptionCode) return { error: 'Consumption code required' }
    if (!items.length) return { error: 'No items to invoice' }
    const subtotal = items.reduce((sum, item) => sum + (toNumber(item.Qty) * toNumber(item.Price)), 0)
    saving.value = true
    try {
      const returnsInfo = prepareInvoiceReturns(consumptionRecord.OutletCode, [])
      const invoiceRef = batchRef('OutletConsumptionInvoices.latest.code')
      const comment = 'Invoice generated from outlet consumption.'
      
      const requests = [
        buildConsumptionInvoiceRequest(consumptionCode, { ...consumptionRecord, InvoiceComment: comment }, { 
          priceListCode, 
          subtotal, 
          discount, 
          tax,
          returnDeductionTotal: returnsInfo.returnDeductionTotal,
          outletReturnCodes: returnsInfo.appliedCodes.join(', ')
        }),
        buildConsumptionInvoiceItemsRequest(invoiceRef, items.map(item => ({ SKU: item.SKU, Qty: item.Qty, Price: item.Price }))),
        buildInvoiceGeneratedRequest(consumptionCode, comment)
      ]

      if (returnsInfo.updateRequests.length > 0) {
        requests.push(...returnsInfo.updateRequests)
      }

      const result = await resourceIoStore.runBatchRequests(requests)
      if (responseFailed(result)) return { error: failureMessage(result, 'Failed to save invoice.') }
      const invoiceCode = batchResultCode(result, 0)
      await reload(true)
      return { success: true, invoiceCode }
    } finally { saving.value = false }
  }

  async function updateInvoice(invoiceCode, { PriceListCode, Discount, Tax, items = [] } = {}) {
    if (!invoiceCode) return { error: 'Invoice code required' }
    saving.value = true
    try {
      const requests = []
      const updateData = {}
      if (PriceListCode !== undefined) updateData.PriceListCode = PriceListCode
      if (Discount !== undefined) updateData.Discount = toNumber(Discount)
      if (Tax !== undefined) updateData.Tax = toNumber(Tax)
      if (Object.keys(updateData).length) requests.push(resourceUpdateRequest('OutletConsumptionInvoices', invoiceCode, updateData))
      for (const item of items) {
        if (item.Code && item.Price !== undefined) requests.push(resourceUpdateRequest('OutletConsumptionInvoiceItems', item.Code, { Price: toNumber(item.Price) }))
      }
      if (!requests.length) return { success: true }
      const result = await resourceIoStore.runBatchRequests(requests)
      if (responseFailed(result)) return { error: failureMessage(result, 'Failed to update invoice.') }
      await reload(true)
      return { success: true }
    } finally { saving.value = false }
  }

  function resolveDefaultPriceList(outletCode) {
    return resolvePriceListCode(outletCode, rules.items.value, priceLists.items.value)
  }

  function resolvePriceListItems(priceListCode, consumptionItemRows = []) {
    return resolvePricesForPriceList({
      priceListCode,
      priceLists: priceLists.items.value,
      priceListItems: priceListItems.items.value,
      appConfigMap: authStore.appConfigMap || {},
      consumptionItemRows
    })
  }

  function cancel() { nav.goTo('list') }

  return {
    loading, saving, acting, searchTerm, activeGroupKey, activeInvoiceGroupKey, form, checklist, stockRows, restockRows, groups, invoiceGroups, items, invoiceItems, outletOptions, visitOptions, allPlannedVisits, plannedVisits, plannedVisitDiagnostics, skuOptions, selectedVisit, soldRows, varianceRows, pendingInvoiceItems, pendingPaymentInvoices, partiallyPaidInvoices, paidInvoices, cancelledInvoices, invoiceGeneratedItems, historyItems, canCreate, consumptionPermissions, invoicePermissions, restockPermissions, canReadInvoice, canReadRestock, reload, onOutletChange, selectVisit, updateCurrentQty, incrementCurrent, decrementCurrent, setCurrentToZero, setCurrentToSystem, updateRestockRow, addRestockRow, removeRestockRow, saveConsumption, generateInvoiceForConsumption, cancelConsumption, getConsumption, getInvoice, childItems, childInvoiceItems, childInvoice, childRestocks, cancelableRestocks, consumptionItemRows, invoiceLineItems, consumedTotal, getProgressMeta, isGroupExpanded, toggleGroup, isInvoiceGroupExpanded, toggleInvoiceGroup, outletName, skuName, productDisplayName, visitLabel, formatDisplayDate, navigateTo, navigateToAdd, navigateToInvoice, navigateToInvoiceAdd, navigateToRestock, navigateToConsumption, saveInvoiceFromConsumption, updateInvoice, resolveDefaultPriceList, resolvePriceListItems, cancel, text, todayISO, active, priceLists, rules,
    returnRows, returnMetadata, warehouseOptions, canCreateReturn, addManualReturnSku, updateReturnMetadata, removeManualReturnRow, getInvoiceTotal, getInvoiceRemaining, returns
  }
}
