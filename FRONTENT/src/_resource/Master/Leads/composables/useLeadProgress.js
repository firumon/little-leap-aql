// Leads workflow vocabulary and state gates. Layer 2, pure functions only.
// Progress is stored Title Case here, not upper case like the outlet sheets.

// eslint-disable-next-line no-unused-vars -- read by the permission-gated predicates below
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'

// This composable IS Leads — always. Never derived from the route (§3.2).
const RESOURCE_NAME = 'Leads'

export const DRAFT = 'Draft'
export const PROCESSING = 'Processing'
export const LATER = 'Later'
export const REJECTED = 'Rejected'
export const APPROVED = 'Approved'

/** Every progress a lead may carry, in workflow order, `OTHER` catching sheet strays. */
export const PROGRESS_ORDER = [DRAFT, PROCESSING, LATER, REJECTED, APPROVED, 'OTHER']

/** Progress values that mean nobody is working the lead any more. */
export const SETTLED = [LATER, REJECTED, APPROVED]

/** Progress values that still expect follow-up work. */
export const OPEN = [DRAFT, PROCESSING]

export const PROGRESS_COLORS = {
  [DRAFT]: 'grey-7',
  [PROCESSING]: 'primary',
  [LATER]: 'warning',
  [REJECTED]: 'negative',
  [APPROVED]: 'positive'
}

export const PROGRESS_ICONS = {
  [DRAFT]: 'edit_note',
  [PROCESSING]: 'autorenew',
  [LATER]: 'schedule',
  [REJECTED]: 'cancel',
  [APPROVED]: 'verified'
}

// Draft has no stamp columns on the sheet.
export const PROGRESS_STAMPS = {
  [PROCESSING]: { comment: 'ProgressProcessingComment', by: 'ProgressProcessingBy', at: 'ProgressProcessingAt' },
  [LATER]: { comment: 'ProgressLaterComment', by: 'ProgressLaterBy', at: 'ProgressLaterAt' },
  [REJECTED]: { comment: 'ProgressRejectedComment', by: 'ProgressRejectedBy', at: 'ProgressRejectedAt' },
  [APPROVED]: { comment: 'ProgressApprovedComment', by: 'ProgressApprovedBy', at: 'ProgressApprovedAt' }
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

/** Normalized Progress value of a row, '' when blank or unrecognized. */
export function progressOf (row) {
  return canonicalProgress(row?.Progress)
}

/** True when the row's progress is inside the known vocabulary. */
export function isKnownProgress (row) {
  return !!progressOf(row)
}

/** The bucket a row groups under, collapsing anything unrecognized into `OTHER`. */
export function progressBucket (row) {
  return progressOf(row) || 'OTHER'
}

export function isDraft (row) {
  return progressOf(row) === DRAFT
}

export function isProcessing (row) {
  return progressOf(row) === PROCESSING
}

export function isApproved (row) {
  return progressOf(row) === APPROVED
}

export function isRejected (row) {
  return progressOf(row) === REJECTED
}

export function isLater (row) {
  return progressOf(row) === LATER
}

/** True while the lead is still being worked — the queue an officer acts on. */
export function isOpen (row) {
  return OPEN.includes(progressOf(row))
}

/** True once the lead has left the working queue, whichever way it went. */
export function isSettled (row) {
  return SETTLED.includes(progressOf(row))
}

export function progressColor (row) {
  return PROGRESS_COLORS[progressOf(row)] || 'grey-6'
}

export function progressIcon (row) {
  return PROGRESS_ICONS[progressOf(row)] || 'help_outline'
}

/** Display label; the sheet already stores it Title Case, so a stray value shows as-is. */
export function progressLabel (row) {
  return progressOf(row) || String(row?.Progress ?? '').trim() || 'Unknown'
}

/** The comment the lead's CURRENT progress carries, or '' when it has none. */
export function progressComment (row) {
  const stamp = PROGRESS_STAMPS[progressOf(row)]
  return (stamp && row?.[stamp.comment]) || ''
}

/** The user recorded against the lead's CURRENT progress, or '' when it has none. */
export function progressBy (row) {
  const stamp = PROGRESS_STAMPS[progressOf(row)]
  return (stamp && row?.[stamp.by]) || ''
}

/** When the lead's CURRENT progress was stamped, or '' when it has none. */
export function progressAt (row) {
  const stamp = PROGRESS_STAMPS[progressOf(row)]
  return (stamp && row?.[stamp.at]) || ''
}

// ─── State-transition gates ───────────────────────────────────────────────────

// Approved is terminal; a later conversion reads its stamp. Later and Rejected reopen.
export const PROGRESS_TRANSITIONS = {
  [DRAFT]: [PROCESSING, LATER, REJECTED],
  [PROCESSING]: [LATER, REJECTED, APPROVED],
  [LATER]: [PROCESSING, REJECTED],
  [REJECTED]: [PROCESSING],
  [APPROVED]: []
}

/** The progress values this row may legally move to. */
export function nextProgressOptions (row) {
  return PROGRESS_TRANSITIONS[progressOf(row)] || []
}

/** Whether this row may move to `target` at all, permissions aside. */
export function canMoveTo (row, target) {
  const canonical = canonicalProgress(target)
  return !!canonical && nextProgressOptions(row).includes(canonical)
}

/** Approved is locked — editing it would rewrite what was approved. */
export function isEditable (row) {
  return !isApproved(row)
}

/** Whether this user may move this row to `target` right now. */
export function canTransitionTo (row, target) {
  const { allowed } = useResourceConfig(RESOURCE_NAME)
  return canMoveTo(row, target) && allowed('update')
}

/** Whether ANY progress transition is open to this user right now. */
export function canProgress (row) {
  return nextProgressOptions(row).some((target) => canTransitionTo(row, target))
}

/** Composable shape for setup-context callers. Same pure functions. */
export function useLeadProgress () {
  return {
    DRAFT,
    PROCESSING,
    LATER,
    REJECTED,
    APPROVED,
    OPEN,
    SETTLED,
    PROGRESS_ORDER,
    PROGRESS_COLORS,
    PROGRESS_ICONS,
    PROGRESS_STAMPS,
    PROGRESS_TRANSITIONS,
    canonicalProgress,
    stampPrefixFor,
    progressOf,
    isKnownProgress,
    progressBucket,
    isDraft,
    isProcessing,
    isApproved,
    isRejected,
    isLater,
    isOpen,
    isSettled,
    isEditable,
    progressColor,
    progressIcon,
    progressLabel,
    progressComment,
    progressBy,
    progressAt,
    nextProgressOptions,
    canMoveTo,
    canTransitionTo,
    canProgress
  }
}
