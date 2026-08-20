/**
 * OutletRestocks › progress vocabulary — Layer 2, the resource's domain logic.
 *
 * The progress states a restock request can be in, the predicates that decide what is
 * safe to do with it, and the numeric scales any consumer bands them by. This is the
 * SINGLE source of truth for "what state is this record in, and what does that state
 * look like" — every UI that renders an OutletRestock reads it from here
 * (UI_RESOURCE_DOMAIN_LOGIC.md §3.3).
 *
 * Named PURE exports — importable from a page contract or a JS modifier; the composable
 * wrapper exists for setup-context callers (§5). Nothing here injects, holds reactive
 * state, renders, or touches a store: `pages/Operation/OutletRestocks/Index.js` is
 * evaluated outside any component setup and could not call it if it did.
 *
 * ISOLATION (§2.1): the only imports are `src/utils/` helpers. Sorting and day maths are
 * generic utilities, NOT borrowed from another resource's composable.
 */

import { daysFromToday } from 'src/utils/dateHelpers'
import { sortByDate } from 'src/utils/sortHelpers'

// Re-exported so a consumer that already imports this file for the workflow vocabulary
// does not need a second import line to sort the rows it just filtered.
export { sortByDate }

// ─── Workflow states ──────────────────────────────────────────────────────────

export const DRAFT = 'DRAFT'
export const PENDING_APPROVAL = 'PENDING_APPROVAL'
export const REVISION_REQUIRED = 'REVISION_REQUIRED'
export const APPROVED = 'APPROVED'
export const PARTIALLY_DELIVERED = 'PARTIALLY_DELIVERED'
export const DELIVERED = 'DELIVERED'
export const REJECTED = 'REJECTED'
/**
 * CANCELLED — the request was withdrawn after it existed, at any stage before delivery.
 *
 * Distinct from REJECTED, which is an APPROVER's verdict on a request awaiting approval.
 * A cancellation is the requester's or a manager's withdrawal, and it can happen to an
 * already-APPROVED request whose stock has been committed — which is why cancelling one
 * writes compensating warehouse movements (`useRestockCancellation.js`).
 */
export const CANCELLED = 'CANCELLED'

/** Every request state, in the order a request walks through them. */
export const WORKFLOW_STATES = [
  DRAFT,
  PENDING_APPROVAL,
  REVISION_REQUIRED,
  APPROVED,
  PARTIALLY_DELIVERED,
  DELIVERED,
  REJECTED,
  CANCELLED
]

/**
 * Approved but not yet fully delivered — the fulfilment work queue.
 *
 * The same pair the `PendingCompletion` list view filters on in
 * `GAS/syncAppResources.gs` and the same pair `MarkDelivered`'s `visibleWhen` offers on,
 * so the view, the row action and this predicate cannot disagree about what is
 * outstanding.
 */
export const AWAITING_DELIVERY = [APPROVED, PARTIALLY_DELIVERED]

/**
 * States a request can never leave — the two ways it stops being work.
 *
 * `DELIVERED`, `REJECTED` and `CANCELLED` have no outgoing transition in `AdditionalActions`
 * (`GAS/syncAppResources.gs`): nothing acts on a request in any of them again.
 */
export const TERMINAL_STATES = [DELIVERED, REJECTED, CANCELLED]

/**
 * The states a request is still MOVING through.
 *
 * `WORKFLOW_STATES` minus the terminal pair, and the distinction matters wherever the
 * question is "what is outstanding?" rather than "what has this resource ever held?".
 * Terminal records accumulate forever, so including them makes any proportional reading
 * of the live pipeline drift towards history as the sheet ages.
 */
export const IN_FLIGHT_STATES = WORKFLOW_STATES.filter((state) => !TERMINAL_STATES.includes(state))

/** Whether a row has come to rest — delivered, rejected or cancelled. */
export function isTerminal (row) {
  return TERMINAL_STATES.includes(progressOf(row))
}

