import { daysFromToday } from 'src/utils/dateHelpers'
import { sortByDate } from 'src/utils/sortHelpers'

export { sortByDate }

// A GRN is immutable once written. Its only state is whether it still stands.
export const ACTIVE = 'Active'
export const INACTIVE = 'Inactive'

export const WORKFLOW_STATES = [ACTIVE, INACTIVE]
export const TERMINAL_STATES = [INACTIVE]
export const IN_FLIGHT_STATES = [ACTIVE]

export const PROGRESS_META = {
  [ACTIVE]: { label: 'Valid', color: 'positive', icon: 'fact_check' },
  [INACTIVE]: { label: 'Invalidated', color: 'negative', icon: 'block' }
}

export const FALLBACK_META = { label: '—', color: 'grey-6', icon: 'help_outline' }

export const PROGRESS_COLORS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.color]))
export const PROGRESS_ICONS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.icon]))
export const PROGRESS_LABELS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.label]))

export const WORKFLOW_STAMPS = [
  { state: INACTIVE, prefix: 'StatusInactive', title: 'Invalidated' }
]

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})

export function statusOf (row) {
  return text(asRow(row).Status) || ACTIVE
}

export function progressOf (row) {
  return statusOf(row)
}

export function progressColor (state) {
  return PROGRESS_META[text(state) || ACTIVE]?.color || FALLBACK_META.color
}

export function progressIcon (state) {
  return PROGRESS_META[text(state) || ACTIVE]?.icon || FALLBACK_META.icon
}

export function progressLabel (state) {
  const raw = text(state) || ACTIVE
  return PROGRESS_META[raw]?.label || raw || FALLBACK_META.label
}

export function isActiveRow (row) { return statusOf(row) === ACTIVE }
export function isInvalidated (row) { return statusOf(row) === INACTIVE }
export function isTerminal (row) { return isInvalidated(row) }

// A standing GRN can be pulled back; an already invalid one cannot.
export function canInvalidate (row) {
  return isActiveRow(row)
}

export function isOwnedBy (row, userId) {
  const me = text(userId)
  if (!me) return false
  return text(row?.CreatedBy) === me
}

export function countsForUser (row) {
  return !!row
}

export function settledAt (row) {
  return text(asRow(row).Date) || text(asRow(row).UpdatedAt) || text(asRow(row).CreatedAt) || ''
}

export function daysSince (stampValue) {
  return -daysFromToday(stampValue)
}

export function workflowStamps (record) {
  const row = asRow(record)
  const events = []
  const created = text(row.CreatedAt) || text(row.Date)
  if (created) {
    const parsed = new Date(created)
    events.push({
      state: ACTIVE,
      title: 'Goods Receipt Generated',
      by: text(row.CreatedBy),
      at: created,
      comment: '',
      icon: progressIcon(ACTIVE),
      color: progressColor(ACTIVE),
      label: progressLabel(ACTIVE),
      timestamp: Number.isNaN(parsed.getTime()) ? null : parsed
    })
  }
  if (isInvalidated(row)) {
    const at = text(row.UpdatedAt)
    const parsed = at ? new Date(at) : null
    events.push({
      state: INACTIVE,
      title: 'Invalidated',
      by: text(row.UpdatedBy),
      at,
      comment: '',
      icon: progressIcon(INACTIVE),
      color: progressColor(INACTIVE),
      label: progressLabel(INACTIVE),
      timestamp: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
    })
  }
  return events.sort((a, b) => (a.timestamp?.getTime() ?? Infinity) - (b.timestamp?.getTime() ?? Infinity))
}

export const AGE_BANDS = [
  { label: '0–7 days', caption: 'Recent', color: 'positive', max: 7 },
  { label: '8–30 days', caption: 'This month', color: 'info', max: 30 },
  { label: '31–90 days', caption: 'This quarter', color: 'warning', max: 90 },
  { label: '90+ days', caption: 'Older', color: 'grey-7', max: Infinity }
]

export function ageBandOf (days) {
  if (days === null || days === undefined || Number.isNaN(days)) return null
  return AGE_BANDS.find((band) => days <= band.max) || null
}

export function ageColor (days) {
  return ageBandOf(days)?.color || FALLBACK_META.color
}

export function useGoodsReceiptProgress () {
  return {
    ACTIVE,
    INACTIVE,
    WORKFLOW_STATES,
    TERMINAL_STATES,
    IN_FLIGHT_STATES,
    WORKFLOW_STAMPS,
    PROGRESS_META,
    PROGRESS_COLORS,
    PROGRESS_ICONS,
    PROGRESS_LABELS,
    AGE_BANDS,
    statusOf,
    progressOf,
    progressColor,
    progressIcon,
    progressLabel,
    isActiveRow,
    isInvalidated,
    isTerminal,
    canInvalidate,
    isOwnedBy,
    countsForUser,
    settledAt,
    daysSince,
    workflowStamps,
    ageBandOf,
    ageColor,
    sortByDate
  }
}
