import { inject, computed } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRecord } from 'src/composables/resources/useRecord'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'
import { useInvoiceIndex } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex'
import {
  invoiceCurrencyOf,
  makeLineTaxResolver
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import {
  editableInvoiceItems,
  invoiceEditDefaults,
  makeStoredPriceResolver,
  recalculateStoredInvoice
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'
import { canEditInvoice, progressMetaOf, isPaid, isCancelled } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'

const NODE = 'InvoiceEdit'

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

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

  const items = computed(() => editableInvoiceItems(record.value || {}))
  const defaults = computed(() => invoiceEditDefaults(record.value || {}))

  // The node outlives a route change, so answers typed against another invoice are ignored.
  const ownsAnswers = () => text(pageState?.getControlField(NODE, 'EditFor')) === code.value

  const field = (header) => {
    if (!ownsAnswers()) return undefined
    return pageState?.getControlField(NODE, header)
  }

  const setField = (header, value) => {
    pageState?.setControlField(NODE, 'EditFor', code.value)
    pageState?.setControlField(NODE, header, value)
  }

  const dueDate = computed({
    get: () => text(field('DueDate')) || defaults.value.dueDate,
    set: (value) => setField('DueDate', text(value))
  })

  const discountType = computed({
    get: () => text(field('DiscountType')) || defaults.value.discountType,
    set: (value) => setField('DiscountType', text(value) || 'FLAT')
  })

  const discountValue = computed({
    get: () => {
      const typed = field('DiscountValue')
      return typed === undefined || typed === null || typed === '' ? defaults.value.discountValue : num(typed)
    },
    set: (value) => setField('DiscountValue', num(value))
  })

  const priceListCode = computed({
    get: () => text(field('PriceListCode')) || defaults.value.priceListCode,
    set: (value) => setField('PriceListCode', text(value))
  })

  const priceListOptions = computed(() => (activePriceLists.value || [])
    .map((list) => ({ value: list.code, label: list.name || list.code })))

  const priceOverrides = computed({
    get: () => {
      const value = field('PriceOverrides')
      return value && typeof value === 'object' ? value : {}
    },
    set: (value) => setField('PriceOverrides', value && typeof value === 'object' ? value : {})
  })

  const setLinePrice = (sku, value) => {
    const key = text(sku)
    if (!key) return
    priceOverrides.value = { ...priceOverrides.value, [key]: num(value) }
  }

  const resetLinePrice = (sku) => {
    const key = text(sku)
    const { [key]: dropped, ...rest } = priceOverrides.value
    priceOverrides.value = rest
  }

  const outletName = computed(() => {
    const outlet = text(record.value?.OutletCode)
    return outletNameByCode.value.get(outlet) || outlet
  })

  const priceListName = computed(() => {
    const list = getPriceList(priceListCode.value)
    return text(list?.name || list?.Name) || priceListCode.value
  })

  const priceListSwitched = computed(() =>
    !!priceListCode.value && priceListCode.value !== defaults.value.priceListCode)

  const resolvePrice = computed(() => makeStoredPriceResolver(items.value, priceOverrides.value, {
    priceListCode: priceListCode.value,
    issuedPriceListCode: defaults.value.priceListCode
  }))

  const invoice = computed(() => recalculateStoredInvoice({
    record: record.value || {},
    items: items.value,
    discountType: discountType.value,
    discountValue: discountValue.value,
    priceListCode: priceListCode.value,
    priceOverrides: priceOverrides.value,
    calculateLineTax: makeLineTaxResolver({
      priceListCode: priceListCode.value,
      resolvePrice: resolvePrice.value
    })
  }))

  const currencyCode = computed(() => invoiceCurrencyOf(priceListCode.value))
  const money = (value) => _C(num(value), true, currencyCode.value)

  const locked = computed(() => !!record.value && !canEditInvoice(record.value))

  // The submit needs the invoice's current tax-ledger rows to retire them; nothing else
  // on this route fetches them.
  const taxLedger = useRecord('TaxTransactions')
  const loadSources = () => taxLedger.reload()

  return {
    pageState,
    loadSources,
    evaluate: (value) => evaluateProp(value, resourceRecord, resourceConfig),
    ui,
    money,
    skuLabelOf,
    record,
    code,
    items,
    invoice,
    locked,
    priceListCode,
    outletName,
    priceListName,
    priceListSwitched,

    dueDate,
    discountType,
    discountValue,
    priceListOptions,
    priceOverrides,
    setLinePrice,
    resetLinePrice,

    progressMeta: computed(() => progressMetaOf(record.value)),
    isPaid: computed(() => isPaid(record.value)),
    isCancelled: computed(() => isCancelled(record.value)),

    goToView: () => nav.goTo('view', { code: code.value })
  }
}
