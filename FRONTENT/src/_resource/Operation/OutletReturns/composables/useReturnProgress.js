/**
 * OutletReturns › progress vocabulary — Layer 2, the resource's domain logic.
 *
 * A return is a DUAL-TRACK reconciliation. Two independent tracks may be open on one row:
 *
 *   COMMERCIAL — the outlet is owed a credit deduction on their next invoice
 *                (`InvoiceAdjustmentRequired` → `InvoiceAdjustmentDone`).
 *   PHYSICAL   — the units leave the outlet shelf for a warehouse bin or a write-off
 *                (`WarehouseActionRequired` → `WarehouseActionCompleted`).
 *
 * The row is COMPLETED only when every track flagged as required has been resolved. That
 * one rule is `isReturnCompleted` below, and it is the SINGLE place the completion
 * question is answered — every payload builder that decides whether to write
 * `Progress: 'COMPLETED'` calls it rather than re-deriving the condition
 * (UI_RESOURCE_DOMAIN_LOGIC.md §3.3).
 *
 * Named PURE exports — importable from a page contract or a JS modifier, which run outside
 * component setup; the composable wrapper exists for setup-context callers (§5). Nothing
 * here injects, holds reactive state, renders, or touches a store.
 *
 * ISOLATION (§2.1): the only imports are `src/utils/` helpers.
 */

import { sortByDate } from 'src/utils/sortHelpers'

// Re-exported so a consumer that already imports this file for the workflow vocabulary
// does not need a second import line to sort the rows it just filtered.
export { sortByDate }

const RESOURCE_NAME = 'OutletReturns' // this composable IS OutletReturns — always

// ─── Workflow states ──────────────────────────────────────────────────────────

export const SUBMITTED = 'SUBMITTED'
export const COMPLETED = 'COMPLETED'
export const CANCELLED = 'CANCELLED'

/**
 * ── The two LEGACY holding states ──
 *
 * `GAS/Constants.gs` declares FIVE values in `OutletReturnProgress`, and the sheet's
 * Progress column carries a data validation built from that list. The two below are part
 * of it and EXIST IN LIVE DATA: `useConsumptionStock.returnProgressFor` has been writing
 * `AWAITING_WAREHOUSE_RECEIPT` on every return the consumption path creates with a
 * warehouse leg, and `buildReturnAdjustmentRequests` writes it again on invoice credit.
 *
 * Nothing in this module WRITES them — a return this module creates or advances lands in
 * `SUBMITTED`, `COMPLETED` or `CANCELLED`, which is the vocabulary the module was specified
 * with. They are declared here so that rows already carrying them READ correctly: they
 * render with a real label and colour instead of falling through to `FALLBACK_META`, and
 * `isTerminal` correctly reports them as still-open work.
 *
 * This is why no consumer should filter an "open returns" list on `Progress === SUBMITTED`.
 * Use `isOpen` / `IN_FLIGHT_STATES`, which claim all three non-terminal states — filtering
 * on the literal would silently hide every return the consumption path ever created.
 */
export const AWAITING_INVOICE_ADJUSTMENT = 'AWAITING_INVOICE_ADJUSTMENT'
export const AWAITING_WAREHOUSE_RECEIPT = 'AWAITING_WAREHOUSE_RECEIPT'

/** The legacy pair, named so a migration or a report can address them as a set. */
export const LEGACY_STATES = [AWAITING_INVOICE_ADJUSTMENT, AWAITING_WAREHOUSE_RECEIPT]

/** Every state the Progress column may hold — the backend enum, in walk order. */
export const WORKFLOW_STATES = [
  SUBMITTED,
  AWAITING_INVOICE_ADJUSTMENT,
  AWAITING_WAREHOUSE_RECEIPT,
  COMPLETED,
  CANCELLED
]

/**
 * States a return can never leave — the two ways it stops being work.
 *
 * A COMPLETED return has had every required track resolved; a CANCELLED one has been
 * voided and its ledger movement reversed. Neither has an outgoing transition.
 */
export const TERMINAL_STATES = [COMPLETED, CANCELLED]

/**
 * The states a return is still MOVING through — `SUBMITTED` plus the two legacy holding
 * states. This is what "what is outstanding?" means for this resource, and it is
 * deliberately the complement of the terminal pair rather than a literal list: terminal
 * rows accumulate forever, so counting them makes any reading of the live queue drift
 * towards history as the sheet ages.
 */
export const IN_FLIGHT_STATES = WORKFLOW_STATES.filter((state) => !TERMINAL_STATES.includes(state))

// ─── The one progress vocabulary ──────────────────────────────────────────────

