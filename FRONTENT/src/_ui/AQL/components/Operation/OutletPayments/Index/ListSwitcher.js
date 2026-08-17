import { useOutletPaymentIndex } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentIndex'

/**
 * OutletPayments › Index › ListSwitcher — JS modifier (tier CP: resource + page).
 *
 * Six queues, ordered work-first then history:
 *
 *   1. Near Due (default)  what is late, and what is about to be — the collector's morning
 *   2. Overdue             the late half on its own, oldest deadline first
 *   3. Pending             the whole open book
 *   4. High Value          the open book ranked by balance instead of by date
 *   5. Collections         submitted receipts — what was actually taken in
 *   6. Cancelled           reversed receipts, kept visible because they move a balance back up
 *
 * `items` is a GETTER, not a plain array: a modifier's return value is resolved once and
 * cached, so a literal array would freeze at whatever the aggregate held on the first tick —
 * usually empty, since sections resolve before the fetch settles.
 *
 * Near Due counts BOTH of its groups, because the view renders both under dividers; a pill
 * reading "(3)" over a list of eleven rows would be a straightforward lie.
 *
 * The two history pills carry no count. Their sets grow without bound, so a number there
 * measures the age of the tenant rather than any work to be done.
 */
export default function () {
  return {
    items: () => {
      const { views, openInvoices } = useOutletPaymentIndex()
      const v = views.value

      const view = (name, label, icon, color, count) => ({
        name,
        label: count === null || count === undefined ? label : `${label} (${count})`,
        icon,
        color,
        count
      })

      return [
        view('NearDue', 'Near Due', 'event', 'primary', v.NearDue.length + v.Overdue.length),
        view('Overdue', 'Overdue', 'running_with_errors', 'negative', v.Overdue.length),
        view('PendingInvoices', 'Pending', 'pending_actions', 'orange', v.PendingInvoices.length),
        view('HighValueInvoices', 'High Value', 'trending_up', 'deep-orange', v.HighValueInvoices.length),
        view('Collections', 'Collections', 'savings', 'teal-7', null),
        view('Cancelled', 'Cancelled', 'block', 'grey-7', null)
      ].filter((entry) => {
        // A ranking of one invoice is not a ranking — the pill would only duplicate Pending.
        if (entry.name === 'HighValueInvoices') return openInvoices.value.length > 1
        return true
      })
    }
  }
}
