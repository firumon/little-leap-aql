import { daysFromToday } from 'src/utils/dateHelpers'
import { sortByDate } from 'src/utils/sortHelpers'

export { sortByDate }

// The sheet stores these in Title Case (GAS/syncAppResources.gs DefaultValues).
export const DRAFT = 'Draft'
export const PENDING_APPROVAL = 'Pending Approval'
export const REVISION_REQUIRED = 'Revision Required'
export const APPROVED = 'Approved'
export const REJECTED = 'Rejected'
export const RFQ_PROCESSED = 'RFQ Processed'

export const WORKFLOW_STATES = [
  DRAFT,
  PENDING_APPROVAL,
  REVISION_REQUIRED,
  APPROVED,
  RFQ_PROCESSED,
  REJECTED
]

export const EDITABLE_STATES = [DRAFT, REVISION_REQUIRED]
export const TERMINAL_STATES = [RFQ_PROCESSED, REJECTED]
export const IN_FLIGHT_STATES = WORKFLOW_STATES.filter((state) => !TERMINAL_STATES.includes(state))

export const PROGRESS_META = {
  [DRAFT]: { label: 'Draft', color: 'grey-7', icon: 'edit_note' },
  [PENDING_APPROVAL]: { label: 'Pending Approval', color: 'warning', icon: 'schedule' },
  [REVISION_REQUIRED]: { label: 'Revision Required', color: 'orange', icon: 'undo' },
  [APPROVED]: { label: 'Approved', color: 'primary', icon: 'check_circle' },
  [RFQ_PROCESSED]: { label: 'RFQ Processed', color: 'positive', icon: 'request_quote' },
  [REJECTED]: { label: 'Rejected', color: 'negative', icon: 'cancel' }
}

export const FALLBACK_META = { label: '—', color: 'grey-6', icon: 'help_outline' }

export const PROGRESS_COLORS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.color]))
export const PROGRESS_ICONS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.icon]))
export const PROGRESS_LABELS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.label]))

// Requisition TYPE and PRIORITY are part of the requisition's own vocabulary, so their
// icon and colour live here beside the progress map rather than in a UI file.
export const TYPE_META = {
  STOCK: { label: 'Stock', icon: 'inventory_2', color: 'primary' },
  PROJECT: { label: 'Project', icon: 'architecture', color: 'info' },
  SALES: { label: 'Sales', icon: 'storefront', color: 'positive' },
  ASSET: { label: 'Asset', icon: 'build_circle', color: 'warning' }
}

export const PRIORITY_META = {
  Low: { label: 'Low', icon: 'arrow_downward', color: 'positive' },
  Medium: { label: 'Medium', icon: 'remove', color: 'warning' },
  High: { label: 'High', icon: 'arrow_upward', color: 'negative' },
  Urgent: { label: 'Urgent', icon: 'priority_high', color: 'purple' }
}

// A PROJECT or SALES requisition must name the job it is buying for.
export const TYPES_NEEDING_REFERENCE = ['PROJECT', 'SALES']

export const PROGRESS_STAMP_PREFIX = {
  [REVISION_REQUIRED]: 'ProgressRevisionRequired',
  [APPROVED]: 'ProgressApproved',
  [REJECTED]: 'ProgressRejected'
}

export const WORKFLOW_STAMPS = [
  { state: REVISION_REQUIRED, prefix: 'ProgressRevisionRequired', title: 'Sent Back for Revision' },
  { state: APPROVED, prefix: 'ProgressApproved', title: 'Approved' },
  { state: REJECTED, prefix: 'ProgressRejected', title: 'Rejected' }
]

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})

// Sheet values are Title Case; a row written by an older path may not be.
export function progressOf (row) {
  const raw = text(row?.Progress)
  const match = WORKFLOW_STATES.find((state) => state.toUpperCase() === raw.toUpperCase())
  return match || raw
}

export function progressColor (state) {
  return PROGRESS_META[progressOf({ Progress: state })]?.color || FALLBACK_META.color
}

