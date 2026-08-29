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

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** The date `days` after `fromISO`, as `YYYY-MM-DD`. A visit is never scheduled backwards. */
export function visitDateFrom (fromISO = '', days = 0) {
  const base = text(fromISO) ? new Date(`${text(fromISO)}T00:00:00`) : new Date()
  if (Number.isNaN(base.getTime())) return ''
  base.setDate(base.getDate() + Math.max(0, Math.round(num(days))))
  return base.toISOString().slice(0, 10)
}

/** Whole calendar days between two dates, for the date box that drives the day count. */
export function visitDaysBetween (fromISO = '', toISO = '') {
  const base = new Date(`${text(fromISO)}T00:00:00`)
  const chosen = new Date(`${text(toISO)}T00:00:00`)
  if (Number.isNaN(base.getTime()) || Number.isNaN(chosen.getTime())) return null
  return Math.max(0, Math.round((chosen.getTime() - base.getTime()) / 86400000))
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useVisitCadence () {
  return { defaultVisitFrequencyDays, visitFrequencyFor, visitDateFrom, visitDaysBetween }
}