export const PROGRESS_META = {
  [SUBMITTED]: { label: 'Submitted', color: 'warning', icon: 'assignment_return' },
  [AWAITING_INVOICE_ADJUSTMENT]: { label: 'Awaiting Invoice Credit', color: 'info', icon: 'receipt_long' },
  [AWAITING_WAREHOUSE_RECEIPT]: { label: 'Awaiting Warehouse Receipt', color: 'purple', icon: 'warehouse' },
  [COMPLETED]: { label: 'Completed', color: 'positive', icon: 'check_circle' },
  [CANCELLED]: { label: 'Cancelled', color: 'negative', icon: 'block' }
}

/** What an unmapped state renders as. Its `label` is only ever reached for a BLANK state. */
export const FALLBACK_META = { label: '—', color: 'grey-6', icon: 'help_outline' }

/**
 * The disposition a completed warehouse action recorded.
 *
 * `WarehouseAction` is its own small vocabulary (`APP_OPTIONS_SEED.OutletReturnWarehouseAction`)
 * rather than a Progress state, because it answers a different question: not "how far has
 * this return got" but "where did the units physically end up".
 */
export const STOCKED = 'Stocked'
export const DISPOSED = 'Disposed'

export const WAREHOUSE_ACTION_META = {
  [STOCKED]: { label: 'Stocked', color: 'positive', icon: 'store' },
  [DISPOSED]: { label: 'Disposed', color: 'negative', icon: 'delete_outline' }
}

/** The seven reason codes, with the labels the Add page's selector renders. */
export const REASON_META = {
  DAMAGE: { label: 'Damage', icon: 'report_problem' },
  EXPIRED: { label: 'Expired', icon: 'event_busy' },
  SLOW_MOVING: { label: 'Slow Moving', icon: 'trending_down' },
  RECALL: { label: 'Recall', icon: 'gpp_bad' },
  OVERSTOCK: { label: 'Overstock', icon: 'inventory_2' },
  SPECIFICATION_MISMATCH: { label: 'Specification Mismatch', icon: 'swap_horiz' },
  OTHER: { label: 'Other', icon: 'help_outline' }
}

export const REASONS = Object.keys(REASON_META)

/** The one reason that cannot stand without an explanation. */
export const REASON_REQUIRING_COMMENT = 'OTHER'

// ─── Readers ──────────────────────────────────────────────────────────────────

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})

/**
 * Whether a `'TRUE'`/`'FALSE'` flag column is set.
 *
 * Tolerant of THREE writers with three conventions: GAS writes the string `'TRUE'`, the
 * legacy `useOutletReturns.js` form held a real boolean before serialising, and the sheet
 * itself can hand back a native boolean when the cell was typed rather than written. All
 * three must read the same or a track silently reports itself unresolved.
 */
