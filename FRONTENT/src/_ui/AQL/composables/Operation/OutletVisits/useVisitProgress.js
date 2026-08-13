/**
 * OutletVisits — the visit-workflow vocabulary, as a tenant composable.
 *
 * Lives under `_ui/AQL/composables/` rather than beside the components: helper logic
 * is a composable, not a loose file in a component folder (AQL_CUSTOM_UI_GUIDE.md §2.3).
 * Nothing here resolves as a placeholder, so the Vite glob registry indexes it and the
 * section / content / action resolvers ignore it.
 *
 * One definition of "what a visit's progress means" for every OutletVisits custom
 * surface — the View-page sections, the per-view list presets consumed from the page
 * contract's `Props<Identity>` blocks, and the Add/Edit gates.
 *
 * Every export is a PURE function of a record. That matters: the page contract
 * (`pages/Operation/OutletVisits/Index.js`) and the JS modifiers that consume these are
 * evaluated outside any component setup, so they cannot call a composable that injects
 * or holds reactive state. `useVisitProgress()` is offered for setup-context callers
 * that prefer the composable shape; it returns the same pure functions.
 */
import { parseAnyDate } from 'src/utils/dateHelpers'
import { sortByDate } from 'src/utils/sortHelpers'

/**
 * Re-exported, not redefined.
 *
 * Sorting rows by a date column is not visit knowledge, so the implementation lives in
 * `src/utils/sortHelpers.js` where any resource may reach it without importing another
 * resource's composable (ARCHITECTURE RULES §5). The name stays exported from here
 * because `ListOverdue.js` and `RecentVisits.vue` already import it by this path, and
 * because the presets below read better beside the rest of the visit vocabulary.
 */
export { sortByDate }

export const PLANNED = 'PLANNED'
export const COMPLETED = 'COMPLETED'
export const POSTPONED = 'POSTPONED'
export const CANCELLED = 'CANCELLED'

/** Progress values that mean the visit has been responded to. */
export const RESPONDED = [COMPLETED, POSTPONED, CANCELLED]

export const PROGRESS_COLORS = {
  [PLANNED]: 'primary',
  [COMPLETED]: 'positive',
  [POSTPONED]: 'warning',
  [CANCELLED]: 'negative'
}

export const PROGRESS_ICONS = {
  [PLANNED]: 'event_available',
  [COMPLETED]: 'task_alt',
  [POSTPONED]: 'event_repeat',
  [CANCELLED]: 'cancel'
}

/** Per-outcome comment / actor / timestamp columns, keyed by normalized Progress. */
export const PROGRESS_STAMPS = {
  [COMPLETED]: { comment: 'ProgressCompletedComment', by: 'ProgressCompletedBy', at: 'ProgressCompletedAt' },
  [POSTPONED]: { comment: 'ProgressPostponedComment', by: 'ProgressPostponedBy', at: 'ProgressPostponedAt' },
  [CANCELLED]: { comment: 'ProgressCancelledComment', by: 'ProgressCancelledBy', at: 'ProgressCancelledAt' },
  [PLANNED]: { comment: 'ProgressPlannedComment', by: 'ProgressPlannedBy', at: 'ProgressPlannedAt' }
}

// ─── Progress vocabulary ──────────────────────────────────────────────────────

/** Normalized Progress value, tolerant of casing and stray whitespace from the sheet. */
export function progressOf (row) {
  return String(row?.Progress ?? '').trim().toUpperCase()
}

export function isPlanned (row) {
  return progressOf(row) === PLANNED
}

export function isResponded (row) {
  return RESPONDED.includes(progressOf(row))
}

export function progressColor (row) {
  return PROGRESS_COLORS[progressOf(row)] || 'grey-6'
}

export function progressIcon (row) {
  return PROGRESS_ICONS[progressOf(row)] || 'help_outline'
}

/** Title-cased outcome for display; the sheet stores it upper-cased. */
export function progressLabel (row) {
  const raw = progressOf(row)
  if (!raw) return 'Unknown'
  return raw.charAt(0) + raw.slice(1).toLowerCase()
}

/** The comment the visit's CURRENT outcome carries, or '' when it has none. */
export function progressComment (row) {
  const stamp = PROGRESS_STAMPS[progressOf(row)]
  return (stamp && row?.[stamp.comment]) || ''
}

/** The user recorded against the visit's CURRENT outcome, or '' when it has none. */
export function progressBy (row) {
  const stamp = PROGRESS_STAMPS[progressOf(row)]
  return (stamp && row?.[stamp.by]) || ''
}

export function plannedComment (row) {
  return row?.ProgressPlannedComment || ''
}

/** Outlet display name, falling back through the relation getter to the raw code. */
export function outletName (row) {
  return row?.$outlet?.Name || row?.OutletCode || row?.Code || ''
}

/** Joins with a bullet, dropping blanks so no separator is ever left dangling. */
export function joinParts (parts) {
  return (parts || []).filter((part) => String(part ?? '').trim()).join(' • ')
}

// ─── Dates & delay ────────────────────────────────────────────────────────────

/** Local midnight of a parsed value, so day maths never straddles a time component. */
function midnight (value) {
  const date = parseAnyDate(value)
  return date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : null
}

/**
 * Whole-day delay between the planned visit date and the date it was responded to.
 *
 * Positive = late, 0 = same day, negative = answered early. Both sides are floored to
 * local midnight first, so a `RespondDate` carrying a time component (it is stored as
 * `YYYY-MM-DD HH:mm:ss`) never rounds a same-day response up to one day late.
 *
 * @returns {number|null} null when either side is missing or unparseable.
 */
