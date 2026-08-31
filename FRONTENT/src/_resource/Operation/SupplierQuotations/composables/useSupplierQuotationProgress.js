import { daysFromToday } from 'src/utils/dateHelpers'
import { sortByDate } from 'src/utils/sortHelpers'

export { sortByDate }

export const RECEIVED = 'RECEIVED'
export const ACCEPTED = 'ACCEPTED'
export const REJECTED = 'REJECTED'

export const WORKFLOW_STATES = [RECEIVED, ACCEPTED, REJECTED]
export const TERMINAL_STATES = [ACCEPTED, REJECTED]
export const IN_FLIGHT_STATES = WORKFLOW_STATES.filter((state) => !TERMINAL_STATES.includes(state))

// How the supplier answered, independent of where the quotation sits in our workflow.
export const QUOTED = 'QUOTED'
export const PARTIAL = 'PARTIAL'
export const DECLINED = 'DECLINED'

export const RESPONSE_TYPES = [QUOTED, PARTIAL, DECLINED]

export const PROGRESS_META = {
  [RECEIVED]: { label: 'Received', color: 'teal', icon: 'mark_email_read' },
  [ACCEPTED]: { label: 'Accepted', color: 'positive', icon: 'verified' },
  [REJECTED]: { label: 'Rejected', color: 'negative', icon: 'block' }
}

// The workflow vocabulary plus the response types, so a card showing both reads one map.
export const RESPONSE_META = {
  ...PROGRESS_META,
  [QUOTED]: { label: 'Quoted', color: 'primary', icon: 'price_check' },
  [PARTIAL]: { label: 'Partial', color: 'warning', icon: 'rule' },
  [DECLINED]: { label: 'Declined', color: 'negative', icon: 'do_not_disturb' }
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
  [REJECTED]: 'ProgressRejected'
}

export const WORKFLOW_STAMPS = [
  { state: REJECTED, prefix: 'ProgressRejected', title: 'Rejected' }
]

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function progressOf (row) {
  return text(row?.Progress).toUpperCase() || RECEIVED
}

