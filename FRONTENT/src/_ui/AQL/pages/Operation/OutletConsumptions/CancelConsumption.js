/**
 * OutletConsumptions › CancelConsumption — action route contract.
 *
 * Reached from the View page's `CancelConsumption` FAB, which GAS publishes as a
 * `navigate` AdditionalAction rather than a `mutate` one — a plain mutate would flip this
 * record's Progress column and leave its invoice and its restocks pointing at a cancelled
 * audit.
 *
 * TITLED BY THE VERB IT PERFORMS (§5.5). A custom sub-route has no canonical page name to
 * humanize, and the user arrived from a record page needing to know what they walked into.
 *
 * `reload: false` — the page's state is the reason the user is typing, and reloading would
 * discard it.
 *
 * AN ACTION ROUTE HAS NO RECORD LOADER, so its first content is the hydration point: the
 * single `CancelReason` card calls the page's composable, which loads the dependent invoice
 * and restocks and seeds `pageState`. That is also why the confirmation of WHAT ELSE will
 * be cancelled can be shown before the user commits — the whole point of preferring a
 * route over a one-field dialog on the View page.
 */
export default {
  sections: ['PageHeader'],
  contents: ['CancelReason'],

  PropsPageHeader: {
    title: 'Cancel Consumption',
    reload: false
  }
}
