import { daysFromToday } from 'src/utils/dateHelpers'
import { sortByDate } from 'src/utils/sortHelpers'

export { sortByDate }

// The states the sheet actually writes (GAS/syncAppResources.gs AdditionalActions).
export const CREATED = 'CREATED'
export const SENT = 'SENT'
export const ACKNOWLEDGED = 'ACKNOWLEDGED'
export const ACCEPTED = 'ACCEPTED'
export const CANCELLED = 'CANCELLED'
export const CLOSED = 'CLOSED'

// Fulfilment states a PO reaches through the receiving side of the workflow.
export const DRAFT = 'DRAFT'
export const PO_ISSUED = 'PO_ISSUED'
export const GOODS_RECEIVING = 'GOODS_RECEIVING'
export const GRN_GENERATED = 'GRN_GENERATED'
export const COMPLETED = 'COMPLETED'

export const WORKFLOW_STATES = [
  CREATED,
  SENT,
  ACKNOWLEDGED,
  ACCEPTED,
  GOODS_RECEIVING,
  GRN_GENERATED,
  CLOSED,
  COMPLETED,
  CANCELLED
]

export const TERMINAL_STATES = [CLOSED, COMPLETED, CANCELLED]
export const IN_FLIGHT_STATES = WORKFLOW_STATES.filter((state) => !TERMINAL_STATES.includes(state))

// A PO in one of these still owes goods, so it is what a receiving may be opened against.
export const RECEIVABLE_STATES = [ACCEPTED, ACKNOWLEDGED, SENT, PO_ISSUED, GOODS_RECEIVING]

export const CANCELLABLE_STATES = [CREATED, SENT, ACKNOWLEDGED, DRAFT, PO_ISSUED]

export const PROGRESS_META = {
  [DRAFT]: { label: 'Draft', color: 'grey-7', icon: 'edit_note' },
  [CREATED]: { label: 'Created', color: 'blue-grey', icon: 'note_add' },
  [SENT]: { label: 'Sent', color: 'primary', icon: 'send' },
  [ACKNOWLEDGED]: { label: 'Acknowledged', color: 'info', icon: 'done' },
  [ACCEPTED]: { label: 'Accepted', color: 'teal', icon: 'check_circle' },
  [PO_ISSUED]: { label: 'PO Issued', color: 'purple', icon: 'receipt_long' },
  [GOODS_RECEIVING]: { label: 'Goods Receiving', color: 'orange', icon: 'inventory_2' },
  [GRN_GENERATED]: { label: 'GRN Generated', color: 'deep-purple', icon: 'fact_check' },
  [COMPLETED]: { label: 'Completed', color: 'positive', icon: 'task_alt' },
  [CLOSED]: { label: 'Closed', color: 'grey-7', icon: 'archive' },
  [CANCELLED]: { label: 'Cancelled', color: 'negative', icon: 'cancel' }
}

// Line-level fulfilment states, extending the one map so a PO card can show both.
export const LINE_PENDING = 'PENDING'
export const LINE_PARTIAL = 'PARTIAL'
export const LINE_FULFILLED = 'FULFILLED'
export const LINE_EXCESS = 'EXCESS'

export const LINE_ROW_META = {
  ...PROGRESS_META,
  [LINE_PENDING]: { label: 'Pending', color: 'warning', icon: 'schedule' },
  [LINE_PARTIAL]: { label: 'Partial', color: 'info', icon: 'rule' },
  [LINE_FULFILLED]: { label: 'Fulfilled', color: 'positive', icon: 'inventory' },
  [LINE_EXCESS]: { label: 'Over-received', color: 'purple', icon: 'add_circle_outline' }
}

export const FALLBACK_META = { label: '—', color: 'grey-6', icon: 'help_outline' }

export const PROGRESS_COLORS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.color]))
export const PROGRESS_ICONS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.icon]))
export const PROGRESS_LABELS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.label]))

export const EXTRA_CHARGE_KEYS = ['tax', 'freight', 'commission', 'handling', 'other']

export const EXTRA_CHARGE_LABELS = {
  tax: 'Tax',
  freight: 'Freight',
  commission: 'Commission',
  handling: 'Handling',
  other: 'Other'
}

