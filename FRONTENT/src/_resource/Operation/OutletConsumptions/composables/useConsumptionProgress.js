/**
 * OutletConsumptions › progress vocabulary — Layer 2, the resource's domain logic.
 *
 * The states a consumption can be in, the predicates that decide what is safe to do with
 * one, and the audit-visit ageing scale every consumer bands outlets by. This is the
 * SINGLE source of truth for "what state is this record in, and what does that state look
 * like" — every UI that renders an OutletConsumption reads it from here
 * (UI_RESOURCE_DOMAIN_LOGIC.md §3.3).
 *
 * SELF-IDENTIFYING (§3.2): the resource name is a module constant and `useResourceConfig`
 * is called with that literal. Nothing here reads the route, and no export takes a
 * `config` parameter — a consumption predicate is equally correct when called from an
 * Outlet page or a Visit card.
 *
 * Named PURE exports — importable from a page contract or a JS modifier, both of which are
 * evaluated outside any component setup. The `useConsumptionProgress()` wrapper exists for
 * setup-context callers (§5).
 *
 * ISOLATION (§2.1): the only imports are `src/utils/` helpers and the generic
 * `useResourceConfig` Core Composable. No store, no service, nothing under `_ui/`.
 */

import { daysFromToday } from 'src/utils/dateHelpers'
import { sortByDate } from 'src/utils/sortHelpers'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'
import { defaultVisitFrequencyDays, visitFrequencyFor } from 'src/_resource/Operation/OutletVisits/composables/useVisitCadence'

// This composable IS OutletConsumptions — always. Never route-derived (§3.2).
const RESOURCE_NAME = 'OutletConsumptions'

// Re-exported so a consumer that already imports this file for the workflow vocabulary
// does not need a second import line to sort the rows it just filtered.
export { sortByDate }

// ─── Workflow states ──────────────────────────────────────────────────────────

export const PENDING_INVOICE_GENERATION = 'PENDING_INVOICE_GENERATION'
export const INVOICE_GENERATED = 'INVOICE_GENERATED'
export const CANCELLED = 'CANCELLED'

/** Every consumption state, in the order a record walks through them. */
export const WORKFLOW_STATES = [PENDING_INVOICE_GENERATION, INVOICE_GENERATED, CANCELLED]

/**
 * States a consumption can never leave.
 *
 * `CANCELLED` alone. `INVOICE_GENERATED` looks terminal for the consumption itself but is
 * not: cancelling a consumption whose invoice is still unpaid walks it to `CANCELLED`
 * (see `isCancellable`), so it still has an outgoing transition.
 */
export const TERMINAL_STATES = [CANCELLED]

/** The states a consumption is still MOVING through — what is outstanding, not history. */
export const IN_FLIGHT_STATES = WORKFLOW_STATES.filter((state) => !TERMINAL_STATES.includes(state))

// ─── The one progress vocabulary ──────────────────────────────────────────────
//
// ONE map, keyed by the raw sheet value, read by every chip, badge, widget legend and
// gate on every page. A component picking its own colour for a state is how a metric card
// and the row beneath it end up disagreeing about what "Pending Invoice" looks like
// (UI_MODULE_DEVELOPER_GUIDE.md §4.5).

export const PROGRESS_META = {
  [PENDING_INVOICE_GENERATION]: { label: 'Pending Invoice', color: 'warning', icon: 'receipt_long' },
  [INVOICE_GENERATED]: { label: 'Invoiced', color: 'positive', icon: 'task_alt' },
  [CANCELLED]: { label: 'Cancelled', color: 'negative', icon: 'block' }
}

/**
 * The consumption vocabulary PLUS the neighbouring states this module's View page renders
 * on the same screen — exactly §3.3's extension shape rather than a second map.
 *
 * The View page shows a consumption's own Progress beside its restock ITEM states and its
 * invoice's PAYMENT states. Those live in their own resources' vocabularies, but a screen
 * showing all three must not paint them from three unrelated palettes, and the two that
 * are genuinely this module's business — an invoice that is unpaid, an allocated restock
 * line — are declared here once so the View cards read a single map.
 */