export function responseTypeOf (row) {
  return text(row?.ResponseType).toUpperCase()
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

export function responseColor (state) {
  return RESPONSE_META[text(state).toUpperCase()]?.color || FALLBACK_META.color
}

export function responseIcon (state) {
  return RESPONSE_META[text(state).toUpperCase()]?.icon || FALLBACK_META.icon
}

export function responseLabel (state) {
  const raw = text(state).toUpperCase()
  return RESPONSE_META[raw]?.label || raw || FALLBACK_META.label
}

export function chargeLabel (key) {
  return EXTRA_CHARGE_LABELS[text(key)] || text(key)
}

export function isReceived (row) { return progressOf(row) === RECEIVED }
export function isAccepted (row) { return progressOf(row) === ACCEPTED }
export function isRejected (row) { return progressOf(row) === REJECTED }
export function isTerminal (row) { return TERMINAL_STATES.includes(progressOf(row)) }

export function isDeclined (row) { return responseTypeOf(row) === DECLINED }
export function isPartial (row) { return responseTypeOf(row) === PARTIAL }
export function isFullyQuoted (row) { return responseTypeOf(row) === QUOTED }

export function isActiveRow (row) {
  return text(asRow(row).Status || 'Active') === 'Active'
}

// A quotation is editable while nobody has acted on it and it was not declined.
export function isEditable (row) {
  return isReceived(row) && isActiveRow(row)
}

export function canReject (row) {
  return isReceived(row) && isActiveRow(row)
}

// Only a live, non-declined quotation can be turned into a purchase order.
export function isPoEligible (row) {
  return isActiveRow(row) && !isRejected(row) && !isDeclined(row)
}

export function allowsPartialPo (row) {
  const raw = text(asRow(row).AllowPartialPO).toUpperCase()
  if (!raw) return true
  return ['TRUE', 'YES', '1'].includes(raw)
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
  return stamp.at || text(row?.ResponseDate) || text(row?.ResponseRecordedAt) || row?.CreatedAt || ''
}

export function daysSince (stampValue) {
  return -daysFromToday(stampValue)
}

// Days left on the quotation's own validity. Negative once expired.
export function daysToExpiry (row) {
  return daysFromToday(text(row?.ValidUntilDate))
}

export function isExpired (row) {
  const days = daysToExpiry(row)
  return Number.isFinite(days) && days < 0 && !isTerminal(row)
}

export function workflowStamps (record) {
  const row = asRow(record)
  const events = WORKFLOW_STAMPS
    .map((stamp) => {
      const at = text(row[`${stamp.prefix}At`])
      const parsed = at ? new Date(at) : null
      return {
        state: stamp.state,
        title: stamp.title,
        by: text(row[`${stamp.prefix}By`]),
        at,
        comment: text(row[`${stamp.prefix}Comment`]),
        icon: responseIcon(stamp.state),
        color: responseColor(stamp.state),
        label: responseLabel(stamp.state),
        timestamp: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
      }
    })
    .filter((event) => event.by || event.at)

  const recordedAt = text(row.ResponseRecordedAt)
  if (recordedAt) {
    const parsed = new Date(Number(recordedAt) || recordedAt)
    events.unshift({
      state: RECEIVED,
      title: 'Response Recorded',
      by: text(row.ResponseRecordedBy),
      at: recordedAt,
      comment: '',
      icon: responseIcon(RECEIVED),
      color: responseColor(RECEIVED),
      label: responseLabel(RECEIVED),
      timestamp: Number.isNaN(parsed.getTime()) ? null : parsed
    })
  }

  return events.sort((a, b) => (a.timestamp?.getTime() ?? Infinity) - (b.timestamp?.getTime() ?? Infinity))
}

export const AGE_BANDS = [
  { label: '0–2 days', caption: 'On track', color: 'positive', max: 2 },
  { label: '3–5 days', caption: 'Watch', color: 'info', max: 5 },
  { label: '6–10 days', caption: 'Chase', color: 'warning', max: 10 },
  { label: '10+ days', caption: 'Stale', color: 'negative', max: Infinity }
]

export function ageBandOf (days) {
  if (days === null || days === undefined || Number.isNaN(days)) return null
  return AGE_BANDS.find((band) => days <= band.max) || null
}

export function ageColor (days) {
  return ageBandOf(days)?.color || FALLBACK_META.color
}

export function useSupplierQuotationProgress () {
  return {
    RECEIVED,
    ACCEPTED,
    REJECTED,
    QUOTED,
    PARTIAL,
    DECLINED,
    RESPONSE_TYPES,
    WORKFLOW_STATES,
    TERMINAL_STATES,
    IN_FLIGHT_STATES,
    WORKFLOW_STAMPS,
    PROGRESS_META,
    RESPONSE_META,
    PROGRESS_COLORS,
    PROGRESS_ICONS,
    PROGRESS_LABELS,
    PROGRESS_STAMP_PREFIX,
    EXTRA_CHARGE_KEYS,
    EXTRA_CHARGE_LABELS,
    AGE_BANDS,
    progressOf,
    responseTypeOf,
    progressColor,
    progressIcon,
    progressLabel,
    responseColor,
    responseIcon,
    responseLabel,
    chargeLabel,
    isReceived,
    isAccepted,
    isRejected,
    isTerminal,
    isDeclined,
    isPartial,
    isFullyQuoted,
    isActiveRow,
    isEditable,
    canReject,
    isPoEligible,
    allowsPartialPo,
    isOwnedBy,
    countsForUser,
    stampOf,
    settledAt,
    daysSince,
    daysToExpiry,
    isExpired,
    workflowStamps,
    ageBandOf,
    ageColor,
    sortByDate
  }
}
