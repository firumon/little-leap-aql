import { useInvoiceIndex } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex'

/**
 * OutletConsumptionInvoices › Index › LinearProgress — JS modifier (tier CP: resource + page).
 *
 * TODAY'S COLLECTION RANK: how much of the morning's overdue book has been cleared today.
 *
 *     overdue at start of day  =  overdue still outstanding  +  collected today from overdue
 *     rank                     =  collected today from overdue  /  overdue at start of day
 *
 * ── WHY A RATIO AND NOT AN AMOUNT ──
 * "Collected today" is already a metric card above, and on its own it cannot be judged:
 * د.إ 500 is an excellent day against a د.إ 600 book and a poor one against د.إ 50,000. The
 * ratio is what makes the number mean something, and it is the only figure on this page that
 * measures the DAY's work rather than the standing position.
 *
 * ── WHY THE DENOMINATOR IS RECONSTRUCTED ──
 * Nothing stores the morning's balance, so Layer 2 derives it from the identity above — see
 * `todayCollection`. An invoice settled in full this morning is no longer overdue and no
 * longer open, so measuring against the CURRENT overdue total alone would quietly delete the
 * day's best work from its own scoreboard.
 *
 * Returns `[]` when there was nothing overdue to collect, which trips the section's strict
 * hide rule and removes it from the page. A progress bar reading 0% because there was no work
 * to do reports a failure that did not happen.
 *
 * `items` is function-valued and the composable is called inside the closure — a JS modifier
 * resolves once and is cached, so a plain array would freeze at whatever the store held
 * before the fetch settled. See `MetricCards.js`.
 */
export default function () {
  return {
    title: 'Today’s Collection',
    items: () => {
      const { todayCollection } = useInvoiceIndex()
      const today = todayCollection.value

      if (today.atStartOfDay <= 0) return []

      return [
        {
          label: `Overdue cleared today — ${Math.round(today.rank)}%`,
          value: today.fromOverdue,
          max: today.atStartOfDay,
          // Graded on the share cleared, so the bar reads as a verdict rather than a fact:
          // a tenth of the book is not the same day's work as half of it.
          color: today.rank >= 50 ? 'positive' : today.rank >= 20 ? 'warning' : 'negative'
        }
      ]
    }
  }
}