export const PROGRESS_STAMP_PREFIX = {
  [SENT]: 'ProgressSent',
  [ACKNOWLEDGED]: 'ProgressAcknowledged',
  [ACCEPTED]: 'ProgressAccepted',
  [CANCELLED]: 'ProgressCancelled'
}

export const WORKFLOW_STAMPS = [
  { state: SENT, prefix: 'ProgressSent', title: 'Sent to Supplier' },
  { state: ACKNOWLEDGED, prefix: 'ProgressAcknowledged', title: 'Acknowledged' },
  { state: ACCEPTED, prefix: 'ProgressAccepted', title: 'Accepted' },
  { state: CANCELLED, prefix: 'ProgressCancelled', title: 'Cancelled' }
]

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function progressOf (row) {
  return text(row?.Progress).toUpperCase() || CREATED
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

export function chargeLabel (key) {
  return EXTRA_CHARGE_LABELS[text(key)] || text(key)
}

export function isCancelled (row) { return progressOf(row) === CANCELLED }
export function isClosed (row) { return progressOf(row) === CLOSED }
export function isCompleted (row) { return progressOf(row) === COMPLETED }
export function isTerminal (row) { return TERMINAL_STATES.includes(progressOf(row)) }

export function isActiveRow (row) {
  return text(asRow(row).Status || 'Active') === 'Active'
}

// A cancelled PO gives its quantity back to the quotation; every other active PO holds it.
export function consumesQuotationQuantity (row) {
  return isActiveRow(row) && !isCancelled(row)
}

export function canReceive (row) {
  return isActiveRow(row) && RECEIVABLE_STATES.includes(progressOf(row))
}

export function canCancel (row) {
  return isActiveRow(row) && CANCELLABLE_STATES.includes(progressOf(row))
}

export function isOwnedBy (row, userId) {
  const me = text(userId)
  if (!me) return false
  return text(row?.CreatedBy) === me
}

export function countsForUser (row) {
  return !!row && isActiveRow(row)
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
  return stamp.at || text(row?.PODate) || row?.CreatedAt || ''
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
  { label: '0–7 days', caption: 'On track', color: 'positive', max: 7 },
  { label: '8–14 days', caption: 'Watch', color: 'info', max: 14 },
  { label: '15–30 days', caption: 'Chase', color: 'warning', max: 30 },
  { label: '30+ days', caption: 'Overdue', color: 'negative', max: Infinity }
]

export function ageBandOf (days) {
  if (days === null || days === undefined || Number.isNaN(days)) return null
  return AGE_BANDS.find((band) => days <= band.max) || null
}

export function ageColor (days) {
  return ageBandOf(days)?.color || FALLBACK_META.color
}

export function usePurchaseOrderProgress () {
  return {
    DRAFT,
    CREATED,
    SENT,
    ACKNOWLEDGED,
    ACCEPTED,
    PO_ISSUED,
    GOODS_RECEIVING,
    GRN_GENERATED,
    COMPLETED,
    CLOSED,
    CANCELLED,
    LINE_PENDING,
    LINE_PARTIAL,
    LINE_FULFILLED,
    LINE_EXCESS,
    WORKFLOW_STATES,
    TERMINAL_STATES,
    IN_FLIGHT_STATES,
    RECEIVABLE_STATES,
    CANCELLABLE_STATES,
    WORKFLOW_STAMPS,
    PROGRESS_META,
    LINE_ROW_META,
    PROGRESS_COLORS,
    PROGRESS_ICONS,
    PROGRESS_LABELS,
    PROGRESS_STAMP_PREFIX,
    EXTRA_CHARGE_KEYS,
    EXTRA_CHARGE_LABELS,
    AGE_BANDS,
    progressOf,
    progressColor,
    progressIcon,
    progressLabel,
    lineProgressColor,
    lineProgressIcon,
    lineProgressLabel,
    chargeLabel,
    isCancelled,
    isClosed,
    isCompleted,
    isTerminal,
    isActiveRow,
    consumesQuotationQuantity,
    canReceive,
    canCancel,
    isOwnedBy,
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
