/**
 * OutletOperatingRules › the commercial terms of one outlet — Layer 2, this resource's own
 * domain module.
 *
 * `Outlets` → `OutletOperatingRules` is a 1:1 relation, and every term the relation carries
 * — the visit cadence, the invoice due window, the credit ceiling, the stock-value ceiling,
 * the price list — is asked for from four different modules. Before this file existed each
 * of them answered the question again: `useOutletResource` with a literal `30`,
 * `useVisitCadence` by scanning the rows itself, `useInvoiceCalculation` with a literal
 * `30`, `useConsumptionIndex` with its own map. That is the bypass link
 * UI_RESOURCE_DOMAIN_LOGIC.md §3.3 forbids — one vocabulary per resource, never a second
 * copy — so the answer now starts here and everyone else consumes it in series.
 *
 * ── NO HARDCODED FALLBACK, EVER ──
 * When an outlet declares no rule, the term comes from the resource's own backend
 * `DefaultValues` (`APP.Resources.DefaultValues['OutletOperatingRules']`), read through
 * `useResourceConfig(RESOURCE_NAME).defaultValues`. Retuning a cadence or a due window is a
 * sheet change, not a code change. A term nobody configured resolves to `0`, and every
 * consumer treats `0` as "unknown" rather than inventing a number.
 *
 * ── NON-DESTRUCTIVE ENRICHMENT ──
 * `enrichOperatingRule` spreads the raw row and ADDS resolved keys beside it. A downstream
 * card that needs a column this module never thought about still finds it.
 *
 * ── INDEXED, NEVER SCANNED ──
 * `indexRulesByOutlet` folds the whole sheet into a `Map` in one pass; every lookup after
 * that is O(1). Nothing here calls `.find()` inside a loop.
 *
 * ISOLATION (§2.1): the only imports are the generic `useResourceConfig` Core Composable and
 * the data store the shared wrapper is handed. Nothing under `_ui/`.
 */

import { computed } from 'vue'
import { useDataStore } from 'src/stores/data'
import { defineSharedComposable } from 'src/utils/appHelpers'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'

const RESOURCE_NAME = 'OutletOperatingRules'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
/** A term of `0` in an unconfigured numeric column is a blank that got coerced, not a choice. */
const positive = (value) => (num(value) > 0 ? num(value) : 0)
const isActiveRow = (value) => {
  const status = text(asRow(value).Status)
  return !status || status.toUpperCase() === 'ACTIVE'
}

/**
 * The configured defaults for every term this resource carries.
 *
 * Read off the backend `DefaultValues` of THIS resource — never a literal compiled into the
 * frontend. `useResourceConfig` returns computed refs, so the `.value ?? plain` pair below
 * also covers a caller reading it before the refs exist.
 */
export function operatingRuleDefaults () {
  const { defaultValues } = useResourceConfig(RESOURCE_NAME)
  const configured = asRow(defaultValues?.value ?? defaultValues)
  return {
    visitFrequencyDays: positive(configured.VisitFrequencyDays),
    invoiceDueDays: positive(configured.InvoiceDueDays),
    creditLimit: num(configured.CreditLimit),
    maxStockValueLimit: num(configured.MaxStockValueLimit),
    priceListCode: text(configured.PriceListCode),
    _raw: configured
  }
}

/**
 * Every active rule row folded into `Map<OutletCode, row>` in ONE pass.
 *
 * The relation is 1:1, so the FIRST active row for an outlet wins — a duplicate is a data
 * fault, and taking the first keeps the answer stable across reads instead of leaving it to
 * sheet order at the moment of the scan.
 */
export function indexRulesByOutlet (rows = []) {
  const map = new Map()
  ;(Array.isArray(rows) ? rows : []).forEach((entry) => {
    const row = asRow(entry)
    if (!isActiveRow(row)) return
    const code = text(row.OutletCode)
    if (!code || map.has(code)) return
    map.set(code, row)
  })
  return map
}

/** Resolve a rules source — a prebuilt `Map`, or raw rows to index — to a `Map`. */
export function asRulesMap (source) {
  if (source instanceof Map) return source
  return indexRulesByOutlet(source)
}

