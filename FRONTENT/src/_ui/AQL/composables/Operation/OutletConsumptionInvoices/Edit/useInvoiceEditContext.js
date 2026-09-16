import { inject, computed, onMounted, watch } from 'vue'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'
import { useInvoiceIndex } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex'
import {
  invoiceCurrencyOf,
  storedTaxBreakdown,
  grandTotalOf,
  invoicePolicyOf,
  PRE_TAX
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import {
  INVOICE_CONTROL,
  INVOICE_LINE_BASE_PRICE,
  creditedReturnsOfInvoice,
  buildInvoiceEditInitNodes,
  invoiceEditDerivations,
  syncInvoiceEdit
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceDraft'
import {
  canEditInvoice,
  progressMetaOf,
  isPaid,
  isCancelled
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'

export const NODE = 'OutletConsumptionInvoices'
export const ITEMS = 'OutletConsumptionInvoiceItems'

/** Relayed from the domain, never restated: the derive rules address the same names. */
export const CTRL = INVOICE_CONTROL

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

export function useInvoiceEditContext () {
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const pageState = inject('pageState', null)

  const nav = useResourceNav()
  const ui = useAQLConfig()
  const { _C } = useCurrencyResource()
  const { skuLabelOf } = useSkuResource()
  const { getPriceList, activePriceLists } = usePriceListResource()
  const { outletNameByCode } = useInvoiceIndex()

  const record = computed(() => resourceRecord?.record?.value || null)
  const code = computed(() => text(record.value?.Code))

  // The cards only mount once the wrapper has the record, so the first card here is the
  // right moment to raise the live batch. The guard keeps the other five off it.
  if (pageState && !pageState.hasNode(NODE) && record.value?.Code) {
    pageState.applyNodes(buildInvoiceEditInitNodes(record.value))
    pageState.derive(invoiceEditDerivations(record.value))
  }

  const node = pageState.useNode(NODE)
  const live = computed(() => node.exists.value)
  const form = computed(() => node.record.value || {})

  const locked = computed(() => !!record.value && !canEditInvoice(record.value))

  const dueDate = pageState.useRecord('DueDate', NODE)
  const priceListCode = pageState.useRecord('PriceListCode', NODE)
  const discountType = pageState.useControls(CTRL.DISCOUNT_TYPE, 'FLAT', NODE)
  const discountValue = pageState.useControls(CTRL.DISCOUNT_VALUE, 0, NODE)

  const priceListOptions = computed(() => (activePriceLists.value || [])
    .map((list) => ({ value: list.code, label: list.name || list.code })))

  const priceListName = computed(() => {
    const list = getPriceList(priceListCode.value)
    return text(list?.name || list?.Name) || text(priceListCode.value)
  })

  const priceListSwitched = computed(() =>
    !!text(priceListCode.value) && text(priceListCode.value) !== text(record.value?.PriceListCode))

  const outletName = computed(() => {
    const outlet = text(record.value?.OutletCode)
    return outletNameByCode.value.get(outlet) || outlet
  })

  const currencyCode = computed(() => invoiceCurrencyOf(priceListCode.value))
  const money = (value) => _C(num(value), true, currencyCode.value)

  const lines = computed(() => {
    void node.node.value
    return pageState.getChildRows(ITEMS, NODE).map((row, at) => {
      const sku = text(row.SKU)
      const label = skuLabelOf(sku)
      const price = num(row.Price)
      const basePrice = num(row[INVOICE_LINE_BASE_PRICE])
      return {
        at,
        sku,
        qty: num(row.Qty),
        price,
        basePrice,
        product: label.primary,
        variant: label.secondary === sku ? sku : `${label.secondary} · ${sku}`,
        changed: Math.abs(price - basePrice) >= 0.000001
      }
    })
  })

  const setLinePrice = (at, value) => pageState.setChildren(ITEMS, at, 'Price', num(value), NODE)

  const restoreLinePrice = (at) => {
    const row = pageState.getChildren(ITEMS, at, null, NODE)
    if (row) setLinePrice(at, row[INVOICE_LINE_BASE_PRICE])
  }

  const creditedReturns = computed(() => creditedReturnsOfInvoice(code.value).map((row) => {
    const label = skuLabelOf(row.SKU)
    return {
      code: text(row.Code),
      date: text(row.Date),
      qty: num(row.Qty),
      price: num(row.Price),
      amount: num(row.Qty) * num(row.Price),
      reason: text(row.Reason),
      primary: label.primary,
      secondary: label.secondary
    }
  }))

  return {
    pageState,
    resourceConfig,
    ui,
    money,
    skuLabelOf,
    record,
    code,
    form,
    live,
    locked,
    lines,
    setLinePrice,
    restoreLinePrice,
    creditedReturns,

    dueDate,
    priceListCode,
    discountType,
    discountValue,
    priceListOptions,
    priceListName,
    priceListSwitched,
    outletName,

    taxBreakdown: computed(() => storedTaxBreakdown(form.value)),
    netPayable: computed(() => grandTotalOf(form.value)),
    issuedTotal: computed(() => grandTotalOf(record.value || {})),
    discountPreTax: computed(() =>
      invoicePolicyOf(form.value.PriceListCode).discountTaxPolicy === PRE_TAX),

    progressMeta: computed(() => progressMetaOf(record.value)),
    isPaid: computed(() => isPaid(record.value)),
    isCancelled: computed(() => isCancelled(record.value)),

    goToView: () => nav.goTo('view', { code: code.value })
  }
}

// The route's ONE hydration point. The ledger derive retires the rows this invoice already
// has, and `taxTransactionRowsOf` reads the cache — unloaded, the save writes a second set.
export function useInvoiceEditSeed () {
  const { pageState, record } = useInvoiceEditContext()
  const ledger = usePageRecord('TaxTransactions')

  onMounted(() => { ledger.reload() })

  watch(ledger.items, () => {
    if (record.value?.Code) syncInvoiceEdit(pageState, record.value)
  })
}
