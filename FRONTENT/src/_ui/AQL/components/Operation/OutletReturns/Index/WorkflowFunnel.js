import {
  IN_FLIGHT_STATES,
  isActiveRow,
  isOpen,
  progressOf,
  progressLabel,
  progressColor,
  progressIcon
} from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

/**
 * OutletReturns › Index › WorkflowFunnel — JS modifier (tier CP: resource + page).
 *
 * Projects every visible return onto the IN-FLIGHT states, so the bar reads as the
 * reconciliation pipeline itself. A bulge in one segment is a bottleneck with an owner:
 * `Awaiting Invoice Credit` is finance's, `Awaiting Warehouse Receipt` is logistics'.
 *
 * `COMPLETED` and `CANCELLED` are excluded. They are terminal — nothing acts on a return
 * in either state again — and a funnel is a reading of what is still MOVING. Including
 * them would make the bar worse over time: settled returns accumulate forever, so within a
 * season they would dominate the width and squeeze the live states into slivers, and a
 * reader looking for the bottleneck would have to mentally subtract the two segments that
 * are not part of the question. The totals are not lost — the `Completed` and `Cancelled`
 * pills still open them.
 *
 * ── WHY THE LEGACY STATES APPEAR HERE ──
 * `IN_FLIGHT_STATES` carries all three non-terminal states, including the two the
 * consumption path has been writing for as long as it has existed. This module writes only
 * `SUBMITTED`, but the funnel must describe the sheet as it actually is, not as this
 * module would have written it. Zero-count segments are dropped by the section itself, so
 * once no legacy rows remain the bar quietly becomes single-segment with no code change.
 *
 * The state list, its order and its presentation all come from `useReturnProgress` — the
 * same vocabulary the row chips read, so the funnel legend and a row's own chip can never
 * disagree about what a state looks like.
 *
 * Counted from `records`, not `filteredRecords`: the funnel describes the whole pipeline,
 * and would be a tautology if it only described the view already on screen.
 *
 * `items` is function-valued — a JS modifier resolves once and is cached, so only a
 * closure re-reads the store. See `MetricCards.js`.
 */
export default function (props, { resourceRecord }) {
  return {
    title: 'Reconciliation Pipeline',
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const counts = Object.create(null)
      let open = 0
      for (const row of records) {
        if (!isActiveRow(row)) continue
        // Only unresolved returns are counted at all — a completed or cancelled row is
        // history and has no place in a reading of what is still moving.
        if (!isOpen(row)) continue
        open++
        const progress = progressOf(row)
        if (!progress) continue
        counts[progress] = (counts[progress] || 0) + 1
      }

      // The whole widget disappears when nothing is unresolved. The section's own hide rule
      // would eventually reach the same result by dropping every zero segment, but stating
      // it here makes the intent explicit and survives a future segment that is not derived
      // from a count (§9.2 rule 2).
      if (!open) return []

      return IN_FLIGHT_STATES.map((state) => ({
        label: progressLabel(state),
        count: counts[state] || 0,
        color: progressColor(state),
        icon: progressIcon(state)
      }))
    }
  }
}