export function respondDelayDays (row) {
  const planned = midnight(row?.Date)
  const responded = midnight(row?.RespondDate)
  if (!planned || !responded) return null
  return Math.round((responded - planned) / 86400000)
}

/**
 * Whole days from today until the visit date. Positive = future, 0 = today,
 * negative = overdue.
 *
 * @returns {number|null} null when the date is missing or unparseable.
 */
export function daysUntilVisit (row) {
  const target = midnight(row?.Date)
  if (!target) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target - today) / 86400000)
}

/**
 * Badge colour for a response delay: on time or early is positive, a short slip is a
 * warning, anything beyond five days is negative.
 */
export function delayColor (days) {
  if (days === null || days === undefined) return 'grey-6'
  if (days <= 0) return 'positive'
  if (days <= 5) return 'warning'
  return 'negative'
}

/** Human label for a response delay — "On time", "2 days late", "1 day early". */
export function delayLabel (days) {
  if (days === null || days === undefined) return ''
  if (days === 0) return 'On time'
  const magnitude = Math.abs(days)
  const noun = magnitude === 1 ? 'day' : 'days'
  return `${magnitude} ${noun} ${days > 0 ? 'late' : 'early'}`
}

/** Human label for a countdown — "Today", "Tomorrow", "4 days", "2 days overdue". */
export function countdownLabel (days) {
  if (days === null || days === undefined) return ''
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 0) {
    const overdue = Math.abs(days)
    return `${overdue} ${overdue === 1 ? 'day' : 'days'} overdue`
  }
  return `${days} days`
}

/** Countdown badge colour: overdue is negative, imminent is warning, later is neutral. */
export function countdownColor (days) {
  if (days === null || days === undefined) return 'grey-6'
  if (days < 0) return 'negative'
  if (days <= 1) return 'warning'
  return 'primary'
}

// ─── Row presets for the read-only list views ─────────────────────────────────
//
// Consumed from the page contract's `Props<Identity>` blocks (`PropsListTomorrow`,
// `PropsListCompleted`, …) rather than from standalone `List<View>.js` modifier files —
// a plain prop bag does not need its own file (AQL_CUSTOM_UI_GUIDE.md §8.4). None of
// these views carries a `btn`, so no row action cluster mounts and `contents/List.vue`'s
// default click handler opens the View page.
//
// Every meta slot each preset does NOT want is set to an explicit null / [] rather than
// omitted: `useListStrategy` supplies chip / metaLabel / metaCaption defaults, and
// `contents/List.vue` layers explicit props OVER that baseline — so an omitted key lets
// the strategy default through instead of suppressing it.

/** "Tomorrow" — outlet name over its planned comment, and nothing else. */
export function tomorrowPreset (items) {
  return {
    items: sortByDate(items, 'Date', 'asc'),
    layout: ['label', 'caption'],
    label: outletName,
    caption: plannedComment,
    metaLayout: [],
    meta: null,
    chip: null,
    chipColor: null,
    badge: null,
    metaLabel: null,
    metaCaption: null,
    highlight: false
  }
}

/**
 * "Upcomings" — the date sits in the main content column, so the meta slot carries the
 * days-remaining countdown instead of repeating it.
 */
export function upcomingsPreset (items) {
  return {
    items: sortByDate(items, 'Date', 'asc'),
    layout: ['label', 'caption', 'caption'],
    content: [outletName, (row) => row.Date, plannedComment],
    metaLayout: ['chip'],
    chip: (row) => countdownLabel(daysUntilVisit(row)),
    chipColor: (row) => countdownColor(daysUntilVisit(row)),
    chipOutline: true,
    badge: null,
    metaLabel: null,
    metaCaption: null,
    highlightColor: progressColor
  }
}

/**
 * A settled bucket (Completed / Postponed / Cancelled) — most recently answered first,
 * outcome comment in the body, and the response delay in the meta column: chip for the
 * colour-coded verdict, caption for the day distance Date → RespondDate.
 */
export function settledPreset (items) {
  return {
    items: sortByDate(items, 'RespondDate', 'desc'),
    layout: ['caption', 'label', 'caption'],
    content: [
      (row) => joinParts([row.Date, progressBy(row)]),
      outletName,
      (row) => progressComment(row)
    ],
    metaLayout: ['caption'],
    color: progressColor,
    metaCaption: (row) => delayLabel(respondDelayDays(row)),
    metaLabel: null,
    badge: null,
    highlightColor: progressColor
  }
}

/**
 * Composable shape for setup-context callers. Returns the same pure functions, so a
 * component can `const { progressColor } = useVisitProgress()` instead of importing each
 * name — behaviour is identical either way.
 */
export function useVisitProgress () {
  return {
    PLANNED,
    COMPLETED,
    POSTPONED,
    CANCELLED,
    RESPONDED,
    PROGRESS_COLORS,
    PROGRESS_ICONS,
    PROGRESS_STAMPS,
    progressOf,
    isPlanned,
    isResponded,
    progressColor,
    progressIcon,
    progressLabel,
    progressComment,
    progressBy,
    plannedComment,
    outletName,
    joinParts,
    respondDelayDays,
    daysUntilVisit,
    delayColor,
    delayLabel,
    countdownLabel,
    countdownColor,
    sortByDate,
    tomorrowPreset,
    upcomingsPreset,
    settledPreset
  }
}
