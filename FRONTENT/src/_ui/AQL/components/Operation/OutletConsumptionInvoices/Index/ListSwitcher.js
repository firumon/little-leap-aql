import { useInvoiceIndex } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex'

/**
 * OutletConsumptionInvoices › Index › ListSwitcher — JS modifier (tier CP: resource + page).
 *
 * THE NINE VIEWS, from two different places, presented as one row of pills.
 *
 * Four of them (`NearDue`, `Overdue`, `Completed`, `Cancelled`) are registered GAS
 * `ListViews`: plain column filters the shared token evaluator applies to the resource's own
 * records. The switcher would surface those four on its own.
 *
 * The other five cannot be registered, and this modifier is what puts them on the page:
 *
 *   OutletPendings       groups by OUTLET, not by invoice.
 *   InvoiceableOutlets   reads a DIFFERENT resource (OutletConsumptions).
 *   PendingInvoices      \
 *   HighValueInvoices     >  all three key off Balance Due — grand total minus active
 *   WaiveOffInvoices     /   payments — which is derived and therefore not a column any
 *                            `column/operator/value` condition can name.
 *
 * Registering them in `syncAppResources.gs` would have shipped views filtering on a blank
 * column, which matches everything and silently returns the whole table. They are runtime
 * evaluators in Layer 2 instead, and each has a `List<ViewName>.vue` override beside this
 * file that renders its projection.
 *
 * ORDER IS A WORK ORDER, not a grouping preference: the collections queue leads (what is due
 * and what is late), then the money views, then the upstream work, then history last. A user
 * opening this page is far more often chasing a payment than reading an archive.
 *
 * `items` is FUNCTION-VALUED for the reason `ListSwitcher.vue`'s own prop docs give: a
 * modifier resolves once and is cached, so a plain array would freeze at whatever the store
 * held on the first tick — before the fetch settles, when every count below is zero.
 */
export default function () {
  return {
    items: () => {
      const { runtimeViews, storedViews, collections } = useInvoiceIndex()
      const runtime = runtimeViews.value
      const stored = storedViews.value

      // The count is folded into the LABEL rather than passed as its own field:
      // `ListSwitcherItem.vue` renders `name`/`label`/`icon`/`color` and nothing else, so a
      // `count` property would sit on the item unread. A `null` count means "no number on
      // this pill" — used for the two history views, where a total is a fact about the
      // archive rather than a call to action.
      const view = (name, label, icon, color, count) => ({
        name,
        label: count === null || count === undefined ? label : `${label} (${count})`,
        icon,
        color,
        count
      })

      return [
        view('NearDue', 'Near Due', 'event', 'primary', stored.NearDue.length),
        view('Overdue', 'Overdue', 'running_with_errors', 'negative', stored.Overdue.length),
        view('PendingInvoices', 'Pending', 'pending_actions', 'orange', runtime.PendingInvoices.length),
        view('HighValueInvoices', 'High Value', 'trending_up', 'deep-orange', runtime.HighValueInvoices.length),
        view('OutletPendings', 'Outlet Pendings', 'storefront', 'indigo-6', runtime.OutletPendings.length),
        view('WaiveOffInvoices', 'Waive-off', 'cleaning_services', 'blue-grey-6', runtime.WaiveOffInvoices.length),
        view('InvoiceableOutlets', 'To Invoice', 'request_quote', 'warning', runtime.InvoiceableOutlets.length),
        view('Completed', 'Completed', 'task_alt', 'positive', null),
        view('Cancelled', 'Cancelled', 'block', 'grey-7', null)
      ].filter((entry) => {
        // The two money-shaped views hide themselves when the book is empty, so a tenant
        // with nothing outstanding sees a clean switcher rather than four zeroes. The
        // history views and the default always stay.
        if (entry.name === 'WaiveOffInvoices') return entry.count > 0
        if (entry.name === 'HighValueInvoices') return collections.value.count > 1
        return true
      })
    }
  }
}

