/**
 * OutletVisits — the visit workflow vocabulary and its state-transition predicates.
 *
 * Layer 2 (UI_RESOURCE_DOMAIN_LOGIC.md §2): the single answer to "what state is this
 * visit in, and what can it do right now", shared by every UI that renders a visit. It
 * imports only generic `src/utils/` helpers — no store, no service, nothing under `_ui/`,
 * no `inject()`, no lifecycle `ref()`.
 *
 * Every export is a PURE function of a record and takes `record`/`records` only — never a
 * `config` (§3.2). Where permissions are ever needed, this module resolves them itself via
 * `useResourceConfig(RESOURCE_NAME)`; it never asks the route and never accepts a config
 * from a caller.
 *
 * Purity also matters mechanically: the OutletVisits page contract
 * (`_ui/AQL/pages/Operation/OutletVisits/Index.js`) and the JS modifiers that consume these
 * are evaluated outside any component setup, so they cannot call something that injects or
 * holds reactive state.
 *
 * Presentation built ON TOP of this vocabulary — the per-view list row presets, the
 * countdown wording, the outlet display name — stays in
 * `_ui/AQL/composables/Operation/OutletVisits/useVisitPresentation.js` (§4).
 */

// eslint-disable-next-line no-unused-vars -- read by the permission-gated predicates below
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { parseAnyDate } from 'src/utils/dateHelpers'

// This composable IS OutletVisits — always. Never derived from the route (§3.2).
const RESOURCE_NAME = 'OutletVisits'

export const PLANNED = 'PLANNED'
export const COMPLETED = 'COMPLETED'
export const POSTPONED = 'POSTPONED'
export const CANCELLED = 'CANCELLED'

/** Progress values that mean the visit has been responded to. */
export const RESPONDED = [COMPLETED, POSTPONED, CANCELLED]

/**
 * Every progress a visit may carry, in workflow order, with `OTHER` as the catch-all
 * bucket for a sheet value outside the vocabulary.
 *
 * This is the one definition (§3.3). It previously also existed as `VISIT_PROGRESS_ORDER`
 * in `src/composables/operation/outlets/outletOperationsMeta.js`, where five other
 * resources' vocabularies shared one file and one flat `META` table — a Layer 1 file
 * naming Layer 2 concepts, which §2 forbids.
 */
export const PROGRESS_ORDER = [PLANNED, COMPLETED, POSTPONED, CANCELLED, 'OTHER']

export const PROGRESS_COLORS = {
  [PLANNED]: 'primary',
  [COMPLETED]: 'positive',
  [POSTPONED]: 'warning',
  [CANCELLED]: 'negative'
}

export const PROGRESS_ICONS = {
  [PLANNED]: 'event_available',
  [COMPLETED]: 'task_alt',
  [POSTPONED]: 'event_repeat',
  [CANCELLED]: 'cancel'
}

/** Per-outcome comment / actor / timestamp columns, keyed by normalized Progress. */
export const PROGRESS_STAMPS = {
  [COMPLETED]: { comment: 'ProgressCompletedComment', by: 'ProgressCompletedBy', at: 'ProgressCompletedAt' },
  [POSTPONED]: { comment: 'ProgressPostponedComment', by: 'ProgressPostponedBy', at: 'ProgressPostponedAt' },
  [CANCELLED]: { comment: 'ProgressCancelledComment', by: 'ProgressCancelledBy', at: 'ProgressCancelledAt' },
  [PLANNED]: { comment: 'ProgressPlannedComment', by: 'ProgressPlannedBy', at: 'ProgressPlannedAt' }
}

// ─── Progress vocabulary ──────────────────────────────────────────────────────

/** Normalized Progress value, tolerant of casing and stray whitespace from the sheet. */
export function progressOf (row) {
  return String(row?.Progress ?? '').trim().toUpperCase()
}

/**
 * Normalized progress that falls back to `Status` when `Progress` is blank.
 *
 * Kept distinct from `progressOf` because the two genuinely differ: the OutletVisits UI
 * reads `Progress` only, while the cross-resource callers migrated off
 * `outletOperationsMeta.visitProgress` (notably OutletConsumptions, which filters a
 * customer's planned visits) relied on the `Status` fallback for older rows. Folding them
 * into one function would silently change one caller's behaviour.
 */
export function progressOrStatusOf (row) {
  return String(row?.Progress ?? row?.Status ?? '').trim().toUpperCase()
}

/** True when the row's progress is outside the known vocabulary. */
export function isKnownProgress (row) {
  return PROGRESS_ORDER.includes(progressOrStatusOf(row))
}

/** The bucket a row groups under, collapsing anything unrecognized into `OTHER`. */
export function progressBucket (row) {
  const value = progressOrStatusOf(row)
  return PROGRESS_ORDER.includes(value) ? value : 'OTHER'
}

export function isPlanned (row) {
  return progressOf(row) === PLANNED
}

export function isResponded (row) {
  return RESPONDED.includes(progressOf(row))
}

export function progressColor (row) {
  return PROGRESS_COLORS[progressOf(row)] || 'grey-6'
}

