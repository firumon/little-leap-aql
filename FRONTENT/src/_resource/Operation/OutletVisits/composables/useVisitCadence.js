/**
 * OutletVisits › visit cadence — Layer 2, the resource's domain logic.
 *
 * How often an outlet is meant to be visited. The question is about a VISIT, so the answer
 * lives with OutletVisits — even though the consumption wizard was the first caller to ask
 * it (UI_RESOURCE_DOMAIN_LOGIC.md §3.3: one vocabulary per resource, never a second copy).
 *
 * `useConsumptionProgress.js` re-exports both functions, so every existing caller keeps its
 * import line and there is still exactly ONE definition of the cadence rule.
 *
 * ISOLATION (§2.1): the only import is the generic `useResourceConfig` Core Composable. No
 * store, no service, nothing under `_ui/`.
 */

import { useResourceConfig } from 'src/composables/resources/useResourceConfig'

// The resource that owns the per-outlet visit cadence. Read for its DefaultValues rather
// than for its rows, so the fallback is a configured number rather than a constant
// compiled into the frontend — see `defaultVisitFrequencyDays` below.
const OPERATING_RULES_RESOURCE = 'OutletOperatingRules'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const isActiveRow = (value) => text(asRow(value).Status || 'Active') === 'Active'

/**
 * The configured visit cadence, with NO hardcoded frontend fallback.
 *
 * Read from `OutletOperatingRules`' backend `DefaultValues` — the same
 * `VisitFrequencyDays: 14` the sheet setup seeds — so retuning the cadence is a sheet
 * change, not a code change. Returns `0` when the config has not landed yet; every caller
 * treats `0` as "cadence unknown" and declines to band or schedule rather than inventing one.
 */
export function defaultVisitFrequencyDays () {
  const { defaultValues } = useResourceConfig(OPERATING_RULES_RESOURCE)
  const configured = num(defaultValues?.value?.VisitFrequencyDays ?? defaultValues?.VisitFrequencyDays)
  return configured > 0 ? configured : 0
}

/**
 * The cadence that applies to one outlet: its own operating rule, else the configured
 * default. The caller supplies the rules so this stays pure.
 *
 * Deliberately reads `OutletOperatingRules` rows rather than `enrichOutlet`'s
 * `visitFrequencyDays`, which falls back to a literal `14` compiled into
 * `_resource/Master/Outlets`. That literal predates the rule that a cadence must be
 * configured rather than assumed; going through it here would reintroduce exactly the
 * hardcoded constant this module is required not to carry. The enriched outlet is still
 * the right source for everything else it exposes.
 */
export function visitFrequencyFor (outletCode, operatingRules = []) {
  const code = text(outletCode)
  const rule = (Array.isArray(operatingRules) ? operatingRules : [])
    .map(asRow)
    .find((entry) => isActiveRow(entry) && text(entry.OutletCode) === code && num(entry.VisitFrequencyDays) > 0)
  return num(rule?.VisitFrequencyDays) || defaultVisitFrequencyDays()
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useVisitCadence () {
  return { defaultVisitFrequencyDays, visitFrequencyFor }
}
