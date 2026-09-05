/**
 * Outlets › the enriched outlet — Layer 2, and the middle link of the outlet cascade.
 *
 *   OutletOperatingRules ─┐
 *                         ├─▶ Outlets (this file) ─▶ OutletVisits / Consumptions /
 *   PriceLists ───────────┘                          Restocks / Invoices / every UI
 *
 * Everything downstream asks THIS module for an outlet's commercial terms. It never asks the
 * rules sheet itself, and it never carries a fallback number of its own — the terms are
 * resolved once, here, by consuming `OutletOperatingRules`' own domain module in series
 * (UI_RESOURCE_DOMAIN_LOGIC.md §3.3).
 *
 * ── NO HARDCODED FALLBACK ──
 * `visitFrequencyDays` and `invoiceDueDays` used to fall back to a literal `30` compiled
 * into this file, which is why `useVisitCadence` had to bypass this module to read a
 * CONFIGURED number. Both now come from `APP.Resources.DefaultValues['OutletOperatingRules']`
 * through `operatingRuleDefaults()`, so the cascade has one answer and the bypass is gone.
 * `hasRules` still reports whether a ROW exists, so an outlet on the configured default is
 * correctly shown as unconfigured while still displaying the effective number.
 *
 * ── NON-DESTRUCTIVE ENRICHMENT ──
 * `enrichOutlet` spreads the raw row FIRST and adds derived keys beside it. A card, a list
 * preset or a tenant override that needs a sheet column this module never enumerated finds
 * it on the entity instead of re-deriving a parallel copy from the store.
 */

import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { defineSharedComposable } from 'src/utils/appHelpers'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'
import {
  enrichOperatingRule,
  operatingRuleDefaults,
  useOutletOperatingRulesResource
} from 'src/_resource/Master/OutletOperatingRules/composables/useOutletOperatingRulesResource'

/**
 * Pure Outlet enrichment — Outlets × OutletOperatingRules (1:1) × PriceLists.
 *
 * The rule's terms are resolved by `enrichOperatingRule`, never restated here: this file
 * reads the effective numbers and does not know what the defaults are or where they come
 * from. `ruleDefaults` is threaded in so the whole sheet resolves against ONE read of the
 * resource config rather than one read per outlet.
 */
export const enrichOutlet = (outlet, rulesByOutletMap = new Map(), priceListMap = new Map(), defaultPriceList = null, ruleDefaults = null) => {
  if (!outlet || !outlet.Code) return null

  const rule = rulesByOutletMap.get(outlet.Code) || null
  const operatingRule = enrichOperatingRule(rule, ruleDefaults)

  const priceListCode = operatingRule.priceListCode || defaultPriceList?.code || ''
  const priceList = priceListMap.get(priceListCode) || defaultPriceList || null

  return {
    // Every raw sheet column, untouched — nothing downstream has to go back to the store
    // for a field this list does not happen to name (§ Non-Destructive Entity Travel).
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

    // Combined Operating Rules (1:1 relation) — EFFECTIVE terms, resolved by the rules
    // domain against its own configured DefaultValues.
    ruleCode: operatingRule.ruleCode,
    maxStockValueLimit: operatingRule.maxStockValueLimit,
    visitFrequencyDays: operatingRule.visitFrequencyDays,
    invoiceDueDays: operatingRule.invoiceDueDays,
    creditLimit: operatingRule.creditLimit,
    priceListCode,
    ruleStatus: operatingRule.ruleStatus,
    hasRules: operatingRule.hasRules,

    // The whole enriched rule, so a card needing a rule column this list does not name
    // reads it here rather than joining the rules sheet again.
    operatingRule,

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
  // The rules index is built by the rules domain, not here — one index, one owner.
  const { rulesByOutletMap, defaults: ruleDefaults } = useOutletOperatingRulesResource()

  const outlets = computed(() => {
    const rawOutlets = dataStore.getRecords('Outlets') || []

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

  /**
   * One outlet's effective operating terms, for a caller that wants the terms and not the
   * whole outlet. Still resolved through the outlet, so the cascade has no side entrance.
   */
  const getOperatingRule = (outletCode) => {
    const o = getOutlet(outletCode)
    return o?.operatingRule || enrichOperatingRule(null, ruleDefaults.value)
  }

  // Options for any Outlet selector. Built once per app (CORE_ARCHITECTURE_RULES §6).
  const outletOptions = computed(() => activeOutlets.value.map((outlet) => ({
    label: [outlet.code, outlet.name].filter(Boolean).join(' · '),
    value: outlet.code
  })))

  return {
    outlets,
    allOutlets: outlets,
    activeOutlets,
    outletOptions,
    outletMap,
    getOutlet,
    getOperatingRule,
    getEffectivePriceListCode,
    getEffectivePriceList
  }
})

export function useOutletResource() {
  return shared(useDataStore())
}

// Re-exported so a caller holding raw rules rows (a `PageAction.js`, a replayed payload)
// resolves the SAME defaults this module enriches with, without a second import line (§3.3).
export { operatingRuleDefaults }