export function progressIcon (row) {
  return PROGRESS_ICONS[progressOf(row)] || 'help_outline'
}

/** Title-cased outcome for display; the sheet stores it upper-cased. */
export function progressLabel (row) {
  const raw = progressOf(row)
  if (!raw) return 'Unknown'
  return raw.charAt(0) + raw.slice(1).toLowerCase()
}

/** The comment the visit's CURRENT outcome carries, or '' when it has none. */
export function progressComment (row) {
  const stamp = PROGRESS_STAMPS[progressOf(row)]
  return (stamp && row?.[stamp.comment]) || ''
}

/** The user recorded against the visit's CURRENT outcome, or '' when it has none. */
export function progressBy (row) {
  const stamp = PROGRESS_STAMPS[progressOf(row)]
  return (stamp && row?.[stamp.by]) || ''
}

export function plannedComment (row) {
  return row?.ProgressPlannedComment || ''
}

// ─── State-transition gates ───────────────────────────────────────────────────

/**
 * Whether the visit is still open to edits.
 *
 * A settled visit (completed / postponed / cancelled) is terminal: its outcome stamp is
 * written and re-editing it would rewrite history. This is the rule `Edit`'s submit gate
 * enforces, expressed once here rather than as a `Progress === 'PLANNED'` check inlined at
 * each call site.
 */
export function isEditable (row) {
  return isPlanned(row)
}

/**
 * Whether the visit may be completed, postponed or cancelled right now.
 *
 * All three outcome transitions share one precondition — the visit is still PLANNED — and
 * one permission, `update`. Permission is resolved here from this module's own resource
 * name, never passed in (§3.2).
 */
export function canRespond (row) {
  const { allowed } = useResourceConfig(RESOURCE_NAME)
  return allowed('update') && isPlanned(row)
}

// ─── Dates & delay ────────────────────────────────────────────────────────────

/** Local midnight of a parsed value, so day maths never straddles a time component. */
function midnight (value) {
  const date = parseAnyDate(value)
  return date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : null
}

/**
 * Whole-day delay between the planned visit date and the date it was responded to.
 *
 * Positive = late, 0 = same day, negative = answered early. Both sides are floored to
 * local midnight first, so a `RespondDate` carrying a time component (it is stored as
 * `YYYY-MM-DD HH:mm:ss`) never rounds a same-day response up to one day late.
 *
 * @returns {number|null} null when either side is missing or unparseable.
 */
export function respondDelayDays (row) {
  const planned = midnight(row?.Date)
  const responded = midnight(row?.RespondDate)
  if (!planned || !responded) return null
  return Math.round((responded - planned) / 86400000)
}

/**
 * Whole days from today until the visit date. Positive = future, 0 = today,
 * negative = overdue.
 *
 * @returns {number|null} null when the date is missing or unparseable.
 */
export function daysUntilVisit (row) {
  const target = midnight(row?.Date)
  if (!target) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target - today) / 86400000)
}

/**
 * The response-time service level, as a threshold table rather than an inlined `if` chain.
 *
 * Domain, not presentation: "answered within five days is a slip, beyond that is a
 * failure" is a statement about how the business judges visit follow-through, and it is
 * the same judgement whichever UI renders it. Exported so a caller needing the bands for
 * anything other than a colour (a legend, a report bucket, a metric threshold) reads them
 * from here instead of restating the numbers (§3.3).
 *
 * Ordered most-favourable first; `delayColor` returns the first band the value satisfies.
 */
export const DELAY_BANDS = [
  { maxDays: 0, color: 'positive' },
  { maxDays: 5, color: 'warning' },
  { maxDays: Infinity, color: 'negative' }
]

/**
 * Badge colour for a response delay: on time or early is positive, a short slip is a
 * warning, anything beyond the last finite band is negative.
 *
 * Takes the day count rather than the row because both the settled list preset and the
 * View card have already computed `respondDelayDays(row)` for their own label and would
 * otherwise parse the same two dates twice per row.
 */
export function delayColor (days) {
  if (days === null || days === undefined) return 'grey-6'
  return DELAY_BANDS.find((band) => days <= band.maxDays).color
}

/**
 * Composable shape for setup-context callers. Returns the same pure functions, so a
 * component can `const { progressColor } = useVisitProgress()` instead of importing each
 * name — behaviour is identical either way.
 */
export function useVisitProgress () {
  return {
    PLANNED,
    COMPLETED,
    POSTPONED,
    CANCELLED,
    RESPONDED,
    PROGRESS_ORDER,
    PROGRESS_COLORS,
    PROGRESS_ICONS,
    PROGRESS_STAMPS,
    DELAY_BANDS,
    progressOf,
    progressOrStatusOf,
    isKnownProgress,
    progressBucket,
    isPlanned,
    isResponded,
    isEditable,
    canRespond,
    progressColor,
    progressIcon,
    progressLabel,
    progressComment,
    progressBy,
    plannedComment,
    respondDelayDays,
    daysUntilVisit,
    delayColor
  }
}
