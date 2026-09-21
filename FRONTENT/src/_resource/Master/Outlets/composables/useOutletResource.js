// Outlets: Layer 2 enriched outlet master resource.
import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'
import {
  enrichOperatingRule,
  operatingRuleDefaults,
  useOutletOperatingRulesResource
} from 'src/_resource/Master/OutletOperatingRules/composables/useOutletOperatingRulesResource'

const text = (value) => (value == null ? '' : String(value).trim())

function outletLabelOf (outlet) {
  const code = text(outlet?.code ?? outlet?.Code)
  const name = text(outlet?.name ?? outlet?.Name)
  if (!name) return code

  const city = text(outlet?.city ?? outlet?.City)
  const area = text(outlet?.area ?? outlet?.Area)
  const location = [city, area].filter(Boolean).join('/')

  return location ? `${name} - ${location} (${code})` : `${name} (${code})`
}

// Pure Outlet enrichment: Outlets x OutletOperatingRules (1:1) x PriceLists.
export const enrichOutlet = (outlet, rulesByOutletMap = new Map(), priceListMap = new Map(), defaultPriceList = null, ruleDefaults = null) => {
  if (!outlet || !outlet.Code) return null

  const rule = rulesByOutletMap.get(outlet.Code) || null
  const operatingRule = enrichOperatingRule(rule, ruleDefaults)

  const priceListCode = operatingRule.priceListCode || defaultPriceList?.code || ''
  const priceList = priceListMap.get(priceListCode) || defaultPriceList || null

  return {
    ...outlet,

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
    ruleCode: operatingRule.ruleCode,
    maxStockValueLimit: operatingRule.maxStockValueLimit,
    visitFrequencyDays: operatingRule.visitFrequencyDays,
    invoiceDueDays: operatingRule.invoiceDueDays,
    creditLimit: operatingRule.creditLimit,
    priceListCode,
    ruleStatus: operatingRule.ruleStatus,
    hasRules: operatingRule.hasRules,

    operatingRule,
    priceList,

    // Audit fields
    createdAt: outlet.CreatedAt || '',
    updatedAt: outlet.UpdatedAt || '',
    createdBy: outlet.CreatedBy || '',
    updatedBy: outlet.UpdatedBy || '',

    _raw: outlet,
    _rule: rule
  }
}

// Master Outlets composable memoized once per app.
const build = (recordSource) => {
  const { priceListMap, defaultPriceList } = usePriceListResource()
  const { rulesByOutletMap, defaults: ruleDefaults } = useOutletOperatingRulesResource()

  const outlets = computed(() => {
    const rawOutlets = recordSource.rows('Outlets') || []

    const rulesMap = rulesByOutletMap.value
    const plMap = priceListMap.value
    const defPl = defaultPriceList.value
    const defRule = ruleDefaults.value

    return rawOutlets.map((o) => enrichOutlet(o, rulesMap, plMap, defPl, defRule)).filter(Boolean)
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

  const getOperatingRule = (outletCode) => {
    const o = getOutlet(outletCode)
    return o?.operatingRule || enrichOperatingRule(null, ruleDefaults.value)
  }

  // Full option list from all outlets, sorted A-Z by name.
  const allOutletOptions = computed(() =>
    outlets.value
      .map((outlet) => {
        const code = text(outlet.code || outlet.Code)
        const name = text(outlet.name || outlet.Name)
        const status = text(outlet.status || outlet.Status) || 'Active'
        return {
          label: outletLabelOf(outlet),
          value: code,
          name,
          status,
          isActive: status.toUpperCase() === 'ACTIVE'
        }
      })
      .sort((a, b) => (a.name || a.value).localeCompare(b.name || b.value))
  )

  const outletOptions = computed(() => allOutletOptions.value.filter((o) => o.isActive))

  return {
    outlets,
    allOutlets: outlets,
    activeOutlets,
    allOutletOptions,
    outletOptions,
    outletLabelOf,
    outletMap,
    getOutlet,
    getOperatingRule,
    getEffectivePriceListCode,
    getEffectivePriceList
  }
}

export function useOutletResource () {
  const recordSource = useRecord()
  return recordSource.remember('useOutletResource', () => build(recordSource))
}

// Re-exported so a caller holding raw rules rows resolves the same defaults without a second import.
export { operatingRuleDefaults, outletLabelOf }
