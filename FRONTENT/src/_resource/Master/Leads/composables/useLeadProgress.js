// Leads workflow vocabulary and state gates.
// Progress is stored Title Case here, not upper case like the outlet sheets.
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'

const RESOURCE_NAME = 'Leads'

export const DRAFT = 'Draft'
export const PROCESSING = 'Processing'
export const LATER = 'Later'
export const REJECTED = 'Rejected'
export const APPROVED = 'Approved'

export const PROGRESS_ORDER = [DRAFT, PROCESSING, LATER, REJECTED, APPROVED, 'OTHER']
export const SETTLED = [LATER, REJECTED, APPROVED]
export const SLEEPING = [LATER]
export const CLOSED = [REJECTED, APPROVED]
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

export function stampPrefixFor (progress) {
  const canonical = canonicalProgress(progress)
  return PROGRESS_STAMPS[canonical] ? `Progress${canonical}` : ''
}

export function canonicalProgress (value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return ''
  return PROGRESS_ORDER.find((known) => known.toLowerCase() === raw) || ''
}

export function progressOf (row) {
  return canonicalProgress(row?.Progress)
}

export function isKnownProgress (row) {
  return !!progressOf(row)
}

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

export function isOpen (row) {
  return OPEN.includes(progressOf(row))
}

export function isSettled (row) {
  return SETTLED.includes(progressOf(row))
}

export function isSleeping (row) {
  return SLEEPING.includes(progressOf(row))
}

export function isClosed (row) {
  return CLOSED.includes(progressOf(row))
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

export function progressComment (row) {
  const stamp = PROGRESS_STAMPS[progressOf(row)]
  return (stamp && row?.[stamp.comment]) || ''
}

export function progressBy (row) {
  const stamp = PROGRESS_STAMPS[progressOf(row)]
  return (stamp && row?.[stamp.by]) || ''
}

export function progressAt (row) {
  const stamp = PROGRESS_STAMPS[progressOf(row)]
  return (stamp && row?.[stamp.at]) || ''
}

// Approved is terminal; a later conversion reads its stamp. Later and Rejected reopen.
export const PROGRESS_TRANSITIONS = {
  [DRAFT]: [PROCESSING, LATER, REJECTED],
  [PROCESSING]: [LATER, REJECTED, APPROVED],
  [LATER]: [PROCESSING, REJECTED],
  [REJECTED]: [PROCESSING],
  [APPROVED]: []
}

export function nextProgressOptions (row) {
  return PROGRESS_TRANSITIONS[progressOf(row)] || []
}

export function canMoveTo (row, target) {
  const canonical = canonicalProgress(target)
  return !!canonical && nextProgressOptions(row).includes(canonical)
}

export function isEditable (row) {
  return !isApproved(row)
}

export function canTransitionTo (row, target) {
  const { allowed } = useResourceConfig(RESOURCE_NAME)
  return canMoveTo(row, target) && allowed('update')
}

export function canProgress (row) {
  return nextProgressOptions(row).some((target) => canTransitionTo(row, target))
}

export function useLeadProgress () {
  return {
    DRAFT,
    PROCESSING,
    LATER,
    REJECTED,
    APPROVED,
    OPEN,
    SETTLED,
    SLEEPING,
    CLOSED,
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
    isSleeping,
    isClosed,
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
