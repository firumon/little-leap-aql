import { daysFromToday } from 'src/utils/dateHelpers'
import { sortByDate } from 'src/utils/sortHelpers'

export { sortByDate }

export const INITIATED = 'INITIATED'
export const PR_CREATED = 'PR_CREATED'
export const PR_APPROVED = 'PR_APPROVED'
export const RFQ_GENERATED = 'RFQ_GENERATED'
export const RFQ_SENT_TO_SUPPLIERS = 'RFQ_SENT_TO_SUPPLIERS'
export const QUOTATIONS_RECEIVED = 'QUOTATIONS_RECEIVED'
export const PO_ISSUED = 'PO_ISSUED'
export const GOODS_RECEIVING = 'GOODS_RECEIVING'
export const GRN_GENERATED = 'GRN_GENERATED'
export const COMPLETED = 'COMPLETED'
export const CANCELLED = 'CANCELLED'

export const WORKFLOW_STATES = [
  INITIATED,
  PR_CREATED,
  PR_APPROVED,
  RFQ_GENERATED,
  RFQ_SENT_TO_SUPPLIERS,
  QUOTATIONS_RECEIVED,
  PO_ISSUED,
  GOODS_RECEIVING,
  GRN_GENERATED,
  COMPLETED,
  CANCELLED
]

export const TERMINAL_STATES = [COMPLETED, CANCELLED]
export const IN_FLIGHT_STATES = WORKFLOW_STATES.filter((state) => !TERMINAL_STATES.includes(state))

export const PROGRESS_META = {
  [INITIATED]: { label: 'Initiated', color: 'grey-7', icon: 'flag' },
  [PR_CREATED]: { label: 'PR Created', color: 'blue-grey', icon: 'edit_note' },
  [PR_APPROVED]: { label: 'PR Approved', color: 'primary', icon: 'check_circle' },
  [RFQ_GENERATED]: { label: 'RFQ Generated', color: 'indigo', icon: 'request_quote' },
  [RFQ_SENT_TO_SUPPLIERS]: { label: 'RFQ Sent', color: 'info', icon: 'send' },
  [QUOTATIONS_RECEIVED]: { label: 'Quotations Received', color: 'teal', icon: 'mark_email_read' },
  [PO_ISSUED]: { label: 'PO Issued', color: 'purple', icon: 'receipt_long' },
  [GOODS_RECEIVING]: { label: 'Goods Receiving', color: 'orange', icon: 'inventory_2' },
  [GRN_GENERATED]: { label: 'GRN Generated', color: 'deep-purple', icon: 'fact_check' },
  [COMPLETED]: { label: 'Completed', color: 'positive', icon: 'task_alt' },
  [CANCELLED]: { label: 'Cancelled', color: 'negative', icon: 'block' }
}

export const FALLBACK_META = { label: '—', color: 'grey-6', icon: 'help_outline' }

export const PROGRESS_COLORS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.color]))
export const PROGRESS_ICONS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.icon]))
export const PROGRESS_LABELS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.label]))

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function progressOf (row) {
  return text(row?.Progress).toUpperCase()
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

export function isTerminal (row) {
  return TERMINAL_STATES.includes(progressOf(row))
}

export function isCancelled (row) {
  return progressOf(row) === CANCELLED
}

export function isCompleted (row) {
  return progressOf(row) === COMPLETED
}

/** Position of a state in the lifecycle. -1 when unknown. */
export function stageIndexOf (state) {
  return WORKFLOW_STATES.indexOf(text(state).toUpperCase())
}

/**
 * A procurement never walks backwards on its own. A transition is allowed only when
 * the target sits later in the lifecycle, and never out of a terminal state.
 */
export function canAdvanceTo (row, nextState) {
  const current = progressOf(row)
  const next = text(nextState).toUpperCase()
  if (!next || !current) return false
  if (TERMINAL_STATES.includes(current)) return false
  if (current === next) return false
  return stageIndexOf(next) > stageIndexOf(current)
}

export function isActiveRow (row) {
  return text(asRow(row).Status || 'Active') === 'Active'
}

export function isOwnedBy (row, userId) {
  const me = text(userId)
  if (!me) return false
  return text(row?.CreatedBy) === me
}

export function countsForUser (row, userId) {
  return !!row && isActiveRow(row) && !isTerminal(row) && (!userId || true)
}

export function settledAt (row) {
  return text(row?.InitiatedDate) || text(row?.UpdatedAt) || text(row?.CreatedAt) || ''
}

export function daysSince (stampValue) {
  return -daysFromToday(stampValue)
}

export const AGE_BANDS = [
  { label: '0–3 days', caption: 'On track', color: 'positive', max: 3 },
  { label: '4–7 days', caption: 'Watch', color: 'info', max: 7 },
  { label: '8–14 days', caption: 'Chase', color: 'warning', max: 14 },
  { label: '14+ days', caption: 'Stalled', color: 'negative', max: Infinity }
]

export function ageBandOf (days) {
  if (days === null || days === undefined || Number.isNaN(days)) return null
  return AGE_BANDS.find((band) => days <= band.max) || null
}

export function ageColor (days) {
  return ageBandOf(days)?.color || FALLBACK_META.color
}

export function useProcurementProgress () {
  return {
    INITIATED,
    PR_CREATED,
    PR_APPROVED,
    RFQ_GENERATED,
    RFQ_SENT_TO_SUPPLIERS,
    QUOTATIONS_RECEIVED,
    PO_ISSUED,
    GOODS_RECEIVING,
    GRN_GENERATED,
    COMPLETED,
    CANCELLED,
    WORKFLOW_STATES,
    TERMINAL_STATES,
    IN_FLIGHT_STATES,
    PROGRESS_META,
    PROGRESS_COLORS,
    PROGRESS_ICONS,
    PROGRESS_LABELS,
    AGE_BANDS,
    progressOf,
    progressColor,
    progressIcon,
    progressLabel,
    isTerminal,
    isCancelled,
    isCompleted,
    stageIndexOf,
    canAdvanceTo,
    isActiveRow,
    isOwnedBy,
    countsForUser,
    settledAt,
    daysSince,
    ageBandOf,
    ageColor,
    sortByDate
  }
}