export const RELATED_ROW_META = {
  ...PROGRESS_META,
  // OutletRestockItems states, as the Restock Details card renders them.
  PENDING: { label: 'Pending', color: 'warning', icon: 'schedule' },
  ALLOCATED: { label: 'Allocated', color: 'primary', icon: 'inventory_2' },
  DELIVERED: { label: 'Delivered', color: 'positive', icon: 'local_shipping' },
  // OutletConsumptionInvoices payment states, as the Invoice Details card renders them.
  PENDING_PAYMENT: { label: 'Pending Payment', color: 'warning', icon: 'pending' },
  PARTIALLY_PAID: { label: 'Partially Paid', color: 'info', icon: 'payments' },
  PAID: { label: 'Paid', color: 'positive', icon: 'paid' },
  // OutletReturns states, as the Returns card renders them.
  SUBMITTED: { label: 'Submitted', color: 'info', icon: 'assignment_returned' },
  AWAITING_INVOICE_ADJUSTMENT: { label: 'Awaiting Invoice Adjustment', color: 'warning', icon: 'request_quote' },
  AWAITING_WAREHOUSE_RECEIPT: { label: 'Awaiting Warehouse Receipt', color: 'purple', icon: 'warehouse' },
  COMPLETED: { label: 'Completed', color: 'positive', icon: 'check_circle' }
}

/** What an unmapped state renders as. Its `label` is only ever reached for a BLANK state. */
export const FALLBACK_META = { label: '—', color: 'grey-6', icon: 'help_outline' }

/**
 * The workflow stamp PREFIX each state writes.
 *
 * Carried rather than derived because the two do not always agree across this app's
 * resources; here they happen to line up, and stating them explicitly keeps the map the
 * same shape as every other resource's so a reader does not have to check which.
 */
export const PROGRESS_STAMP_PREFIX = {
  [PENDING_INVOICE_GENERATION]: 'ProgressPendingInvoiceGeneration',
  [INVOICE_GENERATED]: 'ProgressInvoiceGenerated',
  [CANCELLED]: 'ProgressCancelled'
}

/** The workflow stamp COLUMNS, in the order a consumption walks through them. */
export const WORKFLOW_STAMPS = [
  { state: PENDING_INVOICE_GENERATION, prefix: 'ProgressPendingInvoiceGeneration', title: 'Consumption Recorded' },
  { state: INVOICE_GENERATED, prefix: 'ProgressInvoiceGenerated', title: 'Invoice Generated' },
  { state: CANCELLED, prefix: 'ProgressCancelled', title: 'Cancelled' }
]

// ─── Primitives ───────────────────────────────────────────────────────────────

const text = (value) => (value == null ? '' : String(value).trim())
// `useRecord().items` can carry `null` entries, and an enriched relation getter yields
// `null` for a row whose Code has not landed yet (UI_MODULE_DEVELOPER_GUIDE.md §11 rule 2).
// Normalizing BEFORE any predicate is what stops a null passing one guard and being
// dereferenced by the next.
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// ─── Progress vocabulary ──────────────────────────────────────────────────────

/** Normalized Progress value, tolerant of casing and stray whitespace from the sheet. */
export function progressOf (row) {
  return text(asRow(row).Progress).toUpperCase()
}

/**
 * Presentation lookups. These take a STATE STRING rather than a row, so a caller holding
 * only a bucket key (a widget legend, an ageing header) can use them too; `progressOf(row)`
 * bridges the gap for callers holding a record.
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

/**
 * The same three lookups over `RELATED_ROW_META`, for the View page — which renders a
 * consumption's state beside its restock lines', its invoice's and its returns' on one
 * screen.
 */
export function relatedColor (state) {
  return RELATED_ROW_META[text(state).toUpperCase()]?.color || FALLBACK_META.color
}

export function relatedIcon (state) {
  return RELATED_ROW_META[text(state).toUpperCase()]?.icon || FALLBACK_META.icon
}

