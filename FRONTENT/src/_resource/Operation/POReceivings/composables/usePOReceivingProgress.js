import { daysFromToday } from 'src/utils/dateHelpers'
import { sortByDate } from 'src/utils/sortHelpers'

export { sortByDate }

export const DRAFT = 'DRAFT'
export const CONFIRMED = 'CONFIRMED'
export const GRN_GENERATED = 'GRN_GENERATED'
export const CANCELLED = 'CANCELLED'

export const WORKFLOW_STATES = [DRAFT, CONFIRMED, GRN_GENERATED, CANCELLED]
export const TERMINAL_STATES = [GRN_GENERATED, CANCELLED]
export const IN_FLIGHT_STATES = WORKFLOW_STATES.filter((state) => !TERMINAL_STATES.includes(state))

export const PROGRESS_META = {
  [DRAFT]: { label: 'Draft', color: 'blue-grey', icon: 'edit_note' },
  [CONFIRMED]: { label: 'Confirmed', color: 'positive', icon: 'task_alt' },
  [GRN_GENERATED]: { label: 'GRN Generated', color: 'primary', icon: 'receipt_long' },
  [CANCELLED]: { label: 'Cancelled', color: 'negative', icon: 'cancel' }
}

// Line-level inspection outcomes, extending the one map so a card can show both.
export const LINE_CLEAN = 'CLEAN'
export const LINE_SHORT = 'SHORT'
export const LINE_EXCESS = 'EXCESS'
export const LINE_DAMAGED = 'DAMAGED'
export const LINE_REJECTED = 'REJECTED'
export const LINE_PENDING = 'PENDING'

export const LINE_ROW_META = {
  ...PROGRESS_META,
  [LINE_PENDING]: { label: 'Not Counted', color: 'grey-6', icon: 'pending' },
  [LINE_CLEAN]: { label: 'Clean', color: 'positive', icon: 'check_circle' },
  [LINE_SHORT]: { label: 'Short', color: 'warning', icon: 'remove_circle_outline' },
  [LINE_EXCESS]: { label: 'Excess', color: 'purple', icon: 'add_circle_outline' },
  [LINE_DAMAGED]: { label: 'Damaged', color: 'orange', icon: 'broken_image' },
  [LINE_REJECTED]: { label: 'Rejected', color: 'negative', icon: 'block' }
}

export const FALLBACK_META = { label: '—', color: 'grey-6', icon: 'help_outline' }

export const PROGRESS_COLORS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.color]))
export const PROGRESS_ICONS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.icon]))
export const PROGRESS_LABELS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.label]))

export const PROGRESS_STAMP_PREFIX = {
  [CONFIRMED]: 'ProgressConfirmed',
  [GRN_GENERATED]: 'ProgressGRNGenerated',
  [CANCELLED]: 'ProgressCancelled'
}

export const WORKFLOW_STAMPS = [
  { state: CONFIRMED, prefix: 'ProgressConfirmed', title: 'Inspection Confirmed' },
  { state: GRN_GENERATED, prefix: 'ProgressGRNGenerated', title: 'GRN Generated' },
  { state: CANCELLED, prefix: 'ProgressCancelled', title: 'Cancelled' }
]

export const SYSTEM_REPLACEMENT_REASON = 'System replacement: new receiving started for same PO'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function progressOf (row) {
  return text(row?.Progress).toUpperCase() || DRAFT
}

export function progressColor (state) {
  return PROGRESS_META[text(state).toUpperCase()]?.color || FALLBACK_META.color
}

export function progressIcon (state) {
  return PROGRESS_META[text(state).toUpperCase()]?.icon || FALLBACK_META.icon
}

export function progressLabel (state) {
  const raw = text(state).toUpperCase()
  return PROGRESS_META[raw]?.label || raw || FALLBACK_META.label
}

export function lineProgressColor (state) {
  return LINE_ROW_META[text(state).toUpperCase()]?.color || FALLBACK_META.color
}

export function lineProgressIcon (state) {
  return LINE_ROW_META[text(state).toUpperCase()]?.icon || FALLBACK_META.icon
}

export function lineProgressLabel (state) {
  const raw = text(state).toUpperCase()
  return LINE_ROW_META[raw]?.label || raw || FALLBACK_META.label
}