// ─── Item-row states ──────────────────────────────────────────────────────────
//
// An `OutletRestockItems` row carries its OWN progress vocabulary
// (`OutletRestockItemProgress`), which overlaps the request's on `DELIVERED`. The two
// must never be shown differently on one screen, which is why they extend one map
// below rather than living in two.

export const ITEM_PENDING = 'PENDING'
export const ITEM_ALLOCATED = 'ALLOCATED'
export const ITEM_CANCELLED = 'CANCELLED'

// ─── The one progress vocabulary ──────────────────────────────────────────────
//
// ONE map, keyed by the raw sheet value. Previously this existed twice — here as three
// parallel COLORS/ICONS/LABELS objects and again in the View page's composable as a
// `PROGRESS_META` "kept in step" copy. A comment promising two files stay in sync is the
// tell that they should have been one file (§3.3), so the copy is gone and its extra
// item-row states extend this map instead.

export const PROGRESS_META = {
  [DRAFT]: { label: 'Draft', color: 'grey-7', icon: 'edit_note' },
  [PENDING_APPROVAL]: { label: 'Pending Approval', color: 'warning', icon: 'schedule' },
  [REVISION_REQUIRED]: { label: 'Revision Required', color: 'orange', icon: 'undo' },
  [APPROVED]: { label: 'Approved', color: 'primary', icon: 'check_circle' },
  [PARTIALLY_DELIVERED]: { label: 'Partially Delivered', color: 'info', icon: 'local_shipping' },
  [DELIVERED]: { label: 'Delivered', color: 'positive', icon: 'local_shipping' },
  [REJECTED]: { label: 'Rejected', color: 'negative', icon: 'cancel' },
  [CANCELLED]: { label: 'Cancelled', color: 'negative', icon: 'block' }
}

/**
 * The request vocabulary PLUS the item-row states — exactly §3.3's extension shape.
 *
 * A View card renders both a request's Progress and its item rows' Progress on one
 * screen, so it reads this map and gets the shared `DELIVERED` entry from the same
 * definition the request chip uses.
 */
export const ITEM_ROW_META = {
  ...PROGRESS_META,
  [ITEM_PENDING]: { label: 'Pending', color: 'warning', icon: 'schedule' },
  [ITEM_ALLOCATED]: { label: 'Allocated', color: 'primary', icon: 'inventory_2' },
  [ITEM_CANCELLED]: { label: 'Cancelled', color: 'negative', icon: 'block' }
}

/** What an unmapped state renders as. Its `label` is only ever reached for a BLANK state. */
export const FALLBACK_META = { label: '—', color: 'grey-6', icon: 'help_outline' }

/**
 * Back-compatible flat projections of the one map.
 *
 * Kept as exports because consumers import them by name; they are now DERIVED, so there
 * is still exactly one place a state's colour is written down.
 */
export const PROGRESS_COLORS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.color]))
export const PROGRESS_ICONS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.icon]))
export const PROGRESS_LABELS = Object.fromEntries(
  Object.entries(PROGRESS_META).map(([state, meta]) => [state, meta.label]))

/**
 * The workflow stamp PREFIX each state writes.
 *
 * The prefix is carried rather than derived because the two genuinely differ: submitting
 * for approval moves the request to `PENDING_APPROVAL` but stamps `ProgressSubmitted*`
 * (Documents/SHEET_OPERATION_STRUCTURE.md). Deriving the column from the state would
 * silently read a column that does not exist. `DRAFT` has no stamp — nothing happened
 * yet — and `PARTIALLY_DELIVERED` shares the delivery stamp, which is rewritten on each
 * partial drop, so it is genuinely the last thing that happened to the request.
 */
export const PROGRESS_STAMP_PREFIX = {
  [PENDING_APPROVAL]: 'ProgressSubmitted',
  [REVISION_REQUIRED]: 'ProgressRevisionRequired',
  [APPROVED]: 'ProgressApproved',
  [PARTIALLY_DELIVERED]: 'ProgressDelivered',
  [DELIVERED]: 'ProgressDelivered',
  [REJECTED]: 'ProgressRejected',
  [CANCELLED]: 'ProgressCancelled'
}