export function relatedLabel (state) {
  const raw = text(state).toUpperCase()
  return RELATED_ROW_META[raw]?.label || raw || FALLBACK_META.label
}

// ─── Row predicates ───────────────────────────────────────────────────────────

/** A blank Status is Active — the sheet only writes the column when it is set. */
export function isActiveRow (row) {
  return text(asRow(row).Status || 'Active') === 'Active'
}

export function isPendingInvoice (row) {
  return progressOf(row) === PENDING_INVOICE_GENERATION
}

/** Whether the consumption has walked to `INVOICE_GENERATED`. */
export function isInvoiceGenerated (row) {
  return progressOf(row) === INVOICE_GENERATED
}

export function isCancelled (row) {
  return progressOf(row) === CANCELLED
}

/** Whether a consumption has come to rest. */
export function isTerminal (row) {
  return TERMINAL_STATES.includes(progressOf(row))
}

/**
 * Whether an INVOICE actually exists for this consumption.
 *
 * Deliberately NOT the same question as `isInvoiceGenerated`, which reads the
 * consumption's own state column. The two normally agree, and where they do not the
 * invoice row is the truth: a bundled invoice generated later from a sibling consumption
 * writes the invoice before the state, and a state written without a surviving invoice row
 * is stale. The caller supplies the candidate invoices so this stays pure.
 */
export function hasInvoice (row, invoices = []) {
  return !!findInvoiceFor(row, invoices)
}

/**
 * The invoice covering this consumption, or `null`.
 *
 * `OutletConsumptionInvoices.OutletConsumptionCode` holds a COMMA-SEPARATED list when
 * several consumptions were bundled onto one invoice (`GAS/syncAppResources.gs`), so
 * membership — never equality — is the correct test. An equality check silently reports
 * "no invoice" for every consumption that was bundled with another, which is precisely the
 * case bundling exists to create.
 */
export function findInvoiceFor (row, invoices = []) {
  const code = text(asRow(row).Code)
  if (!code) return null
  return (Array.isArray(invoices) ? invoices : [])
    .map(asRow)
    .find((invoice) => isActiveRow(invoice) &&
      progressOf(invoice) !== CANCELLED &&
      consumptionCodesOf(invoice).includes(code)) || null
}

/**
 * The consumption codes one invoice covers, as an array.
 *
 * The single reader of the CSV convention. Every consumer goes through it rather than
 * splitting the string itself, so the separator lives in exactly one place.
 */
export function consumptionCodesOf (invoice) {
  return text(asRow(invoice).OutletConsumptionCode)
    .split(',')
    .map(text)
    .filter(Boolean)
}

/**
 * Whether this consumption may be cancelled, and why not when it may not.
 *
 * Three conditions, and the caller supplies the dependents so this stays pure:
 *   1. permission — `cancelConsumption`, the flag GAS publishes for the `CancelConsumption`
 *      AdditionalAction, so this predicate, the FAB gate and the action route agree;
 *   2. the record is not already cancelled — nothing to do;
 *   3. nothing downstream has been consumed irreversibly. A PAID invoice has money against
 *      it and an APPROVED/DELIVERED restock has moved stock; neither is undone by writing
 *      `CANCELLED` on this row (UI_MODULE_DEVELOPER_GUIDE.md §13.6, reason 3).
 *
 * Returns a `{ allowed, reason }` pair rather than a bare boolean because the View page
 * must SAY why the button is unavailable — a silently missing action reads as a bug.
 */
export const RESTOCK_IRREVERSIBLE = ['APPROVED', 'DELIVERED', 'PARTIALLY_DELIVERED']

export function cancellability (row, { invoice = null, restocks = [] } = {}) {
  const { allowed } = useResourceConfig(RESOURCE_NAME)

  if (allowed?.({ [RESOURCE_NAME]: 'cancelConsumption' }) !== true) {
    return { allowed: false, reason: 'You are not allowed to cancel a consumption.' }
  }
  if (isCancelled(row)) {
    return { allowed: false, reason: 'This consumption is already cancelled.' }
  }
  if (invoice && progressOf(invoice) === 'PAID') {
    return { allowed: false, reason: 'Its invoice has been paid and can no longer be reversed.' }
  }
  const committed = (Array.isArray(restocks) ? restocks : [])
    .map(asRow)
    .filter(isActiveRow)
    .find((restock) => RESTOCK_IRREVERSIBLE.includes(progressOf(restock)))
  if (committed) {
    return { allowed: false, reason: `Restock ${text(committed.Code)} has already moved stock and can no longer be rejected.` }
  }
  return { allowed: true, reason: '' }
}

