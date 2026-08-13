import { daysFromToday } from 'src/utils/dateHelpers'
import { useAuth } from 'src/composables/core/useAuth'
import {
  progressOf,
  countsForUser,
  PENDING_APPROVAL,
  stampOf
} from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockProgress'

/**
 * OutletRestocks › Index › AgeingBuckets — JS modifier (tier CP: resource + page).
 *
 * Ages the APPROVAL queue, and only that queue. Pending Approval is the one state where
 * nothing happens without a human deciding, so it is the one state where elapsed time is
 * a symptom rather than a fact — an approved request waiting on a delivery run is not
 * "late", it is scheduled.
 *
 * GATED ON `approve`. This section is a work queue addressed to whoever clears it: "5
 * requests have waited over a week" is an instruction to an approver and merely an
 * anxiety to a requester, who cannot act on it and is often reading their own submission
 * back as a red number. A user without the privilege gets `[]`, which trips the section's
 * strict hide rule and removes it from the page entirely rather than showing it empty.
 *
 * `allowed()` resolves `'approve'` to the `canApprove` flag GAS publishes per
 * AdditionalAction (`GAS/resourceRegistry.gs`) — the same flag that gates the
 * `PendingApproval` switcher pill and the row's Approve button, so all three appear and
 * disappear together.
 *
 * Age is measured from `ProgressSubmittedAt`, the stamp that PUT the request in this
 * queue (Documents/OPERATION_SHEET_STRUCTURE.md) — not from `Date`, which is the date the
 * requester wants stock by and may be in the future. A row whose stamp was never written
 * falls back to `Date` so it still ages rather than silently landing in the freshest band.
 *
 * Bands: 0–1 days healthy, 2–3 worth noting, 4–7 a warning, over a week overdue. The same
 * thresholds `ageColor` paints the per-row chips with, so a row sitting in the red band
 * here carries a red chip in the list.
 *
 * Rows are gated by `countsForUser`, the same predicate every other Index section uses.
 * Only PENDING_APPROVAL rows are banded, so a draft never reaches the bands regardless —
 * this is here so that all four sections state their row rule identically rather than
 * three stating it and one implying it.
 *
 * `items` is function-valued — a JS modifier resolves once and is cached. See
 * `MetricCards.js`, which also explains why `useAuth()` is safe at module level.
 */
const { user } = useAuth()

// Ordered youngest → oldest; `max` is inclusive, and the last band is open-ended.
const BANDS = [
  { label: '0–1 days', caption: 'On track', color: 'positive', max: 1 },
  { label: '2–3 days', caption: 'Watch', color: 'info', max: 3 },
  { label: '4–7 days', caption: 'Chase', color: 'warning', max: 7 },
  { label: '7+ days', caption: 'Overdue', color: 'negative', max: Infinity }
]

export default function (props, { resourceRecord, resourceConfig }) {
  return {
    title: 'Approval Queue Ageing',
    items: () => {
      // Inside the closure, not outside it: the modifier is invoked once at resolve
      // time, when the auth payload may not have landed yet, and a permission read
      // taken then would latch a `false` for the life of the page.
      if (resourceConfig?.allowed?.({ OutletRestocks: 'approve' }) !== true) return []

      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const me = user.value?.id
      const counts = BANDS.map(() => 0)

      for (const row of records) {
        if (!countsForUser(row, me)) continue
        if (progressOf(row) !== PENDING_APPROVAL) continue

        const since = stampOf(row, 'ProgressSubmitted').at || row.Date
        // `daysFromToday` is future-positive; an age is the other direction. An
        // unparseable stamp yields NaN, which no band claims — the row is left
        // uncounted rather than dumped into the freshest or the oldest band.
        const age = -daysFromToday(since)
        if (Number.isNaN(age)) continue

        const index = BANDS.findIndex((band) => age <= band.max)
        if (index >= 0) counts[index]++
      }

      return BANDS.map((band, index) => ({
        label: band.label,
        caption: band.caption,
        color: band.color,
        count: counts[index]
      }))
    }
  }
}