/**
 * The workflow stamp COLUMNS, in the order the request walks through them.
 *
 * A subset of `PROGRESS_STAMP_PREFIX` with a human title, and deliberately NOT derived
 * from it: `PARTIALLY_DELIVERED` shares `DELIVERED`'s prefix, so deriving would list the
 * same stamp twice on the timeline.
 */
export const WORKFLOW_STAMPS = [
  { state: PENDING_APPROVAL, prefix: 'ProgressSubmitted', title: 'Submitted for Approval' },
  { state: REVISION_REQUIRED, prefix: 'ProgressRevisionRequired', title: 'Sent Back for Revision' },
  { state: APPROVED, prefix: 'ProgressApproved', title: 'Approved' },
  { state: REJECTED, prefix: 'ProgressRejected', title: 'Rejected' },
  { state: DELIVERED, prefix: 'ProgressDelivered', title: 'Delivered' },
  { state: CANCELLED, prefix: 'ProgressCancelled', title: 'Cancelled' }
]

// ─── Progress vocabulary ──────────────────────────────────────────────────────

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})

/** Normalized Progress value, tolerant of casing and stray whitespace from the sheet. */
export function progressOf (row) {
  return text(row?.Progress).toUpperCase()
}

// A restock may be edited only while it is a Draft or has come back for Revision
// Required. Every other state (Pending Approval, Approved, Rejected, …) is a settled
// workflow stamp: editing it would rewrite what approvers already saw or decided.
//
// Takes a PROGRESS VALUE, not a row — unchanged since `ResourceActionEdit.js` and
// `useRestockEditForm.js` already call it that way.
export function restockEditableProgress (progress) {
  return progress === DRAFT || progress === REVISION_REQUIRED
}

/**
 * Presentation lookups. These take a STATE STRING rather than a row, so a caller
 * holding only a bucket key (the funnel legend, an ageing header) can use them too;
 * `progressOf(row)` bridges the gap for callers holding a record.
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
 * The same three lookups over `ITEM_ROW_META`, for a screen that renders request states
 * and item-row states side by side.
 *
 * Normalization matches the View page's previous behaviour exactly: the raw sheet value
 * is trimmed but NOT upper-cased, because an item Progress is written by this app's own
 * payload builders and is already canonical.
 */
export function itemProgressColor (state) {
  return ITEM_ROW_META[text(state)]?.color || FALLBACK_META.color
}

export function itemProgressIcon (state) {
  return ITEM_ROW_META[text(state)]?.icon || FALLBACK_META.icon
}

export function itemProgressLabel (state) {
  // An unmapped-but-present state states itself rather than reading as blank.
  return ITEM_ROW_META[text(state)]?.label || text(state) || FALLBACK_META.label
}

// ─── Row predicates ───────────────────────────────────────────────────────────

export function isDraft (row) {
  return progressOf(row) === DRAFT
}

export function isPendingApproval (row) {
  return progressOf(row) === PENDING_APPROVAL
}

export function isRevisionRequired (row) {
  return progressOf(row) === REVISION_REQUIRED
}

export function isApproved (row) {
  return progressOf(row) === APPROVED
}

export function isPartiallyDelivered (row) {
  return progressOf(row) === PARTIALLY_DELIVERED
}

export function isDelivered (row) {
  return progressOf(row) === DELIVERED
}

export function isRejected (row) {
  return progressOf(row) === REJECTED
}

export function isCancelled (row) {
  return progressOf(row) === CANCELLED
}

/** Approved or partially delivered — there is still stock owed to the outlet. */
export function isAwaitingDelivery (row) {
  return AWAITING_DELIVERY.includes(progressOf(row))
}

/**
 * The states in which a request has NOT yet been approved.
 *
 * Expressed as the unapproved set rather than the approved one deliberately: the
 * approved side keeps growing (`APPROVED`, `PARTIALLY_DELIVERED`, `DELIVERED`, and
 * whatever a later delivery stage adds), while the "no allocation exists yet" side
 * is a closed list.
 */