/** The boolean half of `cancellability`, for a caller that only gates on it. */
export function isCancellable (row, dependents) {
  return cancellability(row, dependents).allowed
}

/**
 * The dependent restocks a cancellation may still reject.
 *
 * Anything already approved, delivered or itself rejected is left alone — the first two
 * because stock moved, the third because it is already settled.
 */
export function rejectableRestocks (restocks = []) {
  return (Array.isArray(restocks) ? restocks : [])
    .map(asRow)
    .filter(isActiveRow)
    .filter((restock) => text(restock.Code))
    .filter((restock) => ![...RESTOCK_IRREVERSIBLE, 'REJECTED'].includes(progressOf(restock)))
}

/**
 * Whether a row should be counted AT ALL for `userId` — the one visibility rule every
 * Index widget shares (UI_MODULE_DEVELOPER_GUIDE.md §9.2 rule 3).
 *
 * A consumption has no draft state, so unlike a restock there is no per-user scoping to
 * apply: every row the record store hands over under `OWNER_AND_UPLINE` is a real,
 * submitted audit that the reader is entitled to see. The predicate exists anyway, applied
 * by every widget, so that a later state needing scoping cannot be introduced by adding a
 * card that quietly forgot the rule.
 *
 * PURE — the caller supplies the id, so this file still imports no store and stays usable
 * from a page contract.
 */
export function countsForUser (row, userId) { // eslint-disable-line no-unused-vars
  return !!row && isActiveRow(row)
}

/** Whether `row` belongs to the user identified by `userId`. Fails CLOSED on a blank. */
export function isOwnedBy (row, userId) {
  const me = text(userId)
  if (!me) return false
  const entry = asRow(row)
  return text(entry.CreatedBy) === me || text(entry.Username) === me
}

// ─── Stamps & timeline ────────────────────────────────────────────────────────

/** One workflow stamp as `{ at, by, comment }`. */
export function stampOf (row, prefix) {
  const key = text(prefix)
  if (!key) return { at: '', by: '', comment: '' }
  const entry = asRow(row)
  return {
    at: text(entry[`${key}At`]),
    by: text(entry[`${key}By`]),
    comment: text(entry[`${key}Comment`])
  }
}

/**
 * When the consumption last moved — the timestamp of the stamp its CURRENT state writes.
 *
 * Falls back to the audit `Date`, then `CreatedAt`, so a row whose stamp column was never
 * written still ages rather than reading as brand new. The same reader is used for the
 * sort and for the displayed age, so a list can never claim an order it does not have
 * (UI_MODULE_DEVELOPER_GUIDE.md §7.2).
 */
export function settledAt (row) {
  const stamp = stampOf(row, PROGRESS_STAMP_PREFIX[progressOf(row)])
  return stamp.at || text(asRow(row).Date) || asRow(row).CreatedAt || ''
}

/** Whole days elapsed since a timestamp. Today is 0, yesterday is 1. */
export function daysSince (stampValue) {
  return -daysFromToday(stampValue)
}

/**
 * Every workflow event that has actually happened, oldest first.
 *
 * A stamp with no actor is a stage the record never reached, and is dropped — a timeline
 * shows history, not a checklist of what could still happen.
 */
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
    .filter((event) => event.by)
    .sort((a, b) => (a.timestamp?.getTime() ?? Infinity) - (b.timestamp?.getTime() ?? Infinity))
}

