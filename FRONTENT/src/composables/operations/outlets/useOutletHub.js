import { ref, computed } from 'vue'
import { useResourceData } from '../../resources/useResourceData.js'
import { useResourceNav } from '../../resources/useResourceNav.js'
import { useResourceConfig } from '../../resources/useResourceConfig.js'
import { useResourceIoStore } from 'src/stores/resourceIo'
import { active, formatDate, sortTime, text, visitProgress } from './outletOperationsMeta.js'
import { toNumber } from './outletStockLogic.js'
import { getInvoiceRemaining } from './outletConsumptionPricing.js'
import { useProductSkuResolver } from '../../masters/products/useProductSkuResolver.js'

const RECENT_WINDOW_DAYS = 14
const RECENT_RECORD_LIMIT = 4

const PENDING_RESTOCK_PROGRESS = ['DRAFT', 'PENDING_APPROVAL', 'REVISION_REQUIRED', 'APPROVED', 'PARTIALLY_DELIVERED']
const CLOSED_RETURN_PROGRESS = ['COMPLETED', 'CANCELLED']
const UNPAID_INVOICE_PROGRESS = ['PENDING_PAYMENT', 'PARTIALLY_PAID']
const ACTIVE_PAYMENT_PROGRESS = ['SUBMITTED']

function withinRecentWindow(value) {
  const date = new Date(formatDate(value) || value || 0)
  if (Number.isNaN(date.getTime())) return false
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - RECENT_WINDOW_DAYS)
  cutoff.setHours(0, 0, 0, 0)
  return date.getTime() >= cutoff.getTime()
}

