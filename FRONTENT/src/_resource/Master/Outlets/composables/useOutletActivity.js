/**
 * Outlets › activity vocabulary — Layer 2, the resource's domain logic.
 *
 * An outlet has no `Progress` column, so "what state is this record in" is not a workflow
 * question here — it is an ACTIVITY question: when did anything last happen at this outlet,
 * and across which of the five operational streams. This file is the single definition of
 * that vocabulary (UI_RESOURCE_DOMAIN_LOGIC.md §3.3): the streams, the two time windows, the
 * ageing bands, and the pure predicates every widget, chip and list preset reads from.
 *
 * Named PURE exports — importable from a page contract or a JS modifier, both of which are
 * evaluated outside any component setup. The `useOutletActivity()` wrapper exists for
 * setup-context callers (§5).
 *
 * ISOLATION (§2.1): imports only `src/utils/` helpers and the generic `useResourceConfig`
 * Core Composable. No store, no service, nothing under `_ui/`, no `inject()`, no `ref()`.
 *
 * SELF-IDENTIFYING (§3.2): the resource name is a module constant. Every export takes
 * `record`/`records` only — never a `config`.
 */

import { daysFromToday } from 'src/utils/dateHelpers'
import { useResourceConfig } from 'src/composables/resources/useResourceConfig'

// This composable IS Outlets — always. Never route-derived (§3.2).
const RESOURCE_NAME = 'Outlets'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})

// ─── Time windows ─────────────────────────────────────────────────────────────
//
// TWO windows, deliberately different sizes, because they answer two different questions.
//
// `VISIT_WINDOW_DAYS` is a FIELD-ROUTE window: "who did the rep see this week, and who is
// on the list for next week". A fortnight of visits is not a route — it is a report.
//
// `ACTIVITY_WINDOW_DAYS` is a RELATIONSHIP window: an outlet that has ordered, been billed
// or paid inside a month is a live account. It is deliberately wider, because a healthy
// outlet on a 14-day visit cadence (the `OutletOperatingRules` default) would otherwise
// flip in and out of "active" between two ordinary visits.

/** How far forward and back the visit queues on the Index page look. */
export const VISIT_WINDOW_DAYS = 7

/** How long an outlet may go silent across ALL five streams before it counts as stale. */
export const ACTIVITY_WINDOW_DAYS = 30

// ─── The five operational streams ─────────────────────────────────────────────
//
// One outlet's life touches five resources. Each entry names the resource, the date column
// that stamps an event on it, and the label a card uses for that stream — so a caller never
// has to remember that a visit is dated by `Date` while a movement is dated by
// `MovementDate`. Adding a sixth stream is one entry here, not a sweep through the widgets.

export const ACTIVITY_STREAMS = [
  { key: 'visit', resource: 'OutletVisits', dateColumn: 'Date', label: 'Visit', icon: 'event_available' },
  { key: 'restock', resource: 'OutletRestocks', dateColumn: 'Date', label: 'Restock', icon: 'inventory_2' },
  { key: 'consumption', resource: 'OutletConsumptions', dateColumn: 'Date', label: 'Consumption', icon: 'point_of_sale' },
  { key: 'invoice', resource: 'OutletConsumptionInvoices', dateColumn: 'Date', label: 'Invoice', icon: 'receipt_long' },
  { key: 'payment', resource: 'OutletPayments', dateColumn: 'Date', label: 'Payment', icon: 'payments' }
]

/** The stream keys, in the order an outlet's life actually runs through them. */
export const ACTIVITY_STREAM_KEYS = ACTIVITY_STREAMS.map((stream) => stream.key)

// ─── Ageing bands ─────────────────────────────────────────────────────────────
//
// ONE table (UI_MODULE_DEVELOPER_GUIDE.md §9.2). The colour a "days since last activity"
// chip carries on a list row and the colour any future ageing widget bands by are derived
// from these same entries, so the two can never split when a threshold is tuned.

export const ACTIVITY_BANDS = [
  { label: 'This week', caption: 'Fresh', color: 'positive', max: 7 },
  { label: '8–14 days', caption: 'Watch', color: 'info', max: 14 },
  { label: '15–30 days', caption: 'Cooling', color: 'warning', max: ACTIVITY_WINDOW_DAYS },
  { label: '30+ days', caption: 'Stale', color: 'negative', max: Infinity }
]

/** The band colour for a given age in days; grey when the age is unknown. */
export function activityColor (days) {
  if (days === null || days === undefined) return 'grey-6'
  return ACTIVITY_BANDS.find((band) => days <= band.max)?.color ?? 'grey-6'
}

/** "Today" / "3 days ago" / "Never" — the wording every row and card uses for an age. */
export function activityLabel (days) {
  if (days === null || days === undefined) return 'Never'
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Whole days between a stamp and today — positive in the past, negative in the future.
 *
 * `null` for a blank or unparseable stamp, which is a real state (an outlet nobody has ever
 * visited) and must stay distinguishable from "zero days ago".
 */
export function ageInDays (value) {
  const stamp = text(value)
  if (!stamp) return null
  const days = daysFromToday(stamp)
  return Number.isFinite(days) ? -days : null
}

/** Whether a stamp falls inside the last `windowDays` days, today included. */
export function withinPastDays (value, windowDays) {
  const days = ageInDays(value)
  return days !== null && days >= 0 && days <= windowDays
}

/** Whether a stamp falls inside the next `windowDays` days, today included. */
export function withinNextDays (value, windowDays) {
  const days = ageInDays(value)
  return days !== null && days <= 0 && Math.abs(days) <= windowDays
}

// ─── Row predicates ───────────────────────────────────────────────────────────

/** A sheet row that has not been archived. A blank `Status` is treated as Active. */
export function isActiveRow (row) {
  const status = text(asRow(row).Status)
  return !status || status.toUpperCase() === 'ACTIVE'
}

/**
 * Whether an outlet's activity summary makes it a LIVE account.
 *
 * The summary is the `{ lastActivityAt, lastActivityDays }` shape `useOutletIndex` builds;
 * the rule — any one of the five streams inside `ACTIVITY_WINDOW_DAYS` — lives here so the
 * progress card, the "No Updates" pill and any later widget cannot disagree about it.
 */
export function isActiveOutlet (summary) {
  const days = asRow(summary).lastActivityDays
  return days !== null && days !== undefined && days <= ACTIVITY_WINDOW_DAYS
}

/** The complement of `isActiveOutlet` — including outlets that never had any event at all. */
export function isStaleOutlet (summary) {
  return !isActiveOutlet(summary)
}

// ─── Permission gates ─────────────────────────────────────────────────────────

const gate = () => useResourceConfig(RESOURCE_NAME)

/** Whether the signed-in user may create an outlet. */
export function canCreateOutlet () {
  return !!gate().allowed({ outlet: 'create' })
}

// ─── Composable wrapper ───────────────────────────────────────────────────────

export function useOutletActivity () {
  return {
    VISIT_WINDOW_DAYS,
    ACTIVITY_WINDOW_DAYS,
    ACTIVITY_STREAMS,
    ACTIVITY_STREAM_KEYS,
    ACTIVITY_BANDS,
    activityColor,
    activityLabel,
    ageInDays,
    withinPastDays,
    withinNextDays,
    isActiveRow,
    isActiveOutlet,
    isStaleOutlet,
    canCreateOutlet
  }
}
