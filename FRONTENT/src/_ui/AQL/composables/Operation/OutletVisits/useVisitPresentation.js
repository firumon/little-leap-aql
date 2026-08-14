/**
 * OutletVisits — presentation helpers for the AQL UI.
 *
 * Layer 3 (UI_RESOURCE_DOMAIN_LOGIC.md §4): display wording, the per-view list row
 * presets, and the outlet display name. Everything here ASSEMBLES a view from the Layer 2
 * vocabulary in `src/_resource/Operation/OutletVisits/composables/useVisitProgress.js`; it
 * never re-derives a predicate that already exists there.
 *
 * This file was previously `useVisitProgress.js` in this folder and held both halves. The
 * domain half — the PLANNED/COMPLETED/POSTPONED/CANCELLED vocabulary, the progress
 * predicates, the stamp columns, the response-delay bands — moved down to Layer 2 so every
 * UI a visit renders under reads the same answer. What stayed is what is genuinely about
 * how a visit LOOKS in this UI.
 *
 * Every export is PURE, because the page contract (`pages/Operation/OutletVisits/Index.js`)
 * and the JS modifiers that consume the presets are evaluated outside any component setup.
 */
import { sortByDate } from 'src/utils/sortHelpers'
import {
  daysUntilVisit,
  plannedComment,
  progressBy,
  progressColor,
  progressComment,
  respondDelayDays
} from 'src/_resource/Operation/OutletVisits/composables/useVisitProgress'

/** Outlet display name, falling back through the relation getter to the raw code. */
export function outletName (row) {
  return row?.$outlet?.Name || row?.OutletCode || row?.Code || ''
}

/** Joins with a bullet, dropping blanks so no separator is ever left dangling. */
export function joinParts (parts) {
  return (parts || []).filter((part) => String(part ?? '').trim()).join(' • ')
}

/**
 * Human label for a response delay — "On time", "2 days late", "1 day early".
 *
 * Presentation, not domain: this is wording for a number the domain layer already
 * produced. It deliberately does NOT read `DELAY_BANDS` — the phrasing turns on the sign
 * and magnitude of the delay, not on the service-level thresholds that colour it, so the
 * two are genuinely independent rather than two views of one table.
 */
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

/**
 * Countdown badge colour: overdue is negative, imminent is warning, later is neutral.
 *
 * Stays here rather than moving down beside `delayColor`, despite both being
 * threshold→colour functions. They read DIFFERENT scales: `delayColor` bands a settled
 * visit against the response service level (on time / within five days / beyond), which is
 * a business judgement about follow-through; this bands an UPCOMING row by how soon it
 * lands (0–1 day is imminent) purely to tint a list chip. Because there is no shared
 * threshold table between them, deriving this from `DELAY_BANDS` would invent a coupling
 * rather than remove a duplication (§3.3).
 */
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
// a plain prop bag does not need its own file (UI_MODULE_DEVELOPER_GUIDE.md §8.4). None of
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
 * component can destructure instead of importing each name — behaviour is identical.
 */
export function useVisitPresentation () {
  return {
    outletName,
    joinParts,
    delayLabel,
    countdownLabel,
    countdownColor,
    tomorrowPreset,
    upcomingsPreset,
    settledPreset
  }
}
