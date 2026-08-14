import { useAuth } from 'src/composables/core/useAuth'
import {
  IN_FLIGHT_STATES,
  progressOf,
  countsForUser,
  progressLabel,
  progressColor,
  progressIcon
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'

/**
 * OutletRestocks › Index › WorkflowFunnel — JS modifier (tier CP: resource + page).
 *
 * Projects every visible request onto the IN-FLIGHT workflow states, in the order a
 * request walks through them, so the bar reads left to right as the pipeline itself:
 * drafts at the head, awaiting delivery at the tail. A bulge in the middle is a
 * bottleneck.
 *
 * `DELIVERED` and `REJECTED` are excluded. They are terminal — nothing acts on a request
 * in either state again — and a funnel is a reading of what is still MOVING. Including
 * them made the bar worse over time in two ways: delivered requests accumulate forever,
 * so within a season they dominate the width and squeeze the live states into slivers,
 * and a reader looking for the bottleneck has to mentally subtract the two segments that
 * are not part of the question. The totals are not lost — `MetricCards` and the list
 * views still count them, and their own pills still open them.
 *
 * The state list, its order and its presentation all come from `useRestockProgress` —
 * the same vocabulary the list presets and the row chips read, so the funnel legend and
 * a row's own chip can never disagree about what "Partially Delivered" looks like.
 * Zero-count states are dropped by the section itself.
 *
 * Counted from `records`, not `filteredRecords`: the funnel describes the whole
 * pipeline, and would be a tautology if it only described the view already on screen.
 *
 * OTHER PEOPLE'S DRAFTS ARE SKIPPED (`countsForUser`). This is the section where that
 * rule is actually visible: `RecordAccessPolicy: OWNER_AND_UPLINE` hands a manager their
 * reports' rows, so the Draft segment was reporting requests nobody has submitted, that
 * the reader cannot approve, cannot open and cannot clear — and the `Drafts` pill next to
 * it, which IS scoped to the user, disagreed with the count. One rule now serves both.
 *
 * `items` is function-valued — a JS modifier resolves once and is cached, so only a
 * closure re-reads the store. See `MetricCards.js`, which also explains why `useAuth()`
 * is safe at module level.
 */
const { user } = useAuth()

export default function (props, { resourceRecord }) {
  return {
    title: 'Workflow Pipeline',
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const me = user.value?.id

      const counts = Object.create(null)
      for (const row of records) {
        if (!countsForUser(row, me)) continue
        const progress = progressOf(row)
        if (!progress) continue
        counts[progress] = (counts[progress] || 0) + 1
      }

      return IN_FLIGHT_STATES.map((state) => ({
        label: progressLabel(state),
        count: counts[state] || 0,
        color: progressColor(state),
        icon: progressIcon(state)
      }))
    }
  }
}
