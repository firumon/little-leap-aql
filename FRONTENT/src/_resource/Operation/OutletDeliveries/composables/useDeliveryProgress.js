// The one source of truth for a manifest's state and what may be done to it.
// Line-item words belong to `OutletRestocks` and are imported, never restated.

import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { daysFromToday } from 'src/utils/dateHelpers'
import { sortByDate } from 'src/utils/sortHelpers'
// Aliased on the way in: on the restock side `DELIVERED` is a REQUEST state that shares its
// spelling with the item state.
import {
  ITEM_ALLOCATED,
  DELIVERED as ITEM_DELIVERED
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'

export { ITEM_ALLOCATED, ITEM_DELIVERED }

// Re-exported so a consumer that already imports this file for the workflow vocabulary
// does not need a second import line to sort the rows it just filtered.
export { sortByDate }

// ─── Workflow states ──────────────────────────────────────────────────────────

export const DRAFT = 'DRAFT'
export const IN_TRANSIT = 'IN_TRANSIT'
export const COMPLETED = 'COMPLETED'
export const CANCELLED = 'CANCELLED'

/** Every manifest state, in the order a run walks through them. */
export const WORKFLOW_STATES = [DRAFT, IN_TRANSIT, COMPLETED, CANCELLED]

// Still in play. Both are stock that left a warehouse and has not reached a shelf.
export const AWAITING_DELIVERY = [DRAFT, IN_TRANSIT]

/**
 * States a manifest can never leave — the two ways a run stops being work.
 *
 * A COMPLETED manifest handed over everything it carried; a CANCELLED one was abandoned
 * before anything moved. Neither has an outgoing transition.
 */
export const TERMINAL_STATES = [COMPLETED, CANCELLED]

// For "what is outstanding?", never "what has this ever held?". Terminal rows pile up
// forever and would drag any live-pipeline ratio towards history as the sheet ages.
export const IN_FLIGHT_STATES = WORKFLOW_STATES.filter((state) => !TERMINAL_STATES.includes(state))

// ─── The one progress vocabulary ──────────────────────────────────────────────

export const PROGRESS_META = {
  [DRAFT]: { label: 'Draft', color: 'grey-7', icon: 'edit_note' },
  [IN_TRANSIT]: { label: 'In Transit', color: 'info', icon: 'local_shipping' },
  [COMPLETED]: { label: 'Completed', color: 'positive', icon: 'check_circle' },
  [CANCELLED]: { label: 'Cancelled', color: 'negative', icon: 'block' }
}

/** What an unmapped state renders as. Its `label` is only ever reached for a BLANK state. */
export const FALLBACK_META = { label: '—', color: 'grey-6', icon: 'help_outline' }

// Prefixes are carried, not computed: the sheet has `ProgressInTransit*` but plain
// `Cancelled*`, so deriving a column name from a state would read a column that is not there.
export const WORKFLOW_STAMPS = [
  { state: DRAFT, prefix: 'Created', title: 'Draft Created', icon: 'edit_note', color: 'grey-7' },
  { state: IN_TRANSIT, prefix: 'ProgressInTransit', title: 'Departed — In Transit', icon: 'local_shipping', color: 'info' },
  { state: COMPLETED, prefix: 'ProgressCompleted', title: 'All Items Delivered', icon: 'check_circle', color: 'positive' },
  { state: CANCELLED, prefix: 'Cancelled', title: 'Cancelled', icon: 'block', color: 'negative' }
]

/** The stamp prefix each state writes, for a caller that holds only a state. */
export const PROGRESS_STAMP_PREFIX = Object.fromEntries(
  WORKFLOW_STAMPS.map((stamp) => [stamp.state, stamp.prefix]))

// ─── Readers ──────────────────────────────────────────────────────────────────

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const asList = (value) => (Array.isArray(value) ? value : [])

// Audit columns hold epoch millis as a STRING, and `new Date('1778902409966')` is invalid.
// Not `parseAnyDate`: it drops the `Z`, so the two stamp shapes could not be compared.
export function stampInstant (value) {
  const raw = text(value)
  if (!raw) return null
  const parsed = /^\d{11,}$/.test(raw) ? new Date(Number(raw)) : new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Normalized Progress value, tolerant of casing and stray whitespace from the sheet. */
export function progressOf (record) {
  return text(asRow(record).Progress).toUpperCase()
}

/**
 * Presentation lookups. These take a STATE STRING rather than a row, so a caller holding
 * only a bucket key (a funnel legend, a chart axis) can use them too; `progressOf(record)`
 * bridges the gap for a caller holding a record.
 */
export function progressColor (state) {
  return PROGRESS_META[text(state).toUpperCase()]?.color || FALLBACK_META.color
}

export function progressIcon (state) {
  return PROGRESS_META[text(state).toUpperCase()]?.icon || FALLBACK_META.icon
}

export function progressLabel (state) {
  const raw = text(state).toUpperCase()
  // An unmapped-but-present state states itself rather than reading as blank.
  return PROGRESS_META[raw]?.label || raw || FALLBACK_META.label
}

/** A blank Status is Active — the sheet only writes the column when it is set. */
export function isActiveRow (record) {
  return text(asRow(record).Status || 'Active') === 'Active'
}

// ─── State predicates ─────────────────────────────────────────────────────────

export function isDraft (record) {
  return progressOf(record) === DRAFT
}

export function isInTransit (record) {
  return progressOf(record) === IN_TRANSIT
}

export function isCompleted (record) {
  return progressOf(record) === COMPLETED
}

export function isCancelled (record) {
  return progressOf(record) === CANCELLED
}

/** Whether a manifest has come to rest — completed or cancelled. */
export function isTerminal (record) {
  return TERMINAL_STATES.includes(progressOf(record))
}

/** Still in play: loaded or on the road. The predicate every "open runs" list filters on. */
export function isActive (record) {
  return AWAITING_DELIVERY.includes(progressOf(record))
}

// ─── The manifest's lines ─────────────────────────────────────────────────────

// The CSV is the manifest's whole definition of its load, so splitting it is a domain job.
// A page doing its own split would disagree about blanks and report a different count.
export function orsisForDelivery (record) {
  return text(asRow(record).OutletRestockItemCodes)
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean)
}

// Counted against the manifest's own code list, so a stray row cannot inflate it.
// Indexed in one pass: this runs per row on the Index list.
export function deliveryRatio (record, orsiRows = []) {
  const codes = orsisForDelivery(record)
  if (!codes.length) return { delivered: 0, total: 0 }

  const progressByCode = new Map()
  for (const raw of asList(orsiRows)) {
    const row = asRow(raw)
    const code = text(row.Code)
    if (code) progressByCode.set(code, text(row.Progress))
  }

  let delivered = 0
  for (const code of codes) {
    if (progressByCode.get(code) === ITEM_DELIVERED) delivered++
  }
  return { delivered, total: codes.length }
}

/** Whether any line on this manifest has already been handed over. */
export function hasDeliveredItems (record, orsiRows = []) {
  return deliveryRatio(record, orsiRows).delivered > 0
}

// ─── Transition gates ─────────────────────────────────────────────────────────

// This composable IS OutletDeliveries — always. Never derived from the route (§3.2).
const RESOURCE_NAME = 'OutletDeliveries'

// Each gate claims its OWN registered action, not generic `update`: a role granted
// canMarkComplete without record-edit rights must still be able to close a run.
function may (action) {
  return !!useResourceConfig(RESOURCE_NAME).allowed(action)
}

// DRAFT only, and only while nothing has been handed over: no cancellation can un-deliver
// goods. Fails closed when the item rows are not supplied.
export function canCancel (record, orsiRows = null) {
  if (!may('cancel')) return false
  if (!isDraft(record)) return false
  if (!Array.isArray(orsiRows)) return false
  return !hasDeliveredItems(record, orsiRows)
}

/**
 * Whether every line on the manifest is delivered, so it may be closed.
 *
 * The safety net behind auto-completion: `buildDeliveryMarkDeliveredNodes` closes a manifest
 * itself the moment its last line lands, so this is for the run that did not close — a line
 * delivered through the standalone restock route, or a batch that partially failed.
 *
 * An empty manifest is NOT complete. A run carrying nothing has delivered nothing, and
 * reporting `true` here would let an empty draft be closed as a finished delivery.
 */
export function canComplete (record, orsiRows = []) {
  if (!may('markComplete')) return false
  const ratio = deliveryRatio(record, orsiRows)
  return ratio.total > 0 && ratio.delivered === ratio.total
}

/** Whether lines may still be handed over against this manifest. */
export function canDeliver (record) {
  return may('markDeliver') && (isDraft(record) || isInTransit(record))
}

/** Whether the run may be marked as departed. */
export function canMakeInTransit (record) {
  return may('makeInTransit') && isDraft(record)
}

// DRAFT only. Once the van has left, the load is physical and cannot be re-lined from a
// desk. Fix an in-transit run by delivering what came off it, not by rewriting it.
export function isEditable (record) {
  return isDraft(record)
}

// ─── The audit timeline ───────────────────────────────────────────────────────

/**
 * Every workflow event that actually happened, oldest first.
 *
 * A stamp with no actor is a stage the run never reached, and is dropped — the timeline
 * shows history, not a checklist of what could still happen. An unparseable stamp sorts to
 * the END rather than poisoning the comparison with `NaN`, and keeps its raw text so a
 * malformed value stays visible instead of silently blank.
 */
export function workflowStamps (record) {
  const row = asRow(record)
  return WORKFLOW_STAMPS
    .map((stamp) => {
      const at = text(row[`${stamp.prefix}At`])
      const parsed = stampInstant(at)
      return {
        state: stamp.state,
        title: stamp.title,
        at,
        by: text(row[`${stamp.prefix}By`]),
        comment: text(row[`${stamp.prefix}Comment`]),
        icon: stamp.icon,
        color: stamp.color,
        timestamp: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
      }
    })
    .filter((event) => event.by)
    .sort((a, b) => (a.timestamp?.getTime() ?? Infinity) - (b.timestamp?.getTime() ?? Infinity))
}

/**
 * When the manifest last moved — the timestamp of the stamp its CURRENT state writes.
 *
 * What "how long has this been sitting here?" measures against. Falls back to `Date`, then
 * `CreatedAt`, so a row whose stamp column was never written still ages rather than reading
 * as brand new.
 */
export function settledAt (record) {
  const row = asRow(record)
  const prefix = PROGRESS_STAMP_PREFIX[progressOf(row)]
  return text(prefix ? row[`${prefix}At`] : '') || text(row.Date) || text(row.CreatedAt)
}

/**
 * Whole days elapsed since a timestamp. Today is 0, yesterday is 1.
 *
 * `daysFromToday` is signed the other way round (future positive), and an age is more
 * naturally read as a positive count, so the sign is flipped here rather than at every call
 * site. NaN propagates for an unparseable stamp and every consumer below guards it.
 */
export function daysSince (stampValue) {
  return -daysFromToday(stampValue)
}

// ─── The one ageing scale ─────────────────────────────────────────────────────

/**
 * The ageing bands, youngest → oldest. `max` is inclusive; the last band is open-ended.
 *
 * ONE table, because a numeric scale that a widget AND a row chip both read is one exported
 * table in the vocabulary file, not an array literal in each (§4.5). Deliberately the same
 * thresholds `useRestockProgress` uses: an allocated line waiting for a van and a restock
 * waiting for approval are the same backlog seen from two ends, and grading them differently
 * would show the same delay as amber on one page and red on the other.
 */
export const AGE_BANDS = [
  { label: '0–1 days', caption: 'On track', color: 'positive', max: 1 },
  { label: '2–3 days', caption: 'Watch', color: 'info', max: 3 },
  { label: '4–7 days', caption: 'Chase', color: 'warning', max: 7 },
  { label: '7+ days', caption: 'Overdue', color: 'negative', max: Infinity }
]

/**
 * The band an age falls in, or `null` when the age is unknown.
 *
 * `null` rather than a default band, deliberately: an unparseable stamp yields `NaN`, which
 * no band claims, and a row with no readable age must be left UNCOUNTED rather than dumped
 * into the freshest or the oldest bucket.
 */
export function ageBandOf (days) {
  if (days === null || days === undefined || Number.isNaN(days)) return null
  return AGE_BANDS.find((band) => days <= band.max) || null
}

/** Age badge colour — the band's colour, so chip and widget can never disagree. */
export function ageColor (days) {
  return ageBandOf(days)?.color || FALLBACK_META.color
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useDeliveryProgress () {
  return {
    DRAFT,
    IN_TRANSIT,
    COMPLETED,
    CANCELLED,
    WORKFLOW_STATES,
    AWAITING_DELIVERY,
    TERMINAL_STATES,
    IN_FLIGHT_STATES,
    WORKFLOW_STAMPS,
    PROGRESS_STAMP_PREFIX,
    PROGRESS_META,
    FALLBACK_META,
    AGE_BANDS,
    ITEM_ALLOCATED,
    ITEM_DELIVERED,
    progressOf,
    progressColor,
    progressIcon,
    progressLabel,
    isActiveRow,
    isDraft,
    isInTransit,
    isCompleted,
    isCancelled,
    isTerminal,
    isActive,
    orsisForDelivery,
    deliveryRatio,
    hasDeliveredItems,
    canCancel,
    canComplete,
    canDeliver,
    canMakeInTransit,
    isEditable,
    workflowStamps,
    settledAt,
    daysSince,
    ageBandOf,
    ageColor,
    sortByDate
  }
}
