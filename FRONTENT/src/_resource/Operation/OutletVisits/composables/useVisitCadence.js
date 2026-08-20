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
 * ── THE CASCADE, NOT A BYPASS ──
 * The NUMBER itself belongs to `OutletOperatingRules`, so this file no longer scans that
 * sheet or reads its `DefaultValues` itself — it consumes the rules domain in series and
 * states only what is a VISIT rule: that the cadence is what schedules the next visit, and
 * that an unresolvable cadence means "do not schedule" rather than "schedule at a guess".
 * The scan it used to do was a `.find()` per outlet over every rule row; the rules domain
 * indexes them once and answers in O(1).
 *
 * ISOLATION (§2.1): the only import is another Layer 2 domain module. No store, no service,
 * nothing under `_ui/`.
 */

import {
  operatingRuleDefaults,
  visitFrequencyFor as ruleVisitFrequencyFor
} from 'src/_resource/Master/OutletOperatingRules/composables/useOutletOperatingRulesResource'

/**
 * The configured visit cadence, with NO hardcoded frontend fallback.
 *
 * Read from `OutletOperatingRules`' backend `DefaultValues` — so retuning the cadence is a
 * sheet change, not a code change. Returns `0` when the config has not landed yet; every
 * caller treats `0` as "cadence unknown" and declines to band or schedule rather than
 * inventing one.
 */
export function defaultVisitFrequencyDays () {
  return operatingRuleDefaults().visitFrequencyDays
}

/**
 * The cadence that applies to one outlet: its own operating rule, else the configured
 * default. The caller supplies the rules — raw rows OR an already-built
 * `Map<OutletCode, rule>` — so this stays pure and a caller inside a loop can hand over an
 * index instead of an array.
 */
export function visitFrequencyFor (outletCode, operatingRules = []) {
  return ruleVisitFrequencyFor(outletCode, operatingRules)
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useVisitCadence () {
  return { defaultVisitFrequencyDays, visitFrequencyFor }
}
