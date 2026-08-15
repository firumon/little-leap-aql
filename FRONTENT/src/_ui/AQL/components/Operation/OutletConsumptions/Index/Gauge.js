import { useConsumptionIndex } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionIndex'

/**
 * OutletConsumptions › Index › Gauge — JS modifier (tier CP: resource + page).
 *
 * Today's plan, and how much of it is closed:
 *
 *     completed ÷ planned × 100
 *
 * where `planned` is the visits scheduled for TODAY and `completed` is how many of those
 * visits produced a consumption.
 *
 * COMMITTED-OBLIGATION DENOMINATOR (UI_MODULE_DEVELOPER_GUIDE §9.2). Only planned visits
 * count on either side. A walk-in audit against no planned visit is real work, but it was
 * never an obligation — counting it in the numerator would let an officer push the dial
 * past 100% by visiting outlets nobody scheduled, which is exactly the shape of metric
 * that stops meaning anything. It is excluded from BOTH halves, not just the denominator,
 * so the ratio stays a straight answer to "did today's plan get done?".
 *
 * A visit already COMPLETED still counts in the denominator: it WAS planned for today, and
 * dropping it the moment it is done would shrink the denominator as the numerator grows,
 * pinning the dial at 100% all day. That normalisation lives in the Layer 2 aggregate, not
 * here, so the gauge and any later widget reading the same ratio cannot diverge.
 *
 * A GAUGE RATHER THAN A BAR, deliberately. Today's plan is a bounded target that either
 * closes before the day ends or does not; `LinearProgress` reads as steady accumulation
 * over a backlog, which is the wrong shape for a figure that resets every morning.
 *
 * NO `title`, and the name is on the item instead. A single-ratio widget has exactly one
 * thing to name, and naming it twice — once as a section heading, once as the dial's own
 * label — reads as two headings for one number (§9.2).
 *
 * `items` is function-valued because a JS modifier resolves once and its return is cached;
 * only a closure sees the settled store. Returns `[]` — never a zero-filled dial — when
 * nothing is planned, which trips the section's strict hide rule: 0% on a day with no
 * scheduled visits is a false alarm, not information.
 */
export default function () {
  return {
    items: () => {
      const { todayFulfilment } = useConsumptionIndex()
      const { completed, planned } = todayFulfilment.value

      // No plan for today. There is no ratio to report, and a dial reading 0% would
      // accuse the reader of being behind on work that was never scheduled.
      if (!planned) return []

      return [{
        label: "Today's Visit Fulfilment",
        caption: `${completed} of ${planned} planned visits`,
        value: completed,
        max: planned,
        // A colour that tracks the reading rather than a fixed brand tint: the dial is an
        // instruction while the day is open, and a statement once it is closed.
        color: completed >= planned ? 'positive' : (completed > 0 ? 'primary' : 'warning')
      }]
    }
  }
}