export function isDraft (row) { return progressOf(row) === DRAFT }
export function isConfirmed (row) { return progressOf(row) === CONFIRMED }
export function isGrnGenerated (row) { return progressOf(row) === GRN_GENERATED }
export function isCancelled (row) { return progressOf(row) === CANCELLED }
export function isTerminal (row) { return TERMINAL_STATES.includes(progressOf(row)) }

export function isActiveRow (row) {
  return text(asRow(row).Status || 'Active') === 'Active'
}

// Counts stay editable only while the inspection is still a draft.
export function isEditable (row) {
  return isDraft(row) && isActiveRow(row)
}

export function canConfirm (row) {
  return isDraft(row) && isActiveRow(row)
}

export function canGenerateGrn (row) {
  return isConfirmed(row) && isActiveRow(row)
}

export function canCancel (row) {
  return isActiveRow(row) && !isCancelled(row)
}

export function isOwnedBy (row, userId) {
  const me = text(userId)
  if (!me) return false
  return text(row?.CreatedBy) === me
}

export function isForeignDraft (row, userId) {
  return isDraft(row) && !isOwnedBy(row, userId)
}

export function countsForUser (row, userId) {
  return !!row && isActiveRow(row) && !isForeignDraft(row, userId)
}

export function stampOf (row, prefix) {
  const key = text(prefix)
  if (!key) return { at: '', by: '', comment: '' }
  return {
    at: text(row?.[`${key}At`]),
    by: text(row?.[`${key}By`]),
    comment: text(row?.[`${key}Comment`])
  }
}

export function settledAt (row) {
  const stamp = stampOf(row, PROGRESS_STAMP_PREFIX[progressOf(row)])
  return stamp.at || text(row?.InspectionDate) || row?.CreatedAt || ''
}

export function daysSince (stampValue) {
  return -daysFromToday(stampValue)
}

export function workflowStamps (record) {
  const row = asRow(record)
  return WORKFLOW_STAMPS
    .map((stamp) => {
      const at = text(row[`${stamp.prefix}At`])
      const parsed = at ? new Date(at) : null
      return {
        state: stamp.state,
        title: stamp.title,
        by: text(row[`${stamp.prefix}By`]),
        at,
        comment: text(row[`${stamp.prefix}Comment`]),
        icon: lineProgressIcon(stamp.state),
        color: lineProgressColor(stamp.state),
        label: lineProgressLabel(stamp.state),
        timestamp: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
      }
    })
    .filter((event) => event.by || event.at)
    .sort((a, b) => (a.timestamp?.getTime() ?? Infinity) - (b.timestamp?.getTime() ?? Infinity))
}

export const AGE_BANDS = [
  { label: '0–1 days', caption: 'On track', color: 'positive', max: 1 },
  { label: '2–3 days', caption: 'Watch', color: 'info', max: 3 },
  { label: '4–7 days', caption: 'Chase', color: 'warning', max: 7 },
  { label: '7+ days', caption: 'Overdue', color: 'negative', max: Infinity }
]

export function ageBandOf (days) {
  if (days === null || days === undefined || Number.isNaN(days)) return null
  return AGE_BANDS.find((band) => days <= band.max) || null
}

export function ageColor (days) {
  return ageBandOf(days)?.color || FALLBACK_META.color
}

export function usePOReceivingProgress () {
  return {
    DRAFT,
    CONFIRMED,
    GRN_GENERATED,
    CANCELLED,
    LINE_PENDING,
    LINE_CLEAN,
    LINE_SHORT,
    LINE_EXCESS,
    LINE_DAMAGED,
    LINE_REJECTED,
    WORKFLOW_STATES,
    TERMINAL_STATES,
    IN_FLIGHT_STATES,
    WORKFLOW_STAMPS,
    PROGRESS_META,
    LINE_ROW_META,
    PROGRESS_COLORS,
    PROGRESS_ICONS,
    PROGRESS_LABELS,
    PROGRESS_STAMP_PREFIX,
    SYSTEM_REPLACEMENT_REASON,
    AGE_BANDS,
    progressOf,
    progressColor,
    progressIcon,
    progressLabel,
    lineProgressColor,
    lineProgressIcon,
    lineProgressLabel,
    isDraft,
    isConfirmed,
    isGrnGenerated,
    isCancelled,
    isTerminal,
    isActiveRow,
    isEditable,
    canConfirm,
    canGenerateGrn,
    canCancel,
    isOwnedBy,
    isForeignDraft,
    countsForUser,
    stampOf,
    settledAt,
    daysSince,
    workflowStamps,
    ageBandOf,
    ageColor,
    sortByDate
  }
}
