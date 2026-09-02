// LeadFollowUps workflow vocabulary and state gates. Layer 2, pure functions only.
// Progress is stored Title Case, matching the LeadFollowUpProgress AppOptions group.

// eslint-disable-next-line no-unused-vars -- read by the permission-gated predicates below
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { parseAnyDate } from 'src/utils/dateHelpers'

const RESOURCE_NAME = 'LeadFollowUps'

export const AWAITING = 'Awaiting'
export const COMPLETED = 'Completed'
export const POSTPONED = 'Postponed'
export const CANCELLED = 'Cancelled'

export const PROGRESS_ORDER = [AWAITING, COMPLETED, POSTPONED, CANCELLED, 'OTHER']

/** Progress values that mean the follow-up has been responded to. */
export const RESPONDED = [COMPLETED, POSTPONED, CANCELLED]

export const PROGRESS_COLORS = {
  [AWAITING]: 'primary',
  [COMPLETED]: 'positive',
  [POSTPONED]: 'warning',
  [CANCELLED]: 'negative'
}

export const PROGRESS_ICONS = {
  [AWAITING]: 'schedule',
  [COMPLETED]: 'task_alt',
  [POSTPONED]: 'event_repeat',
  [CANCELLED]: 'cancel'
}

// Awaiting is the seat a follow-up is created in and carries no stamp columns.
export const PROGRESS_STAMPS = {
  [COMPLETED]: { comment: 'ProgressCompletedComment', by: 'ProgressCompletedBy', at: 'ProgressCompletedAt' },
  [POSTPONED]: { comment: 'ProgressPostponedComment', by: 'ProgressPostponedBy', at: 'ProgressPostponedAt' },
  [CANCELLED]: { comment: 'ProgressCancelledComment', by: 'ProgressCancelledBy', at: 'ProgressCancelledAt' }
}

/** The `Progress<Value>` stamp prefix for a target progress, or '' when it has none. */
export function stampPrefixFor (progress) {
  const canonical = canonicalProgress(progress)
  return PROGRESS_STAMPS[canonical] ? `Progress${canonical}` : ''
}

// ─── Progress vocabulary ──────────────────────────────────────────────────────

/** Canonical Title Case value, or '' when the raw value is outside the vocabulary. */
export function canonicalProgress (value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return ''
  return PROGRESS_ORDER.find((known) => known.toLowerCase() === raw) || ''
}

export function progressOf (row) {
  return canonicalProgress(row?.Progress)
}

export function progressBucket (row) {
  return progressOf(row) || 'OTHER'
}

export function isAwaiting (row) {
  return progressOf(row) === AWAITING
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

export function progressLabel (row) {
  return progressOf(row) || String(row?.Progress ?? '').trim() || 'Unknown'
}

/** The comment the follow-up's CURRENT outcome carries, or '' when it has none. */
export function progressComment (row) {
  const stamp = PROGRESS_STAMPS[progressOf(row)]
  return (stamp && row?.[stamp.comment]) || ''
}

/** The user recorded against the follow-up's CURRENT outcome, or '' when it has none. */
export function progressBy (row) {
  const stamp = PROGRESS_STAMPS[progressOf(row)]
  return (stamp && row?.[stamp.by]) || ''
}

// ─── State-transition gates ───────────────────────────────────────────────────

/** Only an awaiting follow-up is still open to edits; a response is a record of fact. */
export function isEditable (row) {
  return isAwaiting(row)
}

function canTransition (row, action) {
  const { allowed } = useResourceConfig(RESOURCE_NAME)
  return allowed(action) && isAwaiting(row)
}

export function canComplete (row) {
  return canTransition(row, 'update')
}

export function canPostpone (row) {
  return canTransition(row, 'update')
}

export function canCancel (row) {
  return canTransition(row, 'update')
}

export function canRespond (row) {
  return canComplete(row) || canPostpone(row) || canCancel(row)
}

// ─── Dates & delay ────────────────────────────────────────────────────────────

function midnight (value) {
  const date = parseAnyDate(value)
  return date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : null
}

/** Whole-day delay between the planned date and the response. Positive = late. */
export function respondDelayDays (row) {
  const planned = midnight(row?.Date)
  const responded = midnight(row?.RespondDate)
  if (!planned || !responded) return null
  return Math.round((responded - planned) / 86400000)
}

/** Whole days from today until the follow-up date. Negative = overdue. */
export function daysUntilFollowUp (row) {
  const target = midnight(row?.Date)
  if (!target) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target - today) / 86400000)
}

/** True when the follow-up is still awaiting and its date has passed. */
export function isOverdue (row) {
  if (!isAwaiting(row)) return false
  const days = daysUntilFollowUp(row)
  return days !== null && days < 0
}

export function useFollowUpProgress () {
  return {
    AWAITING,
    COMPLETED,
    POSTPONED,
    CANCELLED,
    RESPONDED,
    PROGRESS_ORDER,
    PROGRESS_COLORS,
    PROGRESS_ICONS,
    PROGRESS_STAMPS,
    canonicalProgress,
    stampPrefixFor,
    progressOf,
    progressBucket,
    isAwaiting,
    isResponded,
    isEditable,
    progressColor,
    progressIcon,
    progressLabel,
    progressComment,
    progressBy,
    canComplete,
    canPostpone,
    canCancel,
    canRespond,
    respondDelayDays,
    daysUntilFollowUp,
    isOverdue
  }
}
