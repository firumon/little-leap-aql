import { inject, computed } from 'vue'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { useInvoiceIndex } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex'
import { INVOICE_CONTROL } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceDraft'

// OutletConsumptionInvoices > Add - the one inject() behind the wizard, plus stateless UI helpers.
export const NODE = 'OutletConsumptionInvoices'
export const ITEMS = 'OutletConsumptionInvoiceItems'

export const CTRL = INVOICE_CONTROL

export { removeManualPart } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceDraft'

export const WIZARD_RESOURCES = [
  'Outlets', 'OutletOperatingRules', 'SKUs', 'Products', 'PriceList',
  'OutletConsumptions', 'OutletConsumptionItems', 'OutletReturns',
  'Taxes'
]

export const stepVisible = (pageState, step) =>
  step == null || Number(step) === (pageState?.meta.currentStep || 1)

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0)

export function useInvoiceAddContext () {
  const pageState = inject('pageState', null)
  const resourceConfig = inject('resourceConfig', null)

  const ui = useAQLConfig()
  const { query } = useRouteConfig()
  const { _C } = useCurrencyResource()
  const { activePriceLists } = usePriceListResource()
  const { skus, skuLabelOf } = useSkuResource()
  const { outletOptions: activeOutletOptions } = useOutletResource()
  const index = useInvoiceIndex()

  const outletOptions = computed(() => {
    const set = new Set((index.outlets.value || []).map((outlet) => text(outlet.Code)).filter(Boolean))
    return activeOutletOptions.value.filter((o) => set.has(o.value))
  })

  const priceListOptions = computed(() => (activePriceLists.value || [])
    .map((list) => ({ value: list.code, label: list.name || list.code })))

  const skuCandidatesFor = (filter = '', taken = []) => {
    const onBill = new Set((taken || []).map(text))
    const term = text(filter).toLowerCase()
    return (Array.isArray(skus.value) ? skus.value : [])
      .filter((sku) => text(sku.status || 'Active').toUpperCase() === 'ACTIVE')
      .filter((sku) => !onBill.has(text(sku.code)))
      .map((sku) => {
        const label = skuLabelOf(sku.code)
        return {
          value: sku.code,
          primary: label.primary,
          secondary: label.secondary,
          uom: label.uom,
          search: `${label.primary} ${label.secondary} ${sku.code}`.toLowerCase()
        }
      })
      .filter((sku) => !term || sku.search.includes(term))
      .sort((a, b) => a.primary.localeCompare(b.primary) || a.secondary.localeCompare(b.secondary))
  }

  return {
    pageState,
    resourceConfig,
    ui,
    query,
    money: (value) => _C(num(value), true),
    resource: (name) => usePageRecord(name),
    skuLabelOf,
    skuCandidatesFor,
    outletOptions,
    priceListOptions,
    index
  }
}