// ─── The one audit-cadence scale ──────────────────────────────────────────────
//
// An outlet is not "overdue" after a fixed number of days — it is overdue relative to ITS
// OWN visit frequency. So the bands are a function of that frequency rather than a fixed
// table, and both the Index page's AgeingBuckets widget and any per-row urgency chip
// derive from this one function (UI_MODULE_DEVELOPER_GUIDE.md §4.5, §9.2).

/**
 * The visit cadence rule is a question about a VISIT, so it is owned by
 * `_resource/Operation/OutletVisits/composables/useVisitCadence.js` and merely re-exported
 * here — one definition, read by both modules (§3.3). Every existing caller keeps its
 * import line; the ageing bands below still read the cadence through it.
 */
export { defaultVisitFrequencyDays, visitFrequencyFor }

/**
 * The four ageing bands for a given cadence `F`, youngest → oldest. `max` is inclusive and
 * the last band is open-ended.
 *
 * On Schedule (≤F), Slightly Overdue (up to +30%), Overdue (up to +70%), Critical beyond.
 * The percentages are relative so a weekly outlet and a monthly one are judged on the same
 * scale in proportion rather than in absolute days.
 *
 * Returns `[]` for an unknown cadence, which trips the widget's strict hide rule — a band
 * table built on a guessed frequency would report outlets as critical on no evidence.
 */
export const OVERDUE_TIERS = [
  { label: 'On Schedule', caption: 'Within cadence', color: 'positive', factor: 1 },
  { label: 'Slightly Overdue', caption: 'Just past due', color: 'info', factor: 1.3 },
  { label: 'Overdue', caption: 'Needs a visit', color: 'warning', factor: 1.7 },
  { label: 'Critical', caption: 'Long neglected', color: 'negative', factor: Infinity }
]

export function overdueBands (frequencyDays) {
  const frequency = num(frequencyDays)
  if (frequency <= 0) return []
  return OVERDUE_TIERS.map((tier) => ({
    label: tier.label,
    caption: tier.caption,
    color: tier.color,
    max: tier.factor === Infinity ? Infinity : Math.round(frequency * tier.factor)
  }))
}

/** The band an elapsed-day count falls in, or `null` when the age or cadence is unknown. */
export function overdueBandOf (days, frequencyDays) {
  if (days === null || days === undefined || Number.isNaN(days)) return null
  const bands = overdueBands(frequencyDays)
  if (!bands.length) return null
  return bands.find((band) => days <= band.max) || null
}

/** Urgency colour for an elapsed-day count — the band's, so chip and widget cannot disagree. */
export function overdueColor (days, frequencyDays) {
  return overdueBandOf(days, frequencyDays)?.color || FALLBACK_META.color
}

/** Whether an outlet is past its cadence at all. Unknown cadence is never "overdue". */
export function isOverdue (days, frequencyDays) {
  const frequency = num(frequencyDays)
  if (frequency <= 0 || days === null || days === undefined || Number.isNaN(days)) return false
  return days > frequency
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useConsumptionProgress () {
  return {
    PENDING_INVOICE_GENERATION,
    INVOICE_GENERATED,
    CANCELLED,
    WORKFLOW_STATES,
    TERMINAL_STATES,
    IN_FLIGHT_STATES,
    WORKFLOW_STAMPS,
    PROGRESS_META,
    RELATED_ROW_META,
    FALLBACK_META,
    PROGRESS_STAMP_PREFIX,
    OVERDUE_TIERS,
    RESTOCK_IRREVERSIBLE,
    progressOf,
    progressColor,
    progressIcon,
    progressLabel,
    relatedColor,
    relatedIcon,
    relatedLabel,
    isActiveRow,
    isPendingInvoice,
    isInvoiceGenerated,
    isCancelled,
    isTerminal,
    hasInvoice,
    findInvoiceFor,
    consumptionCodesOf,
    cancellability,
    isCancellable,
    rejectableRestocks,
    countsForUser,
    isOwnedBy,
    stampOf,
    settledAt,
    daysSince,
    workflowStamps,
    defaultVisitFrequencyDays,
    visitFrequencyFor,
    overdueBands,
    overdueBandOf,
    overdueColor,
    isOverdue,
    sortByDate
  }
}
