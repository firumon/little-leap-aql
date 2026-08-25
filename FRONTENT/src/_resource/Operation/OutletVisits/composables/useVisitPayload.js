/**
 * OutletVisits — the batch payloads a visit mutation writes. Layer 2.
 *
 * The SINGLE source of truth for every request that creates, schedules or completes an
 * `OutletVisits` row — whichever module triggers it. The standalone Visits pages and the
 * consumption wizard's "complete this visit and plan the next one" step both come through
 * here, so the two can never drift on what a completed visit looks like
 * (UI_RESOURCE_DOMAIN_LOGIC.md §9.1).
 *
 * Two shapes per outcome, deliberately:
 *
 *   build<X>Request(…)        the raw request envelope, or `null` when there is nothing to
 *                             write. Used by a parent chain that has already validated.
 *   build<X>ChainRequests(…)  the Universal Return Envelope (§9.2) —
 *                             `{ valid, requests, permissions, message?, successMsg? }`.
 *                             This is what Layer 3 and sibling domains call.
 *
 * PURE functions throughout: no refs, no injects, no stores, nothing rendered (§9.6).
 * `resourceRequests` is imported rather than `usePageState` specifically so this module's
 * graph stays store-free (§2.1).
 */

import { addDays, toDateOnly } from 'src/utils/dateHelpers'
import {
  resourceCreateRequest,
  executeActionRequest,
  resourceGetRequest
} from 'src/composables/resources/resourceRequests'
import { visitFrequencyFor } from './useVisitCadence'
import { COMPLETED, PLANNED } from './useVisitProgress'

// This composable IS OutletVisits — always. Never route-derived (§3.2).
const RESOURCE_NAME = 'OutletVisits'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const todayISO = () => new Date().toISOString().slice(0, 10)

// ─── 1. Scheduling a visit ────────────────────────────────────────────────────

/**
 * Plan a visit for one outlet on one date.
 *
 * Returns `null` when either is missing. A visit with no outlet or no date is not a
 * partially-filled row to write and fix later — it is a row nothing can ever act on.
 */
export function buildVisitCreateRequest (visit = {}, options = {}) {
  const entry = asRow(visit)
  const outletCode = text(entry.OutletCode)
  const date = toDateOnly(text(entry.Date)) || text(entry.Date)
  if (!outletCode || !date) return null

  return resourceCreateRequest(RESOURCE_NAME, {
    OutletCode: outletCode,
    Date: date,
    Progress: PLANNED,
    ProgressPlannedComment: text(entry.ProgressPlannedComment) || text(options.comment),
    ...(text(entry.Username) ? { Username: text(entry.Username) } : {}),
    Status: 'Active'
  }, [RESOURCE_NAME])
}

/**
 * Scheduling as a chain — the envelope form of `buildVisitCreateRequest`.
 *
 * `refresh: false` suppresses the trailing cache pull, which a PARENT chain wants: it
 * appends one refresh of its own covering every resource the whole batch touched, and two
 * refreshes of `OutletVisits` in one round trip is a wasted query.
 */
export function buildVisitScheduleChainRequests ({ visit = {}, comment = '', refresh = true } = {}) {
  const request = buildVisitCreateRequest(visit, { comment })
  if (!request) {
    return { valid: false, requests: [], permissions: {}, message: 'Select an outlet and a visit date to schedule a visit.' }
  }

  const requests = [request]
  if (refresh) requests.push(resourceGetRequest([RESOURCE_NAME]))

  return {
    valid: true,
    requests,
    permissions: { [RESOURCE_NAME]: 'create' },
    successMsg: 'Visit scheduled.'
  }
}

// ─── 2. Completing a visit ────────────────────────────────────────────────────

/**
 * Complete a planned visit.
 *
 * Routed through `executeAction` rather than a direct update so GAS applies the same
 * `Progress<State>` stamping and validation the standalone Visits page gets — a visit's own
 * workflow rules are not a calling module's to reimplement.
 *
 * Returns `null` for a blank code, which is exactly what a consumption recorded against no
 * planned visit passes. No visit to complete is a normal outcome, not an error.
 */