export const UNAPPROVED_PROGRESS = [DRAFT, PENDING_APPROVAL, REVISION_REQUIRED]

/**
 * Whether stock has been COMMITTED to this request — has it passed approval at all?
 *
 * Deliberately NOT the same question as `isApproved`, which asks whether the request is
 * sitting in the `APPROVED` state exactly. A `PARTIALLY_DELIVERED` request answers `false`
 * to that and `true` to this. The allocation card asks this one: is there anything to
 * show a warehouse for?
 */
export function isApprovalCommitted (record) {
  const progress = text(asRow(record).Progress)
  return !!progress && !UNAPPROVED_PROGRESS.includes(progress)
}

// ─── Row readers ──────────────────────────────────────────────────────────────

/**
 * Whether `row` belongs to the user identified by `userId`.
 *
 * Matched on the user's CODE, not their name: `CreatedBy` is written by GAS as
 * `auth.user.UserID` (`GAS/resourceApi.gs`), and `useAuth`'s flat projection exposes that
 * same value as `user.id`. Names are neither unique nor stable, so comparing them would
 * hand one namesake another's records.
 *
 * `RequestedUser` is accepted as a second key because a request may be RAISED on someone
 * else's behalf — the person it is for owns it as much as the person who typed it.
 *
 * Fails CLOSED on a blank either side: two empties would otherwise compare equal and
 * match every unstamped row to every unidentified session.
 *
 * PURE — the caller supplies the id, so this file still imports no store and stays usable
 * from a page contract.
 */
export function isOwnedBy (row, userId) {
  const me = text(userId)
  if (!me) return false
  return text(row?.CreatedBy) === me || text(row?.RequestedUser) === me
}

/** A blank Status is Active — the sheet only writes the column when it is set. */
export function isActiveRow (row) {
  return String(row?.Status ?? 'Active').trim() === 'Active'
}

/** Someone ELSE's unfinished draft. */
export function isForeignDraft (row, userId) {
  return isDraft(row) && !isOwnedBy(row, userId)
}

/**
 * Whether a row should be counted AT ALL for `userId` — the one visibility rule every
 * Index section shares.
 *
 * Two conditions: the row is Active, and it is not another person's draft.
 *
 * The draft clause is what makes the page honest. `RecordAccessPolicy:
 * OWNER_AND_UPLINE` means a manager RECEIVES their reports' rows, drafts included, but a
 * draft is not a request yet — nobody has submitted it, nobody can approve it, and only
 * its author can even open it. Counting one in a manager's funnel reports work that does
 * not exist to anyone but the person still typing it, and the manager cannot act on it or
 * click through to it. Every other state is genuinely shared, so only DRAFT is scoped.
 *
 * A blank `userId` hides EVERY draft rather than showing them all: an unidentified
 * session owns nothing, and failing open here would leak exactly the rows this exists to
 * hide. `draftsPreset` deliberately takes the other posture, because there an absent id
 * means "no session to filter by" rather than "this session owns nothing".
 */
export function countsForUser (row, userId) {
  return !!row && isActiveRow(row) && !isForeignDraft(row, userId)
}

/**
 * One workflow stamp as `{ at, by, comment }`.
 *
 * @param {Object} row
 * @param {string} prefix - e.g. `'ProgressSubmitted'`; see `PROGRESS_STAMP_PREFIX`.
 */
export function stampOf (row, prefix) {
  const key = text(prefix)
  if (!key) return { at: '', by: '', comment: '' }
  return {
    at: text(row?.[`${key}At`]),
    by: text(row?.[`${key}By`]),
    comment: text(row?.[`${key}Comment`])
  }
}

/**
 * When the request last moved — the timestamp of the stamp its CURRENT state writes.
 *
 * This is what "how long has this been sitting here?" measures against: a request that
 * has been pending approval for nine days is nine days past its SUBMISSION, not nine
 * days past the date on the request. Falls back to `Date`, then `CreatedAt`, so a row
 * whose stamp column was never written still ages rather than reading as brand new.
 */