export function useOutletHub() {
  const resourceIoStore = useResourceIoStore()
  const nav = useResourceNav()
  const { allowed } = useResourceConfig()
  const { skuInfo } = useProductSkuResolver()

  const outlets = useResourceData(ref('Outlets'))
  const visits = useResourceData(ref('OutletVisits'))
  const restocks = useResourceData(ref('OutletRestocks'))
  const returns = useResourceData(ref('OutletReturns'))
  const invoices = useResourceData(ref('OutletConsumptionInvoices'))
  const payments = useResourceData(ref('OutletPayments'))
  const storages = useResourceData(ref('OutletStorages'))

  const loading = ref(false)
  const selectedOutletCode = ref('')

  const outletOptions = computed(() =>
    outlets.items.value.filter(active).map((row) => ({ label: text(row.Name || row.Code), value: row.Code }))
  )

  function matchesOutlet(row) {
    if (!selectedOutletCode.value) return false
    return text(row.OutletCode) === text(selectedOutletCode.value)
  }

  const selectedOutlet = computed(() =>
    outlets.items.value.find((row) => text(row.Code) === text(selectedOutletCode.value)) || null
  )

  const plannedVisits = computed(() =>
    visits.items.value
      .filter(active)
      .filter(matchesOutlet)
      .filter((row) => visitProgress(row) === 'PLANNED')
      .sort((a, b) => sortTime(a) - sortTime(b))
  )

  const pendingRestocks = computed(() =>
    restocks.items.value
      .filter(active)
      .filter(matchesOutlet)
      .filter((row) => PENDING_RESTOCK_PROGRESS.includes(text(row.Progress).toUpperCase()))
      .sort((a, b) => sortTime(b) - sortTime(a))
  )

  const pendingReturns = computed(() =>
    returns.items.value
      .filter(active)
      .filter(matchesOutlet)
      .filter((row) => !CLOSED_RETURN_PROGRESS.includes(text(row.Progress).toUpperCase()))
      .sort((a, b) => sortTime(b) - sortTime(a))
  )

  function withinRecentRule(value) {
    return withinRecentWindow(value)
  }

  const outletInvoices = computed(() =>
    invoices.items.value
      .filter(active)
      .filter(matchesOutlet)
      .filter((row) => text(row.Progress).toUpperCase() !== 'CANCELLED')
      .sort((a, b) => sortTime(b) - sortTime(a))
  )

  const recentInvoices = computed(() => {
    const sorted = outletInvoices.value
    const recent = sorted.filter((row) => withinRecentRule(row.Date))
    const pool = recent.length ? recent : sorted
    return pool.slice(0, RECENT_RECORD_LIMIT)
  })

  const outletPayments = computed(() =>
    payments.items.value
      .filter(active)
      .filter(matchesOutlet)
      .filter((row) => text(row.Progress).toUpperCase() !== 'CANCELLED')
      .sort((a, b) => sortTime(b) - sortTime(a))
  )

  const recentPayments = computed(() => {
    const sorted = outletPayments.value
    const recent = sorted.filter((row) => withinRecentRule(row.Date))
    const pool = recent.length ? recent : sorted
    return pool.slice(0, RECENT_RECORD_LIMIT)
  })

  const outletStock = computed(() =>
    storages.items.value
      .filter(active)
      .filter(matchesOutlet)
      .filter((row) => toNumber(row.Quantity) !== 0)
      .sort((a, b) => text(a.SKU).localeCompare(text(b.SKU)))
      .map((row) => {
        const info = skuInfo(row.SKU)
        if (!info) return { ...row, skuCode: row.SKU, productName: row.SKU, variantValues: [] }
        return { ...row, ...info }
      })
  )

  const unpaidInvoices = computed(() =>
    outletInvoices.value
      .filter((row) => UNPAID_INVOICE_PROGRESS.includes(text(row.Progress).toUpperCase()))
      .filter((row) => getInvoiceRemaining(row, payments.items.value) > 0.01)
  )

  const totalOutstanding = computed(() =>
    unpaidInvoices.value.reduce((sum, row) => sum + toNumber(getInvoiceRemaining(row, payments.items.value)), 0)
  )

  const canCreateVisit = computed(() => allowed({ outletVisit: 'create' }))
  const canCreateRestock = computed(() => allowed({ outletRestock: 'create' }))
  const canCreateReturn = computed(() => allowed({ outletReturn: 'create' }))
  const canCreateConsumption = computed(() => allowed({ outletConsumption: 'create' }))
  const canCreatePayment = computed(() => allowed({ outletPayment: 'create', outletConsumptionInvoice: 'update' }))

  function reload(forceSync = false) {
    loading.value = true
    return resourceIoStore
      .fetchResources(
        ['Outlets', 'OutletVisits', 'OutletRestocks', 'OutletReturns', 'OutletConsumptionInvoices', 'OutletPayments', 'OutletStorages', 'SKUs', 'Products', 'UOMs'],
        { forceSync }
      )
      .finally(() => {
        loading.value = false
      })
  }

  function selectOutlet(code) {
    selectedOutletCode.value = text(code)
  }

  function outletName(code) {
    const row = outlets.items.value.find((entry) => text(entry.Code) === text(code))
    return row ? text(row.Name) || text(row.Code) : text(code)
  }

  function visitSummary(visit = {}) {
    return { code: text(visit.Code), progress: visitProgress(visit), date: formatDate(visit.Date || visit.ScheduledAt) }
  }

  function restockSummary(restock = {}) {
    return { code: text(restock.Code), progress: text(restock.Progress), date: formatDate(restock.Date) }
  }

  function returnSummary(ret = {}) {
    return { code: text(ret.Code), progress: text(ret.Progress), date: formatDate(ret.Date), qty: toNumber(ret.Qty) }
  }

  function invoiceSummary(inv = {}) {
    const remaining = getInvoiceRemaining(inv, payments.items.value)
    return { code: text(inv.Code), date: formatDate(inv.Date), progress: text(inv.Progress), remaining }
  }

  function paymentSummary(pay = {}) {
    return { code: text(pay.Code), date: formatDate(pay.Date), amount: toNumber(pay.Amount), mode: text(pay.Mode), progress: text(pay.Progress) }
  }

  function buildQuery(extra = {}) {
    const query = { ...extra }
    if (selectedOutletCode.value) query.outletCode = selectedOutletCode.value
    return query
  }

  function goToPlanVisit() {
    nav.goTo('add', { resourceSlug: 'outlet-visits', scope: 'operations', query: buildQuery() })
  }

  function navigateToVisit(code) {
    nav.goTo('view', { resourceSlug: 'outlet-visits', scope: 'operations', code })
  }

  function goToNewRestock() {
    nav.goTo('add', { resourceSlug: 'outlet-restocks', scope: 'operations', query: buildQuery() })
  }

  function navigateToRestock(code) {
    nav.goTo('view', { resourceSlug: 'outlet-restocks', scope: 'operations', code })
  }

  function goToNewReturn() {
    nav.goTo('add', { resourceSlug: 'outlet-returns', scope: 'operations', query: buildQuery() })
  }

  function navigateToReturn(code) {
    nav.goTo('view', { resourceSlug: 'outlet-returns', scope: 'operations', code })
  }

  function goToStartConsumption() {
    nav.goTo('add', { resourceSlug: 'outlet-consumptions', scope: 'operations', query: buildQuery() })
  }

  function goToCollectPayment(invoiceCode = '') {
    const query = buildQuery()
    if (invoiceCode) query.invoiceCode = invoiceCode
    nav.goTo('add', { resourceSlug: 'outlet-payments', scope: 'operations', query })
  }

  function goToPaymentCollection() {
    nav.goTo('add', { resourceSlug: 'outlet-payments', scope: 'operations', query: buildQuery() })
  }

  return {
    loading,
    selectedOutletCode,
    selectedOutlet,
    outletOptions,
    plannedVisits,
    pendingRestocks,
    pendingReturns,
    recentInvoices,
    recentPayments,
    unpaidInvoices,
    totalOutstanding,
    canCreateVisit,
    canCreateRestock,
    canCreateReturn,
    canCreateConsumption,
    canCreatePayment,
    outletStock,
    outlets,
    visits,
    restocks,
    returns,
    invoices,
    payments,
    reload,
    selectOutlet,
    outletName,
    outletInvoices,
    visitSummary,
    restockSummary,
    returnSummary,
    invoiceSummary,
    paymentSummary,
    goToPlanVisit,
    navigateToVisit,
    goToNewRestock,
    navigateToRestock,
    goToNewReturn,
    navigateToReturn,
    goToStartConsumption,
    goToCollectPayment,
    goToPaymentCollection,
    RECENT_WINDOW_DAYS,
    RECENT_RECORD_LIMIT
  }
}
