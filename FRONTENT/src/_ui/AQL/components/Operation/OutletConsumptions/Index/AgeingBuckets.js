import { useConsumptionIndex } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionIndex'

/**
 * OutletConsumptions › Index › AgeingBuckets — JS modifier (tier CP: resource + page).
 *
 * Ages the OUTLETS, not the records — which is the whole reason this widget looks
 * different from every other ageing band in the app.
 *
 * A restock ages in an approval queue: elapsed time is a symptom of a human not deciding.
 * A consumption has no such queue; it is recorded and it is done. What actually accrues
 * risk here is the outlet that has not been VISITED — stock sitting uncounted, sales
 * unbilled, and nobody aware of it because there is no record to age. So the bands count
 * active outlets by how far past their audit cadence they are.
 *
 * BANDED RELATIVE TO EACH OUTLET'S OWN CADENCE, not on a fixed day scale:
 *
 *     On Schedule       ≤ F
 *     Slightly Overdue  F  → +30%
 *     Overdue           +30% → +70%
 *     Critical          +70% and beyond
 *
 * A weekly outlet and a monthly one therefore land in the same band when each is equally
 * late in proportion — which a fixed 1/3/7-day table could not express, and which is why
 * the scale is a function of `F` in the domain vocabulary rather than an array literal
 * here (UI_MODULE_DEVELOPER_GUIDE §4.5, §9.2). The same function paints any per-row
 * urgency colour, so a row in the red band cannot carry an amber chip.
 *
 * `F` itself is never guessed: it is the outlet's `OutletOperatingRules.VisitFrequencyDays`
 * when it has one, and otherwise the backend's configured default. An outlet with no
 * cadence configured anywhere is left UNCOUNTED rather than assigned a band on no
 * evidence — the aggregate returns a `null` band for it and the loop skips it.
 *
 * DELIBERATELY UNGATED, unlike the restock module's approval-queue ageing. That widget is
 * addressed to an approver and is merely an anxiety to a requester who cannot act on it.
 * This one is addressed to whoever visits outlets, which is the same person reading this
 * page — the resource's own read permission is the only gate that applies.
 *
 * Empty buckets are kept and dimmed by the section base: the bands are a fixed scale, and
 * "0 Critical" is the reassuring half of the reading. The section still hides itself
 * entirely when every band is zero.
 *
 * `items` is function-valued — a JS modifier resolves once and is cached, so only a
 * closure sees the settled store.
 */
export default function () {
  return {
    title: 'Outlet Consumption Ageing',
    items: () => {
      const { ageingBuckets } = useConsumptionIndex()
      // Already banded and counted by the ONE aggregate every widget on this page reads,
      // so the "3 overdue outlets" metric card and this widget's amber+red bands are the
      // same outlets counted twice, never two independent derivations (§7.4).
      return ageingBuckets.value
    }
  }
}