export function buildVisitCompleteRequest (visitCode, actorName = '', comment = '') {
  const code = text(visitCode)
  if (!code) return null
  return executeActionRequest(RESOURCE_NAME, code, {
    action: 'Complete', column: 'Progress', columnValue: COMPLETED
  }, {
    RespondDate: todayISO(),
    ProgressCompletedComment: text(comment) || `Completed from outlet consumption by ${text(actorName) || 'Unknown'}.`
  }, [RESOURCE_NAME])
}

/**
 * Completion as a chain — the envelope form of `buildVisitCompleteRequest`.
 *
 * A blank `visitCode` yields a VALID, EMPTY envelope rather than a failure. The consumption
 * chain calls this whenever the user ticked "complete the visit", and an audit made against
 * no planned visit has nothing to complete — refusing there would block a legitimate
 * submission over an optional side-effect.
 */
export function buildVisitCompletionChainRequests ({ visitCode = '', actorName = '', comment = '', refresh = true } = {}) {
  const request = buildVisitCompleteRequest(visitCode, actorName, comment)
  if (!request) return { valid: true, requests: [], permissions: {} }

  const requests = [request]
  if (refresh) requests.push(resourceGetRequest([RESOURCE_NAME]))

  return {
    valid: true,
    requests,
    permissions: { [RESOURCE_NAME]: 'complete' },
    successMsg: 'Visit completed.'
  }
}

// ─── 3. The NEXT visit ────────────────────────────────────────────────────────

/**
 * Plan the next visit, `frequencyDays` after `form.Date`.
 *
 * `frequencyDays` is REQUIRED and is not defaulted here. A cadence this module invented
 * would silently schedule every outlet on a number nobody configured; `visitFrequencyFor`
 * reads the outlet's own operating rule and falls back to the backend's configured default.
 * A non-positive value yields `null` — no visit is planned rather than one planned for
 * tomorrow.
 */
export function buildNextVisitRequest (form = {}, frequencyDays = 0, actorName = '') {
  const entry = asRow(form)
  const frequency = num(frequencyDays)
  const outletCode = text(entry.OutletCode)
  if (!outletCode || frequency <= 0) return null

  const base = text(entry.Date) || todayISO()
  const nextDate = toDateOnly(addDays(base, frequency))
  if (!nextDate) return null

  return resourceCreateRequest(RESOURCE_NAME, {
    OutletCode: outletCode,
    Date: nextDate,
    Progress: PLANNED,
    ProgressPlannedComment: `Auto-planned ${frequency} days after the consumption recorded by ${text(actorName) || text(entry.Username) || 'Unknown'} on ${base}.`,
    Status: 'Active'
  }, [RESOURCE_NAME])
}

/**
 * Next-visit scheduling as a chain, resolving the cadence itself.
 *
 * The caller hands over the raw `OutletOperatingRules` rows and this reads the outlet's
 * cadence out of them — the cadence rule belongs to OutletVisits (`useVisitCadence`), so a
 * caller that only knows "schedule the next one" never has to know how often that is. A
 * caller that has already resolved the number may pass `frequencyDays` instead.
 *
 * An unresolvable cadence yields a VALID, EMPTY envelope: no visit is planned, and the
 * submission it rides on is not refused over a number nobody configured.
 */
export function buildNextVisitChainRequests ({
  form = {},
  frequencyDays = null,
  operatingRules = [],
  actorName = '',
  refresh = true
} = {}) {
  const frequency = frequencyDays === null || frequencyDays === undefined
    ? visitFrequencyFor(asRow(form).OutletCode, operatingRules)
    : num(frequencyDays)

  const request = buildNextVisitRequest(form, frequency, actorName)
  if (!request) return { valid: true, requests: [], permissions: {} }

  const requests = [request]
  if (refresh) requests.push(resourceGetRequest([RESOURCE_NAME]))

  return {
    valid: true,
    requests,
    permissions: { [RESOURCE_NAME]: 'create' },
    successMsg: 'Next visit scheduled.'
  }
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useVisitPayload () {
  return {
    buildVisitCreateRequest,
    buildVisitScheduleChainRequests,
    buildVisitCompleteRequest,
    buildVisitCompletionChainRequests,
    buildNextVisitRequest,
    buildNextVisitChainRequests
  }
}