export function isFlagged (value) {
  return value === true || text(value).toUpperCase() === 'TRUE'
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

export function reasonLabel (reason) {
  const raw = text(reason).toUpperCase()
  return REASON_META[raw]?.label || raw || FALLBACK_META.label
}

export function reasonIcon (reason) {
  return REASON_META[text(reason).toUpperCase()]?.icon || FALLBACK_META.icon
}

/**
 * The display label for the `WarehouseAction` column — blank while undecided.
 *
 * Blank rather than a dash, because the caller renders this inside a status row that
 * already says whether the track is required; an em-dash there would read as "decided, and
 * the answer is nothing".
 */
export function warehouseActionLabel (record) {
  const action = text(asRow(record).WarehouseAction)
  return WAREHOUSE_ACTION_META[action]?.label || ''
}

export function warehouseActionColor (record) {
  const action = text(asRow(record).WarehouseAction)
  return WAREHOUSE_ACTION_META[action]?.color || FALLBACK_META.color
}

export function warehouseActionIcon (record) {
  const action = text(asRow(record).WarehouseAction)
  return WAREHOUSE_ACTION_META[action]?.icon || FALLBACK_META.icon
}

/** A blank Status is Active — the sheet only writes the column when it is set. */
export function isActiveRow (record) {
  return text(asRow(record).Status || 'Active') === 'Active'
}

// ─── State predicates ─────────────────────────────────────────────────────────

export function isSubmitted (record) {
  return progressOf(record) === SUBMITTED
}

export function isCompleted (record) {
  return progressOf(record) === COMPLETED
}

export function isCancelled (record) {
  return progressOf(record) === CANCELLED
}

/** Whether a row has come to rest — completed or cancelled. */
export function isTerminal (record) {
  return TERMINAL_STATES.includes(progressOf(record))
}

/**
 * Whether the return is still outstanding work.
 *
 * The predicate every "unresolved returns" list and metric should filter on, rather than
 * `isSubmitted` — see the note on `LEGACY_STATES` for why the literal would under-count.
 */
export function isOpen (record) {
  return !isTerminal(record)
}

// ─── Track predicates ─────────────────────────────────────────────────────────

export function invoiceAdjustmentRequired (record) {
  return isFlagged(asRow(record).InvoiceAdjustmentRequired)
}

export function invoiceAdjustmentDone (record) {
  return isFlagged(asRow(record).InvoiceAdjustmentDone)
}

export function warehouseActionRequired (record) {
  return isFlagged(asRow(record).WarehouseActionRequired)
}

export function warehouseActionCompleted (record) {
  return isFlagged(asRow(record).WarehouseActionCompleted)
}

/** The commercial track is settled — either it was never owed, or it has been credited. */
export function invoiceTrackSettled (record) {
  return !invoiceAdjustmentRequired(record) || invoiceAdjustmentDone(record)
}

/** The physical track is settled — either nothing had to move, or it has moved. */
export function warehouseTrackSettled (record) {
  return !warehouseActionRequired(record) || warehouseActionCompleted(record)
}

/**
 * ── THE COMPLETION RULE ──
 *
 *   (¬IAR ∨ IAD) ∧ (¬WAR ∨ WAC)
 *
 * Every required track must be done. The SINGLE source of truth for whether a return may
 * carry `Progress: 'COMPLETED'` — every payload builder calls this rather than restating
 * the condition, so the two tracks can never be judged by two different rules.
 *
 * Takes the record as it will be AFTER the update being built, which is why builders spread
 * their pending changes over the row before calling it: the question is always "would this
 * row be complete once this batch lands", never "was it complete before".
 *
 * ── A NOTE ON WHAT THIS CHANGES ──
 * `useConsumptionStock.returnProgressFor` — the rule this replaces on the consumption path
 * — keys COMPLETED off the warehouse track ALONE and ignores the commercial one. A return
 * raised with `InvoiceAdjustmentRequired = TRUE` and no warehouse leg was therefore stamped
 * COMPLETED at creation, before the outlet had been credited a single time, and could never
 * appear in an "awaiting invoice credit" queue. Under this rule it correctly stays open
 * until an invoice credits it. Rows already written the old way keep their stored Progress;
 * this predicate only governs what is written from here on.
 */
export function isReturnCompleted (record) {
  return invoiceTrackSettled(record) && warehouseTrackSettled(record)
}

/**
 * Whether a return NEEDS to exist at all.
 *
 * A return with neither track required reconciles nothing: nobody is credited and nothing
 * moves. The standalone Add page refuses to log one (`Add/PageAction.js` gates on this).
 *
 * The CONSUMPTION path deliberately does NOT gate on it — a surplus line counted during a
 * consumption is a physical fact discovered at the outlet, and the row is its audit record
 * even when it carries no commercial or logistical consequence. Suppressing it there would
 * abort a whole consumption submit over a line the officer legitimately counted.
 */
export function returnRequiresTrack (record) {
  return invoiceAdjustmentRequired(record) || warehouseActionRequired(record)
}

/**
 * A return may be corrected while NEITHER track has been acted on — see `Edit.js`'s lock
 * banner.
 *
 * The gate is the two DONE columns rather than the Progress state, and the difference is
 * the case that matters: a return whose invoice credit has been issued but whose stock has
 * not yet left the shelf is still `SUBMITTED`, still "open" — and must NOT be editable,
 * because an invoice out there has already deducted the value this form would rewrite.
 * Half-settled is settled enough. What is left is a cancel-and-re-log, which reverses the
 * original movement properly.
 *
 * Terminal rows are excluded outright: a cancelled return is history, and a completed one
 * has by definition had every track it required resolved.
 */
export function isEditable (record) {
  return !isTerminal(record) &&
    !invoiceAdjustmentDone(record) &&
    !warehouseActionCompleted(record)
}

/** A return may be cancelled at any point before it comes to rest. */
export function canCancel (record) {
  return isOpen(record)
}

/** The warehouse leg is owed and unresolved — the `WarehouseAction` route's show condition. */
export function canConfirmWarehouseAction (record) {
  return warehouseActionRequired(record) && !warehouseActionCompleted(record)
}

/** The credit is owed and unresolved — the `MarkInvoiceAdjusted` route's show condition. */
export function canMarkInvoiceAdjusted (record) {
  return invoiceAdjustmentRequired(record) && !invoiceAdjustmentDone(record)
}

// ─── The audit timeline ───────────────────────────────────────────────────────

/**
 * ── WHY THIS IS NOT BUILT FROM `Progress<State>` STAMPS ──
 *
 * `OutletReturns` declares NO progress stamp columns. Its headers
 * (`GAS/setupOperationSheets.gs`) run `… Progress, Status, AccessRegion` plus the four
 * common audit columns, and that is all — there is no `ProgressCancelledAt/By/Comment`, no
 * `ProgressCompleted*`, nothing this resource could hang a conventional stamp timeline off.
 *
 * This matters beyond the timeline: `buildNewResourceRow` (`GAS/resourceApi.gs`) iterates
 * over the SHEET's headers and silently ignores any key it is handed that is not one of
 * them. The existing cancel path writes `ProgressCancelledComment`, so every cancellation
 * reason ever typed into this resource has been discarded without an error. The reason is
 * still collected and sent (harmless, and correct the moment the column is added), but it
 * cannot be displayed back until the schema carries it.
 *
 * So the timeline is assembled from columns that DO exist and are genuinely written:
 * creation, the warehouse disposition, and the last touch. Each entry is dropped unless it
 * has an actor, so the card shows history rather than a checklist of what could happen.
 */
export const TIMELINE_EVENTS = [
  { key: 'created', title: 'Return Logged', atField: 'CreatedAt', byField: 'CreatedBy', icon: 'assignment_return', color: 'primary' },
  { key: 'stocked', title: 'Stocked to Warehouse', atField: 'WarehouseActionStockedAt', byField: 'WarehouseActionStockedBy', icon: 'store', color: 'positive' },
  { key: 'disposed', title: 'Disposed', atField: 'WarehouseActionDisposedAt', byField: 'WarehouseActionDisposedBy', commentField: 'WarehouseActionDisposedReason', icon: 'delete_outline', color: 'negative' },
  { key: 'updated', title: 'Last Updated', atField: 'UpdatedAt', byField: 'UpdatedBy', icon: 'edit', color: 'grey-7' }
]

/**
 * Every audit event that actually happened, oldest first.
 *
 * An unparseable timestamp sorts to the END rather than poisoning the comparison with
 * `NaN`, and keeps its raw text, so a malformed stamp stays visible instead of blank.
 */
export function workflowStamps (record) {
  const row = asRow(record)
  return TIMELINE_EVENTS
    .map((event) => {
      const at = text(row[event.atField])
      const parsed = at ? new Date(at) : null
      return {
        key: event.key,
        title: event.title,
        at,
        by: text(row[event.byField]),
        comment: event.commentField ? text(row[event.commentField]) : '',
        icon: event.icon,
        color: event.color,
        timestamp: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
      }
    })
    .filter((event) => event.by)
    .sort((a, b) => (a.timestamp?.getTime() ?? Infinity) - (b.timestamp?.getTime() ?? Infinity))
}

/**
 * The monetary credit a return represents — `Qty × Price`, never negative.
 *
 * One function because the Index metric, the View card and the invoice deduction must
 * never disagree about what a return is worth.
 */
export function returnValueOf (record) {
  const row = asRow(record)
  const qty = Math.abs(Number(row.Qty) || 0)
  const price = Number(row.Price) || 0
  return Math.round(qty * price * 100) / 100
}

// Composable shape for setup-context callers. Same functions, one import (§5).
export function useReturnProgress () {
  return {
    RESOURCE_NAME,
    SUBMITTED,
    COMPLETED,
    CANCELLED,
    AWAITING_INVOICE_ADJUSTMENT,
    AWAITING_WAREHOUSE_RECEIPT,
    LEGACY_STATES,
    WORKFLOW_STATES,
    TERMINAL_STATES,
    IN_FLIGHT_STATES,
    PROGRESS_META,
    FALLBACK_META,
    WAREHOUSE_ACTION_META,
    STOCKED,
    DISPOSED,
    REASON_META,
    REASONS,
    REASON_REQUIRING_COMMENT,
    TIMELINE_EVENTS,
    isFlagged,
    progressOf,
    progressColor,
    progressIcon,
    progressLabel,
    reasonLabel,
    reasonIcon,
    warehouseActionLabel,
    warehouseActionColor,
    warehouseActionIcon,
    isActiveRow,
    isSubmitted,
    isCompleted,
    isCancelled,
    isTerminal,
    isOpen,
    invoiceAdjustmentRequired,
    invoiceAdjustmentDone,
    warehouseActionRequired,
    warehouseActionCompleted,
    invoiceTrackSettled,
    warehouseTrackSettled,
    isReturnCompleted,
    returnRequiresTrack,
    isEditable,
    canCancel,
    canConfirmWarehouseAction,
    canMarkInvoiceAdjusted,
    workflowStamps,
    returnValueOf,
    sortByDate
  }
}
