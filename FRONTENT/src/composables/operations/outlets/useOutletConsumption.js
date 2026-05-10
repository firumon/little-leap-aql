import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from '../../../stores/auth.js'
import { useResourceData } from '../../resources/useResourceData.js'
import { useResourceNav } from '../../resources/useResourceNav.js'
import { useWorkflowStore } from '../../../stores/workflow.js'
import { OUTLET_OPERATION_RESOURCES, CONSUMPTION_PROGRESS_ORDER, active, formatDate, progressMeta, sortTime, text, todayISO, visitProgress } from './outletOperationsMeta.js'
import { toNumber, validateConsumption } from './outletStockLogic.js'
import { batchRef, batchResultCode, compositeSaveRequest, failureMessage, responseFailed } from './outletOperationsBatch.js'
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
import { resolveInvoicePricing } from './outletConsumptionPricing.js'

const INVOICE_PROGRESS_ORDER = ['PENDING_PAYMENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'OTHER']

export function useOutletConsumption() {
  const $q = useQuasar()
  const workflowStore = useWorkflowStore()
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

  const consumptionConfig = computed(() =>
    (Array.isArray(authStore.resources) ? authStore.resources : [])
      .find(r => r.name === 'OutletConsumptions') || null
  )
  const consumptionPermissions = computed(() => consumptionConfig.value?.permissions || {})
  const canCreate = computed(() => !!consumptionPermissions.value.canWrite)

  const loading = ref(false)
  const saving = ref(false)
  const acting = ref(false)
  const searchTerm = ref('')
  const activeGroupKey = ref('')
  const activeInvoiceGroupKey = ref('')
  const form = ref({ Date: todayISO(), Username: currentUserName(), Progress: 'PENDING_INVOICE_GENERATION', Status: 'Active', OutletVisitCode: '' })
  const stockRows = ref([])
  const restockRows = ref([])
  const checklist = ref({ completeVisit: false, scheduleNextVisit: true, generateInvoice: true, placeRestock: false, submitRestock: false })

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
  const outletOptions = computed(() => outlets.items.value.filter(active).map((row) => ({ label: `${row.Code} - ${row.Name}`, value: row.Code })))
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
  const skuOptions = computed(() => skus.items.value.filter(active).map((sku) => ({ value: sku.Code, label: skuName(sku.Code) })))
  const selectedVisit = computed(() => visits.items.value.find((row) => row.Code === form.value.OutletVisitCode) || null)
  const soldRows = computed(() => stockRows.value.filter((row) => toNumber(row.SoldQty) > 0))
  const varianceRows = computed(() => stockRows.value.filter((row) => toNumber(row.CurrentQty) > toNumber(row.SystemQty)))
  const pendingInvoiceItems = computed(() => items.value.filter(row => text(row.Progress) === 'PENDING_INVOICE_GENERATION'))
  const invoiceGeneratedItems = computed(() => items.value.filter(row => text(row.Progress) === 'INVOICE_GENERATED'))
  const historyItems = computed(() => items.value.filter(row => text(row.Progress) === 'CANCELLED'))

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
      await workflowStore.fetchResources(['OutletConsumptions', 'OutletConsumptionInvoices', 'Outlets'], { includeInactive: true, forceSync })
      if (!form.value.OutletCode && outletOptions.value[0]) form.value.OutletCode = outletOptions.value[0].value
      syncDefaultGroups()
    } finally { loading.value = false }
  }

  function validateBeforeSubmit() {
    const validation = validateConsumption(form.value, stockRows.value, storages.items.value)
    if (!validation.valid) return validation.errors[0]
    if (varianceRows.value.length) return 'Some counted stock is greater than system stock. Please correct before submit.'
    return ''
  }

  async function saveConsumption() {
    const error = validateBeforeSubmit()
    if (error) return $q.notify({ type: 'warning', message: error, position: 'top' })
    saving.value = true
    let consumptionCode = ''
    try {
      let pricing = null
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
      }

      const consumptionRef = batchRef('OutletConsumptions.latest.code')
      const restockRef = batchRef('OutletRestocks.latest.code')
      const requests = [compositeSaveRequest(buildConsumptionCompositePayload(form.value, stockRows.value, checklist.value))]
      requests.push(buildConsumptionMovementRequest(consumptionRef, form.value.OutletCode, stockRows.value, form.value))
      if (checklist.value.generateInvoice && pricing) {
        const invoiceRef = batchRef('OutletConsumptionInvoices.latest.code')
        requests.push(
          buildConsumptionInvoiceRequest(consumptionRef, form.value, { priceListCode: pricing.priceListCode, subtotal: pricing.subtotal }),
          buildConsumptionInvoiceItemsRequest(invoiceRef, pricing.items),
          buildInvoiceGeneratedRequest(consumptionRef, 'Invoice generated during consumption submit.')
        )
      }
      if (checklist.value.completeVisit && selectedVisit.value && visitProgress(selectedVisit.value) === 'PLANNED') requests.push(buildVisitCompleteRequest(form.value))
      if (checklist.value.scheduleNextVisit) {
        const rule = rules.items.value.find((row) => active(row) && text(row.OutletCode) === text(form.value.OutletCode))
        requests.push(buildNextVisitRequest(form.value, toNumber(rule?.VisitFrequencyDays) || 14, consumptionRef))
      }
      if (checklist.value.placeRestock) {
        requests.push(buildRestockCompositeRequest(form.value, restockRows.value))
        if (checklist.value.submitRestock) requests.push(buildRestockSubmitRequest(restockRef))
      }

      const phase1 = await workflowStore.runBatchRequests(requests)
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
      const comment = 'Invoice generated from pending outlet consumption.'
      const invoiceRef = batchRef('OutletConsumptionInvoices.latest.code')
      const result = await workflowStore.runBatchRequests([
        buildConsumptionInvoiceRequest(record.Code, { ...record, InvoiceComment: comment }, { priceListCode: pricing.priceListCode, subtotal: pricing.subtotal }),
        buildConsumptionInvoiceItemsRequest(invoiceRef, pricing.items),
        buildInvoiceGeneratedRequest(record.Code, comment)
      ])
      if (responseFailed(result)) {
        $q.notify({ type: 'negative', message: failureMessage(result, 'Failed to generate invoice.'), position: 'top' })
        return false
      }
      await reload(true)
      $q.notify({ type: 'positive', message: 'Invoice generated.', position: 'top' })
      return true
    } finally { acting.value = false }
  }

  function navigateTo(code) { nav.goTo('view', { code }) }
  function navigateToAdd(outletCode = '') {
    outletCode ? nav.goTo('add', { query: { outletCode } }) : nav.goTo('add')
  }
  function navigateToInvoice(code) { nav.goTo('view', { scope: 'operations', resourceSlug: 'outlet-consumption-invoices', code }) }
  function navigateToConsumption(code) { nav.goTo('view', { scope: 'operations', resourceSlug: 'outlet-consumptions', code }) }
  function cancel() { nav.goTo('list') }

  return {
    loading, saving, acting, searchTerm, activeGroupKey, activeInvoiceGroupKey, form, checklist, stockRows, restockRows, groups, invoiceGroups, items, invoiceItems, outletOptions, visitOptions, plannedVisits, plannedVisitDiagnostics, skuOptions, selectedVisit, soldRows, varianceRows, pendingInvoiceItems, invoiceGeneratedItems, historyItems, canCreate, reload, onOutletChange, selectVisit, updateCurrentQty, incrementCurrent, decrementCurrent, setCurrentToZero, setCurrentToSystem, updateRestockRow, addRestockRow, removeRestockRow, saveConsumption, generateInvoiceForConsumption, getConsumption, getInvoice, childItems, childInvoiceItems, childInvoice, consumptionItemRows, invoiceLineItems, consumedTotal, getProgressMeta, isGroupExpanded, toggleGroup, isInvoiceGroupExpanded, toggleInvoiceGroup, outletName, skuName, visitLabel, formatDisplayDate, navigateTo, navigateToAdd, navigateToInvoice, navigateToConsumption, cancel
  }
}