/**
 * One outlet's rule row, decorated with its EFFECTIVE terms.
 *
 * Non-destructive: the raw row is spread first, so every column the sheet carries survives
 * the trip to Layer 3 and a card may render a column this module has never heard of. The
 * added keys are the resolved answers — the row's own value when it declares one, the
 * configured default when it does not.
 *
 * `hasRules` stays honest: it reports whether a ROW exists, not whether a number resolved.
 * An outlet running on the configured 30-day default still reads `hasRules: false`.
 */
export function enrichOperatingRule (rule, defaults = null) {
  const row = asRow(rule)
  const base = defaults || operatingRuleDefaults()
  const has = !!(rule && text(row.Code || row.OutletCode))

  return {
    ...row,

    ruleCode: text(row.Code),
    outletCode: text(row.OutletCode),

    visitFrequencyDays: positive(row.VisitFrequencyDays) || base.visitFrequencyDays,
    invoiceDueDays: positive(row.InvoiceDueDays) || base.invoiceDueDays,
    creditLimit: num(row.CreditLimit) || base.creditLimit,
    maxStockValueLimit: num(row.MaxStockValueLimit) || base.maxStockValueLimit,
    priceListCode: text(row.PriceListCode) || base.priceListCode,

    ruleStatus: text(row.Status) || 'Active',
    hasRules: has,

    _rule: has ? row : null,
    _defaults: base
  }
}

/** The raw rule row of one outlet, from a `Map` or from raw rows. O(1) against a `Map`. */
export function ruleFor (outletCode, rules = []) {
  return asRulesMap(rules).get(text(outletCode)) || null
}

/** The effective terms of one outlet — its rule folded over the configured defaults. */
export function effectiveRuleFor (outletCode, rules = [], defaults = null) {
  return enrichOperatingRule(ruleFor(outletCode, rules), defaults)
}

/** How many days apart this outlet is meant to be visited. `0` when nobody configured it. */
export function visitFrequencyFor (outletCode, rules = [], defaults = null) {
  return effectiveRuleFor(outletCode, rules, defaults).visitFrequencyDays
}

/** How many days after issue this outlet's invoices fall due. `0` when unconfigured. */
export function invoiceDueDaysFor (outletCode, rules = [], defaults = null) {
  return effectiveRuleFor(outletCode, rules, defaults).invoiceDueDays
}

/** This outlet's credit ceiling. */
export function creditLimitFor (outletCode, rules = [], defaults = null) {
  return effectiveRuleFor(outletCode, rules, defaults).creditLimit
}

/** This outlet's stock-value ceiling. */
export function maxStockValueLimitFor (outletCode, rules = [], defaults = null) {
  return effectiveRuleFor(outletCode, rules, defaults).maxStockValueLimit
}

/** The price list this outlet's rule names, else the configured default. */
export function priceListCodeFor (outletCode, rules = [], defaults = null) {
  return effectiveRuleFor(outletCode, rules, defaults).priceListCode
}

/**
 * Reactive shape for setup-context callers.
 *
 * ONCE PER APP (CORE_ARCHITECTURE_RULES §6): the index is built one time and every consumer
 * — `useOutletResource`, `useVisitCadence`, the invoice module — lands on the same computed.
 */
const shared = defineSharedComposable((dataStore) => {
  const rawRules = computed(() => (dataStore.getRecords(RESOURCE_NAME) || []).map(asRow))

  const defaults = computed(() => operatingRuleDefaults())
  const rulesByOutletMap = computed(() => indexRulesByOutlet(rawRules.value))
  const rules = computed(() => [...rulesByOutletMap.value.values()])

  const getRule = (outletCode) => rulesByOutletMap.value.get(text(outletCode)) || null
  const ruleOf = (outletCode) => enrichOperatingRule(getRule(outletCode), defaults.value)

  return {
    RESOURCE_NAME,
    rawRules,
    rules,
    rulesByOutletMap,
    defaults,
    getRule,
    ruleOf,
    visitFrequencyOf: (outletCode) => ruleOf(outletCode).visitFrequencyDays,
    invoiceDueDaysOf: (outletCode) => ruleOf(outletCode).invoiceDueDays,
    creditLimitOf: (outletCode) => ruleOf(outletCode).creditLimit,
    maxStockValueLimitOf: (outletCode) => ruleOf(outletCode).maxStockValueLimit,
    priceListCodeOf: (outletCode) => ruleOf(outletCode).priceListCode
  }
})

export function useOutletOperatingRulesResource () {
  return shared(useDataStore())
}