export function progressIcon (state) {
  return PROGRESS_META[progressOf({ Progress: state })]?.icon || FALLBACK_META.icon
}

export function progressLabel (state) {
  const normalized = progressOf({ Progress: state })
  return PROGRESS_META[normalized]?.label || normalized || FALLBACK_META.label
}

export function typeMeta (value) {
  return TYPE_META[text(value).toUpperCase()] || { label: text(value), icon: 'category', color: 'grey-7' }
}

export function priorityMeta (value) {
  return PRIORITY_META[text(value)] || { label: text(value), icon: 'remove', color: 'grey-7' }
}

export function needsTypeReference (type) {
  return TYPES_NEEDING_REFERENCE.includes(text(type).toUpperCase())
}

export function isActiveRow (row) {
  return text(asRow(row).Status || 'Active') === 'Active'
}

export function isDraft (row) { return progressOf(row) === DRAFT }
export function isPendingApproval (row) { return progressOf(row) === PENDING_APPROVAL }
export function isRevisionRequired (row) { return progressOf(row) === REVISION_REQUIRED }
export function isApproved (row) { return progressOf(row) === APPROVED }
export function isRejected (row) { return progressOf(row) === REJECTED }
export function isRfqProcessed (row) { return progressOf(row) === RFQ_PROCESSED }
export function isTerminal (row) { return TERMINAL_STATES.includes(progressOf(row)) }

// Takes a PROGRESS VALUE, not a row — the FAB gate and the edit form both call it that way.
export function requisitionEditableProgress (progress) {
  return EDITABLE_STATES.includes(progressOf({ Progress: progress }))
}

export function isEditable (row) {
  return requisitionEditableProgress(row?.Progress)
}

// Approved and still active — the requisition is available to source an RFQ from.
export function isRfqEligible (row) {
  return isApproved(row) && isActiveRow(row)
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

// Pending Approval writes no stamp of its own, so a pending row ages from the day it
// was raised rather than sinking to the end of an age-sorted queue.
export function settledAt (row) {
  const stamp = stampOf(row, PROGRESS_STAMP_PREFIX[progressOf(row)])
  return stamp.at || text(row?.PRDate) || text(row?.RequiredDate) || row?.CreatedAt || ''
}

export function daysSince (stampValue) {
  return -daysFromToday(stampValue)
}

export function daysToRequired (row) {
  return daysFromToday(text(row?.RequiredDate))
}

export function isOverdue (row) {
  const days = daysToRequired(row)
  return Number.isFinite(days) && days < 0 && !isTerminal(row)
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
        icon: progressIcon(stamp.state),
        color: progressColor(stamp.state),
        label: progressLabel(stamp.state),
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

export function usePurchaseRequisitionProgress () {
  return {
    DRAFT,
    PENDING_APPROVAL,
    REVISION_REQUIRED,
    APPROVED,
    REJECTED,
    RFQ_PROCESSED,
    WORKFLOW_STATES,
    EDITABLE_STATES,
    TERMINAL_STATES,
    IN_FLIGHT_STATES,
    WORKFLOW_STAMPS,
    PROGRESS_META,
    PROGRESS_COLORS,
    PROGRESS_ICONS,
    PROGRESS_LABELS,
    PROGRESS_STAMP_PREFIX,
    TYPE_META,
    PRIORITY_META,
    AGE_BANDS,
    progressOf,
    progressColor,
    progressIcon,
    progressLabel,
    typeMeta,
    priorityMeta,
    needsTypeReference,
    isDraft,
    isPendingApproval,
    isRevisionRequired,
    isApproved,
    isRejected,
    isRfqProcessed,
    isTerminal,
    isEditable,
    isRfqEligible,
    requisitionEditableProgress,
    isActiveRow,
    isOwnedBy,
    isForeignDraft,
    countsForUser,
    stampOf,
    settledAt,
    daysSince,
    daysToRequired,
    isOverdue,
    workflowStamps,
    ageBandOf,
    ageColor,
    sortByDate
  }
}
