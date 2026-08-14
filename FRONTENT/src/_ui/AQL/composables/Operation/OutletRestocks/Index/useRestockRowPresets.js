/**
 * OutletRestocks › Index — row presets for the eight list views. Layer 3, presentation.
 *
 * These shape rows FOR THE LIST COMPONENT: which fields form the label and caption, what
 * the meta column shows, which direction each view sorts in. That is display assembly,
 * not a business rule, so it stays under `_ui/` and calls INTO the domain layer for every
 * derived value it renders (UI_RESOURCE_DOMAIN_LOGIC.md §4).
 *
 * Not one predicate is re-derived here: `settledAt`, `progressColor`, `ageColor`,
 * `stampOf` and the state constants all come from
 * `src/_resource/Operation/OutletRestocks/composables/useRestockProgress`, so a row chip
 * and the Index widget above it read the same vocabulary and the same ageing scale.
 *
 * Consumed from the page contract's `Props<Identity>` blocks (`PropsListDrafts`,
 * `PropsListApproved`, …) rather than from standalone `List<View>.js` modifier files —
 * a plain prop bag does not need its own file (UI_MODULE_DEVELOPER_GUIDE.md §8.4). The three
 * views that DO carry row actions keep their own file, because a `btn` is a component
 * value and belongs beside the component it mounts.
 *
 * Every meta slot a preset does NOT want is set to an explicit null / [] rather than
 * omitted: `useListStrategy` supplies chip / metaLabel / metaCaption defaults, and
 * `contents/List.vue` layers explicit props OVER that baseline — so an omitted key lets
 * the strategy default through instead of suppressing it.
 *
 * Named PURE exports — importable from the page contract, which is evaluated outside any
 * component setup; the composable wrapper follows for setup-context callers (§2.2).
 */

import {
  sortByDate,
  settledAt,
  stampOf,
  daysSince,
  ageColor,
  progressOf,
  progressColor,
  progressLabel,
  isPartiallyDelivered,
  isOwnedBy
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'

/** Outlet display name, falling back through the relation getter to the raw code. */
export function outletName (row) {
  return row?.$outlet?.Name || row?.OutletCode || row?.Code || ''
}

/** Joins with a bullet, dropping blanks so no separator is ever left dangling. */
export function joinParts (parts) {
  return (parts || []).filter((part) => String(part ?? '').trim()).join(' • ')
}

/** Human age label — "Today", "Yesterday", "6 days". Blank when unknown. */
export function ageLabel (days) {
  if (days === null || days === undefined || Number.isNaN(days)) return ''
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days`
}

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
export function useRestockRowPresets () {
  return {
    outletName,
    joinParts,
    ageLabel,
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