export function settledAt (row) {
  const stamp = stampOf(row, PROGRESS_STAMP_PREFIX[progressOf(row)])
  return stamp.at || text(row?.Date) || row?.CreatedAt || ''
}

/**
 * Whole days elapsed since a timestamp. Today is 0, yesterday is 1.
 *
 * `daysFromToday` is signed the other way round (future positive), and an age is more
 * naturally read as a positive count, so the sign is flipped here rather than at every
 * call site. NaN propagates for an unparseable stamp and every consumer below guards it.
 */
export function daysSince (stampValue) {
  return -daysFromToday(stampValue)
}

/**
 * Every workflow event that has actually happened, oldest first.
 *
 * A stamp with no actor is a stage the request never reached, and is dropped — the
 * timeline shows history, not a checklist of what could still happen. Stamps are written
 * as `toDateTime24` strings by `useRestockPayload.js`; an unparseable one sorts to the
 * end rather than poisoning the comparison with `NaN`, and keeps its raw text so a
 * malformed stamp is visible instead of silently blank.
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
        icon: itemProgressIcon(stamp.state),
        color: itemProgressColor(stamp.state),
        label: itemProgressLabel(stamp.state),
        timestamp: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
      }
    })
    .filter((event) => event.by)
    .sort((a, b) => (a.timestamp?.getTime() ?? Infinity) - (b.timestamp?.getTime() ?? Infinity))
}

// ─── The one ageing scale ─────────────────────────────────────────────────────

/**
 * The ageing bands, youngest → oldest. `max` is inclusive; the last band is open-ended.
 *
 * ONE table, because a numeric scale that a widget AND a row chip both read is one
 * exported table in the vocabulary file, not an array literal in each
 * (UI_MODULE_DEVELOPER_GUIDE.md §4.5). `ageColor` below and the Index page's
 * `AgeingBuckets` widget previously wrote the same 1/3/7 thresholds independently, so a
 * row could carry a chip in one colour while the widget counted it in another band.
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
 * `null` rather than a default band, deliberately: an unparseable stamp yields `NaN`,
 * which no band claims, and a row with no readable age must be left UNCOUNTED rather
 * than dumped into the freshest or the oldest bucket.
 */
export function ageBandOf (days) {
  if (days === null || days === undefined || Number.isNaN(days)) return null
  return AGE_BANDS.find((band) => days <= band.max) || null
}

/** Age badge colour — the band's colour, so chip and widget can never disagree. */
export function ageColor (days) {
  return ageBandOf(days)?.color || FALLBACK_META.color
}

// Composable shape for setup-context callers. Same functions, one import.
export function useRestockProgress () {
  return {
    DRAFT,
    PENDING_APPROVAL,
    REVISION_REQUIRED,
    APPROVED,
    PARTIALLY_DELIVERED,
    DELIVERED,
    REJECTED,
    CANCELLED,
    ITEM_PENDING,
    ITEM_ALLOCATED,
    ITEM_CANCELLED,
    WORKFLOW_STATES,
    AWAITING_DELIVERY,
    TERMINAL_STATES,
    IN_FLIGHT_STATES,
    UNAPPROVED_PROGRESS,
    WORKFLOW_STAMPS,
    isTerminal,
    PROGRESS_META,
    ITEM_ROW_META,
    FALLBACK_META,
    PROGRESS_COLORS,
    PROGRESS_ICONS,
    PROGRESS_LABELS,
    PROGRESS_STAMP_PREFIX,
    AGE_BANDS,
    progressOf,
    restockEditableProgress,
    progressColor,
    progressIcon,
    progressLabel,
    itemProgressColor,
    itemProgressIcon,
    itemProgressLabel,
    isDraft,
    isPendingApproval,
    isRevisionRequired,
    isApproved,
    isPartiallyDelivered,
    isDelivered,
    isRejected,
    isCancelled,
    isAwaitingDelivery,
    isApprovalCommitted,
    isOwnedBy,
    isActiveRow,
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
