import { useOutletPaymentIndex } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentIndex'

/**
 * `items` is a GETTER, not a plain array: a modifier's return value is resolved once and
 * cached, so a literal array would freeze at whatever the aggregate held on the first tick.
 *
 * The two history pills carry no count. Their sets grow without bound, so a number there
 * measures the age of the tenant rather than any work to be done.
 */
export default function () {
  return {
    items: () => {
      const { views } = useOutletPaymentIndex()
      const v = views.value

      const view = (name, label, icon, color, count) => ({
        name,
        label: count === null || count === undefined ? label : `${label} (${count})`,
        icon,
        color,
        count
      })

      return [
        view('Recent', 'Recent', 'history', 'indigo-7', null),
        view('PendingApproval', 'Pending Approval', 'schedule', 'warning', v.PendingApproval ? v.PendingApproval.length : 0),
        view('OverdueInvoices', 'Overdue Invoices', 'running_with_errors', 'negative', v.OverdueInvoices.length),
        view('Outlets', 'Outlets', 'storefront', 'deep-orange', v.Outlets.length),
        view('CompletedPayments', 'Completed Payments', 'savings', 'teal-7', null),
        view('CancelledPayments', 'Cancelled Payments', 'block', 'grey-7', null)
      ]
    }
  }
}
