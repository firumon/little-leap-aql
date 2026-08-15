import { useAuth } from 'src/composables/core/useAuth'
import { useConsumptionIndex } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionIndex'
import { progressColor, PENDING_INVOICE_GENERATION } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'

/**
 * OutletConsumptions › Index › MetricCards — JS modifier (tier CP: resource + page).
 *
 * Four counts, each an OPEN QUEUE SOMEONE OWNS, so every card answers "is there work for
 * me right now?" (UI_MODULE_DEVELOPER_GUIDE §9.2). All-time consumption totals and the
 * cancelled tally are history nobody can act on, and are deliberately absent — the
 * `Cancelled` list view is where that belongs.
 *
 *   Audits Today          what has actually been done today
 *   Overdue Outlets       outlets past their own visit cadence
 *   Pending Invoices      consumptions still owing a bill
 *   Uninvoiced Outlets    how many OUTLETS that backlog is spread across
 *
 * The last two are not the same number and the pair is the point: twelve pending invoices
 * across two outlets is one afternoon's bundling, and across twelve outlets it is twelve
 * separate trips. A single "12 pending" card cannot tell those apart.
 *
 * `items` is FUNCTION-VALUED because a JS modifier is invoked ONCE, at resolve time, and
 * its return is cached by `useSectionResolver`. A plain array would freeze at whatever the
 * store held on that first tick — usually empty, since the page resolves its sections
 * before the fetch settles. The closure is re-run by `evaluateProp` on every render.
 *
 * The counts come from `useConsumptionIndex`, the ONE Layer 2 aggregate the gauge, the
 * ageing bands and the two projection views also read — so no two widgets on this page can
 * arrive at different answers for the same question.
 *
 * Counted from the aggregate's own rows (every row this user may see), never from
 * `filteredRecords`: these cards are the REASON to switch views, so they must not change
 * when a view is switched (§9.2 rule 4).
 *
 * `useAuth()` at MODULE level is safe: it only reaches Pinia stores and calls no
 * `inject()`. `user` stays a computed, so the closure reads the LIVE session user on every
 * render rather than whoever was signed in at import time.
 */
const { user } = useAuth()

export default function () {
  return {
    items: () => {
      // Inside the closure for the same reason a permission read would be: the modifier
      // resolves before the store has hydrated, and an aggregate captured then would be
      // an empty snapshot for the life of the page.
      const index = useConsumptionIndex()
      const me = user.value?.id

      const today = index.consumptionsToday(me).length
      const overdue = index.overdueOutlets.value.length
      const pendingInvoices = index.uninvoicedConsumptions.value.length
      const uninvoicedOutlets = index.invoiceableOutlets.value.length

      // Nothing anywhere — a fresh tenant, or a genuinely clear board. Returning `[]`
      // trips the section's strict hide rule so the page opens on a clean list rather than
      // a wall of zeroes (§9.2 rule 2).
      if (!today && !overdue && !pendingInvoices && !uninvoicedOutlets) return []

      return [
        { label: 'Consumptions Today', number: today, color: 'primary' },
        { label: 'Overdue Outlets', number: overdue, color: 'negative' },
        // Reads the state's own colour from the vocabulary rather than naming one, so this
        // card and the row chips beneath it cannot disagree about what "pending" looks
        // like (§4.5).
        { label: 'Pending Invoices', number: pendingInvoices, color: progressColor(PENDING_INVOICE_GENERATION) },
        { label: 'Uninvoiced Outlets', number: uninvoicedOutlets, color: 'orange' }
      ]
    }
  }
}
