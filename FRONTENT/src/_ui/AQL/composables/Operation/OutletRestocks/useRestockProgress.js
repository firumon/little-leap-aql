/**
 * OutletRestocks › progress vocabulary.
 *
 * The progress states a restock request can be in, the predicates that decide what is
 * safe to do with it, and the per-view row presets the Index page renders them through.
 * Resource-specific workflow rules belong here (under `_ui/`), so the pages and
 * components never re-derive "can this be edited?" from booleans scattered across the
 * feature.
 *
 * Named PURE exports — importable from a page contract or a JS modifier; the composable
 * wrapper exists for setup-context callers (AQL_CUSTOM_UI_GUIDE §2.2). Nothing here
 * injects, holds reactive state, or touches a store: `pages/Operation/OutletRestocks/
 * Index.js` is evaluated outside any component setup and could not call it if it did.
 *
 * ISOLATION: the only imports are `src/utils/` helpers. Sorting and day maths are shared
 * utilities, NOT borrowed from `useVisitProgress` — a `_ui/` composable importing another
 * resource's composable is the cross-resource dependency ARCHITECTURE RULES §5 forbids.
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

/** Every request state, in the order a request walks through them. */
export const WORKFLOW_STATES = [
  DRAFT,
  PENDING_APPROVAL,
  REVISION_REQUIRED,
  APPROVED,
  PARTIALLY_DELIVERED,
  DELIVERED,
  REJECTED
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
 * `DELIVERED` and `REJECTED` have no outgoing transition in `AdditionalActions`
 * (`GAS/syncAppResources.gs`): nothing acts on a request in either state again.
 */
export const TERMINAL_STATES = [DELIVERED, REJECTED]

/**
 * The states a request is still MOVING through.
 *
 * `WORKFLOW_STATES` minus the terminal pair, and the distinction matters wherever the
 * question is "what is outstanding?" rather than "what has this resource ever held?".
 * Terminal records accumulate forever, so including them makes any proportional reading
 * of the live pipeline drift towards history as the sheet ages.
 */
export const IN_FLIGHT_STATES = WORKFLOW_STATES.filter((state) => !TERMINAL_STATES.includes(state))

/** Whether a row has come to rest — delivered or rejected. */
export function isTerminal (row) {
  return TERMINAL_STATES.includes(progressOf(row))
}

// ─── Presentation ─────────────────────────────────────────────────────────────
//
// Kept in step with `useRestockView.js`'s `PROGRESS_META`, which is the View page's
// copy of the same vocabulary and additionally covers the ITEM-row states
// (PENDING / ALLOCATED / CANCELLED) this file has no use for. A state added to
// `Constants.gs` must land in both.

export const PROGRESS_COLORS = {
  [DRAFT]: 'grey-7',
  [PENDING_APPROVAL]: 'warning',
  [REVISION_REQUIRED]: 'orange',
  [APPROVED]: 'primary',
  [PARTIALLY_DELIVERED]: 'info',
  [DELIVERED]: 'positive',
  [REJECTED]: 'negative'
}

export const PROGRESS_ICONS = {
  [DRAFT]: 'edit_note',
  [PENDING_APPROVAL]: 'schedule',
  [REVISION_REQUIRED]: 'undo',
  [APPROVED]: 'check_circle',
  [PARTIALLY_DELIVERED]: 'local_shipping',
  [DELIVERED]: 'local_shipping',
  [REJECTED]: 'cancel'
}

export const PROGRESS_LABELS = {
  [DRAFT]: 'Draft',
  [PENDING_APPROVAL]: 'Pending Approval',
  [REVISION_REQUIRED]: 'Revision Required',
  [APPROVED]: 'Approved',
  [PARTIALLY_DELIVERED]: 'Partially Delivered',
  [DELIVERED]: 'Delivered',
  [REJECTED]: 'Rejected'
}

/**
 * The workflow stamp PREFIX each state writes.
 *
 * The prefix is carried rather than derived because the two genuinely differ: submitting
 * for approval moves the request to `PENDING_APPROVAL` but stamps `ProgressSubmitted*`
 * (Documents/OPERATION_SHEET_STRUCTURE.md). Deriving the column from the state would
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
  [REJECTED]: 'ProgressRejected'
}

// ─── Progress vocabulary ──────────────────────────────────────────────────────

/** Normalized Progress value, tolerant of casing and stray whitespace from the sheet. */
export function progressOf (row) {
  return String(row?.Progress ?? '').trim().toUpperCase()
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
  return PROGRESS_COLORS[String(state ?? '').trim().toUpperCase()] || 'grey-6'
}

export function progressIcon (state) {
  return PROGRESS_ICONS[String(state ?? '').trim().toUpperCase()] || 'help_outline'
}

export function progressLabel (state) {
  const raw = String(state ?? '').trim().toUpperCase()
  // An unmapped-but-present state states itself rather than reading as blank.
  return PROGRESS_LABELS[raw] || raw || '—'
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

/** Approved or partially delivered — there is still stock owed to the outlet. */
export function isAwaitingDelivery (row) {
  return AWAITING_DELIVERY.includes(progressOf(row))
}

// ─── Row readers ──────────────────────────────────────────────────────────────

/** Outlet display name, falling back through the relation getter to the raw code. */
export function outletName (row) {
  return row?.$outlet?.Name || row?.OutletCode || row?.Code || ''
}

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
 * from a page contract (ARCHITECTURE RULES §5).
 */
export function isOwnedBy (row, userId) {
  const me = String(userId ?? '').trim()
  if (!me) return false
  const createdBy = String(row?.CreatedBy ?? '').trim()
  const requestedBy = String(row?.RequestedUser ?? '').trim()
  return createdBy === me || requestedBy === me
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
 *
 * PURE — the caller supplies the id, so this file still imports no store.
 */
export function countsForUser (row, userId) {
  return !!row && isActiveRow(row) && !isForeignDraft(row, userId)
}

/** Joins with a bullet, dropping blanks so no separator is ever left dangling. */
export function joinParts (parts) {
  return (parts || []).filter((part) => String(part ?? '').trim()).join(' • ')
}

/**
 * One workflow stamp as `{ at, by, comment }`.
 *
 * @param {Object} row
 * @param {string} prefix - e.g. `'ProgressSubmitted'`; see `PROGRESS_STAMP_PREFIX`.
 */
export function stampOf (row, prefix) {
  const key = String(prefix ?? '').trim()
  if (!key) return { at: '', by: '', comment: '' }
  return {
    at: String(row?.[`${key}At`] ?? '').trim(),
    by: String(row?.[`${key}By`] ?? '').trim(),
    comment: String(row?.[`${key}Comment`] ?? '').trim()
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
  return stamp.at || String(row?.Date ?? '').trim() || row?.CreatedAt || ''
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

/** Human age label — "Today", "Yesterday", "6 days". Blank when unknown. */
export function ageLabel (days) {
  if (days === null || days === undefined || Number.isNaN(days)) return ''
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days`
}

/**
 * Age badge colour, on the same thresholds as the ageing buckets: a request answered
 * inside a day is healthy, a week old is overdue.
 */
export function ageColor (days) {
  if (days === null || days === undefined || Number.isNaN(days)) return 'grey-6'
  if (days <= 1) return 'positive'
  if (days <= 3) return 'info'
  if (days <= 7) return 'warning'
  return 'negative'
}

// ─── Row presets for the Index list views ─────────────────────────────────────
//
// Consumed from the page contract's `Props<Identity>` blocks (`PropsListDrafts`,
// `PropsListApproved`, …) rather than from standalone `List<View>.js` modifier files —
// a plain prop bag does not need its own file (AQL_CUSTOM_UI_GUIDE.md §8.4). The three
// views that DO carry row actions keep their own file, because a `btn` is a component
// value and belongs beside the component it mounts.
//
// Every meta slot a preset does NOT want is set to an explicit null / [] rather than
// omitted: `useListStrategy` supplies chip / metaLabel / metaCaption defaults, and
// `contents/List.vue` layers explicit props OVER that baseline — so an omitted key lets
// the strategy default through instead of suppressing it.

/**
 * The shared skeleton: outlet name over a caption, aged in the meta column.
 *
 * `column` is passed a READER (`settledAt`) rather than a column name by every preset
 * whose chip shows an age. That is deliberate — see `awaitingApprovalPreset`: sorting on
 * the bare stamp column while labelling with `settledAt`'s fallback chain lets the order
 * and the labels disagree on rows whose stamp was never written.
 */
function agedPreset (items, { column, direction, caption, extra = {} }) {
  return {
    items: sortByDate(items, column, direction),
    layout: ['label', 'caption'],
    label: outletName,
    caption,
    metaLayout: ['chip'],
    chip: (row) => ageLabel(daysSince(settledAt(row))),
    chipColor: (row) => ageColor(daysSince(settledAt(row))),
    chipOutline: true,
    meta: null,
    badge: null,
    metaLabel: null,
    metaCaption: null,
    highlightColor: (row) => progressColor(progressOf(row)),
    ...extra
  }
}

/**
 * "My Drafts" — newest first; an unfinished draft is the one just left.
 *
 * The caption is the DATE alone. A draft's `ProgressSubmittedComment` is a note the
 * requester is still composing for an approver who has not seen the request yet — it is
 * neither a status nor a fact about the row, so it does not earn a line in a list whose
 * job is "which draft was I working on?".
 *
 * The view is titled "My Drafts" and now means it. `userId` filters the rows down to the
 * signed-in user's own, which the sheet-side filter cannot do — `RecordAccessPolicy:
 * OWNER_AND_UPLINE` deliberately shows a manager their reports' rows, so a manager was
 * being offered a list of other people's unfinished drafts under the word "My". Those
 * rows are also the ones they can do least with: a draft is editable by its creator
 * alone, so every borrowed row was a dead end.
 *
 * Omitting `userId` leaves the list unfiltered rather than empty, so a caller that has no
 * session to hand (a test, a preview) still renders something honest.
 */
export function draftsPreset (items, userId = null) {
  const own = userId ? (Array.isArray(items) ? items : []).filter((row) => isOwnedBy(row, userId)) : items

  return agedPreset(own, {
    column: settledAt,
    direction: 'desc',
    caption: (row) => row.Date
  })
}

/**
 * "Awaiting Approval" — OLDEST first: the longest wait is the most urgent.
 *
 * Sorted by `settledAt`, the same reader the age chip displays, NOT by
 * `ProgressSubmittedAt` directly. Not every pending row carries that stamp (a request
 * migrated in, or submitted before the stamp existed), and sorting on the bare column
 * sinks all of those to the end however old they are — so the list would show "85 days"
 * below "Yesterday" while claiming to be ordered by age.
 */
export function awaitingApprovalPreset (items) {
  return agedPreset(items, {
    column: settledAt,
    direction: 'asc',
    caption: (row) => joinParts([row.RequestedUser, stampOf(row, 'ProgressSubmitted').comment])
  })
}

/**
 * "Needs Revision" — oldest first, and the caption carries the REVIEWER's instructions
 * rather than the requester's own note: that text is the whole reason the row is here.
 */
export function needsRevisionPreset (items) {
  return agedPreset(items, {
    column: settledAt,
    direction: 'asc',
    caption: (row) => stampOf(row, 'ProgressRevisionRequired').comment
  })
}

/** "Approved" — oldest first; approved stock is committed and owed to the outlet. */
export function approvedPreset (items) {
  return agedPreset(items, {
    column: settledAt,
    direction: 'asc',
    caption: (row) => joinParts([row.Date, stampOf(row, 'ProgressApproved').by])
  })
}

/** "Partially Delivered" — oldest first; the remainder is still outstanding. */
export function partiallyDeliveredPreset (items) {
  return agedPreset(items, {
    column: settledAt,
    direction: 'asc',
    caption: (row) => joinParts([row.Date, stampOf(row, 'ProgressDelivered').comment])
  })
}

/**
 * "Pending Completion" — the combined fulfilment queue.
 *
 * Rows here are of two different states, so the meta column states WHICH rather than
 * repeating the age the section divider already groups by. `ListPendingCompletion.vue`
 * splits and re-sorts the rows itself; this preset supplies the row presentation both of
 * its groups share.
 */
export function pendingCompletionPreset (items) {
  return agedPreset(items, {
    column: settledAt,
    direction: 'asc',
    caption: (row) => joinParts([row.Date, outletCaptionFor(row)]),
    extra: {
      metaLayout: ['chip', 'caption'],
      chip: (row) => progressLabel(progressOf(row)),
      chipColor: (row) => progressColor(progressOf(row)),
      metaCaption: (row) => ageLabel(daysSince(settledAt(row)))
    }
  })
}

/** The stamp that best explains a fulfilment row's current position. */
function outletCaptionFor (row) {
  return isPartiallyDelivered(row)
    ? stampOf(row, 'ProgressDelivered').comment
    : stampOf(row, 'ProgressApproved').comment
}

/**
 * "Delivered" — most recently completed first; this is a history list.
 *
 * Sorted and captioned through `settledAt`, like every other preset: a delivery
 * migrated in without a `ProgressDeliveredAt` stamp then sorts on its `Date` instead of
 * sinking, undated, to the bottom of a list that claims to be newest-first.
 */
export function deliveredPreset (items) {
  return agedPreset(items, {
    column: settledAt,
    direction: 'desc',
    caption: (row) => joinParts([row.Date, stampOf(row, 'ProgressDelivered').by]),
    extra: {
      // A settled row's age is history, not a queue position, so it loses the colour-
      // coded urgency chip and keeps only the plain "how long ago" caption.
      chip: null,
      chipColor: null,
      chipOutline: undefined,
      metaLayout: ['caption'],
      metaCaption: (row) => ageLabel(daysSince(settledAt(row)))
    }
  })
}

/**
 * "Rejected" — most recent first, with the rejection reason in the body.
 *
 * The meta column carries the age, not `ProgressRejectedBy`. That column stores the
 * user CODE (`U0001`), unlike `RequestedUser` / `ProgressDeliveredBy`, which store
 * names — so it renders as an identifier nobody can read. The reason is what matters
 * here and it already has the caption; who rejected it is on the View page.
 */
export function rejectedPreset (items) {
  return agedPreset(items, {
    column: settledAt,
    direction: 'desc',
    caption: (row) => stampOf(row, 'ProgressRejected').comment,
    extra: {
      chip: null,
      chipColor: null,
      chipOutline: undefined,
      metaLayout: ['caption'],
      metaCaption: (row) => ageLabel(daysSince(settledAt(row)))
    }
  })
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
    WORKFLOW_STATES,
    AWAITING_DELIVERY,
    TERMINAL_STATES,
    IN_FLIGHT_STATES,
    isTerminal,
    PROGRESS_COLORS,
    PROGRESS_ICONS,
    PROGRESS_LABELS,
    PROGRESS_STAMP_PREFIX,
    progressOf,
    restockEditableProgress,
    progressColor,
    progressIcon,
    progressLabel,
    isDraft,
    isPendingApproval,
    isRevisionRequired,
    isApproved,
    isPartiallyDelivered,
    isDelivered,
    isRejected,
    isAwaitingDelivery,
    outletName,
    isOwnedBy,
    isActiveRow,
    isForeignDraft,
    countsForUser,
    joinParts,
    stampOf,
    settledAt,
    daysSince,
    ageLabel,
    ageColor,
    sortByDate,
    draftsPreset,
    awaitingApprovalPreset,
    needsRevisionPreset,
    approvedPreset,
    partiallyDeliveredPreset,
    pendingCompletionPreset,
    deliveredPreset,
    rejectedPreset
  }
}
