import { useInvoiceIndex } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'

/**
 * OutletConsumptionInvoices › Index › MetricCards — JS modifier (tier CP: resource + page).
 *
 * Four numbers, all of them about work that is LATE or NOT YET STARTED. Nothing here counts
 * money that is merely outstanding: an invoice inside its payment terms is normal trading,
 * and putting it on a card implies somebody should be doing something about it.
 *
 *   Overdue Amount   the money past its due date. The collections number.
 *   Overdue          how many invoices that is, so a large amount reads as "one big one"
 *                    or "forty small ones" at a glance.
 *   Overdue Outlets  how many OUTLETS those invoices span — three overdue invoices from one
 *                    outlet is one phone call, three from three outlets is three. That is
 *                    the number a collector plans a day around, and neither figure above
 *                    expresses it.
 *   To Invoice       consumptions recorded but never billed. Upstream work, and the only
 *                    card pointing at another resource — which is exactly why it belongs
 *                    here: unbilled stock is invisible in every other figure on the page.
 *
 * `items` is FUNCTION-VALUED because a JS modifier is invoked ONCE, at resolve time, and its
 * return value is cached by `useSectionResolver`. A plain array would freeze at whatever the
 * store held on that first tick — usually empty, since the Index page resolves its sections
 * before the fetch settles. The closure is re-run by `evaluateProp` on every render.
 *
 * The composables are called INSIDE the closure rather than at module scope: they reach
 * Pinia, and a read taken at resolve time would latch whatever the store held before the
 * tenant's data landed.
 *
 * Returns `[]` when every one of those figures is zero, which trips the section's strict hide
 * rule and removes it from the page (§9.2 rule 2). The grey-vs-alarm colouring below still
 * matters: it covers the PARTIAL case — nothing overdue but stock waiting to be billed — where
 * the widget stays and individual cards read zero.
 */
export default function () {
  return {
    items: () => {
      const { collections, pendingInvoiceGeneration, todayCollection } = useInvoiceIndex()
      const { _C } = useCurrencyResource()

      const open = collections.value
      const today = todayCollection.value
      const toInvoice = pendingInvoiceGeneration.value.length

      if (!open.overdueAmount && !open.overdueCount && !open.overdueOutletCount &&
          !toInvoice && !today.total) return []

      // Grey rather than red when there is nothing overdue: a zero painted as an alarm
      // trains the reader to ignore the colour when it finally means something.
      const overdueColor = open.overdueCount > 0 ? 'negative' : 'grey-6'

      return [
        { label: 'Overdue Amount', number: _C(open.overdueAmount, true), color: overdueColor },
        { label: 'Overdue', number: open.overdueCount, color: overdueColor },
        { label: 'Overdue Outlets', number: open.overdueOutletCount, color: overdueColor },
        { label: 'To Invoice', number: toInvoice, color: toInvoice > 0 ? 'warning' : 'grey-6' },
        // The day's only positive figure, and the one the collection rank below is measured
        // against. Green whenever anything came in — money collected is unambiguously good
        // news, unlike the four counts above it.
        {
          label: 'Collected Today',
          number: _C(today.total, true),
          color: today.total > 0 ? 'positive' : 'grey-6'
        }
      ]
    }
  }
}
