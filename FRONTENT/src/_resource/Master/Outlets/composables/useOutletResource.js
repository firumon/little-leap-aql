import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { defineSharedComposable } from 'src/utils/appHelpers'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'

// Pure Outlet enrichment function combining Outlets and OutletOperatingRules (1:1 relation)
export const enrichOutlet = (outlet, rulesByOutletMap = new Map(), priceListMap = new Map(), defaultPriceList = null) => {
  if (!outlet || !outlet.Code) return null
  const rule = rulesByOutletMap.get(outlet.Code) || null

  const priceListCode = rule?.PriceListCode || defaultPriceList?.code || ''
  const priceList = priceListMap.get(priceListCode) || defaultPriceList || null

  return {
    // Core Outlet Fields
    code: outlet.Code,
    outletCode: outlet.Code,
    name: outlet.Name || '',
    contactPerson: outlet.ContactPerson || '',
    phone: outlet.Phone || '',
    email: outlet.Email || '',
    country: outlet.Country || '',
    province: outlet.Province || '',
    city: outlet.City || '',
    area: outlet.Area || '',
    communicationAddress: outlet.CommunicationAddress || '',
    mapLocationLink: outlet.MapLocationLink || '',
    picture: outlet.Picture || '',
    picture2: outlet.Picture2 || '',
    picture3: outlet.Picture3 || '',
    licence: outlet.Licence || '',
    taxRegistrationNumber: outlet.TaxRegistrationNumber || '',
    taxRegistrationName: outlet.TaxRegistrationName || '',
    accessRegion: outlet.AccessRegion || '',
    status: outlet.Status || 'Active',

    // Combined Operating Rules (1:1 relation)
    ruleCode: rule?.Code || '',
    maxStockValueLimit: Number(rule?.MaxStockValueLimit) || 0,
    visitFrequencyDays: Number(rule?.VisitFrequencyDays) || 14,
    invoiceDueDays: Number(rule?.InvoiceDueDays) || 30,
    creditLimit: Number(rule?.CreditLimit) || 0,
    priceListCode,
    ruleStatus: rule?.Status || 'Active',
    hasRules: !!rule,

    // Enriched Price List reference
    priceList,

    // Audit fields
    createdAt: outlet.CreatedAt || '',
    updatedAt: outlet.UpdatedAt || '',
    createdBy: outlet.CreatedBy || '',
    updatedBy: outlet.UpdatedBy || '',

    // Raw references
    _raw: outlet,
    _rule: rule
  }
}

// Composable for Outlets master resource//
// ONCE PER APP (CORE_ARCHITECTURE_RULES §6) — see `useSkuResource` for the rationale.
const shared = defineSharedComposable((dataStore) => {
  const { priceListMap, defaultPriceList } = usePriceListResource()

  const outlets = computed(() => {
    const rawOutlets = dataStore.getRecords('Outlets') || []
    const rawRules = dataStore.getRecords('OutletOperatingRules') || []

    const rulesMap = new Map(rawRules.map((r) => [r.OutletCode, r]))
    const plMap = priceListMap.value
    const defPl = defaultPriceList.value

    return rawOutlets.map((o) => enrichOutlet(o, rulesMap, plMap, defPl)).filter(Boolean)
  })

  const activeOutlets = computed(() => outlets.value.filter((o) => o.status === 'Active'))

  const outletMap = computed(() => new Map(outlets.value.map((o) => [o.code, o])))

  const getOutlet = (code) => {
    if (!code) return null
    return outletMap.value.get(code) || null
  }

  const getEffectivePriceListCode = (outletCode) => {
    const o = getOutlet(outletCode)
    return o?.priceListCode || defaultPriceList.value?.code || ''
  }

  const getEffectivePriceList = (outletCode) => {
    const o = getOutlet(outletCode)
    return o?.priceList || defaultPriceList.value || null
  }

  return {
    outlets,
    allOutlets: outlets,
    activeOutlets,
    outletMap,
    getOutlet,
    getEffectivePriceListCode,
    getEffectivePriceList
  }
})

export function useOutletResource() {
  return shared(useDataStore())
}
