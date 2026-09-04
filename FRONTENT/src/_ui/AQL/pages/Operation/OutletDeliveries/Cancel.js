import { CANCELLED } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

const RESOURCE = 'OutletDeliveries'

/**
 * OutletDeliveries › Cancel contract — `/operation/outlet-deliveries/{code}/_action/cancel`.
 *
 * `cancel` normalizes to `cancel`, so this file is `Cancel.js` (§2.1).
 *
 *   single step   reason   →   [ Cancel ] [ Cancel Delivery ]
 *
 * ── WHY A ROUTE, WHEN NO STOCK MOVES ──
 * This is the mirror image of `OutletReturns`' cancel route, and worth stating because the
 * two look alike and behave oppositely. Cancelling a RETURN must reverse a ledger movement.
 * Cancelling a DELIVERY moves nothing at all: bundling a line onto a run never moved stock —
 * the units left the warehouse at approval and reach the outlet at delivery — so a run
 * abandoned before either has no ledger consequence whatever.
 *
 * The page exists to say that plainly, with the count, and to take a reason. Without it a
 * coordinator cancelling a run reasonably assumes stock needs correcting somewhere, and goes
 * looking for a problem that does not exist.
 *
 * ── THE GATE IS TWO-PART ──
 * `canCancel` is DRAFT-only AND requires that nothing has been handed over. Once a single
 * line is delivered the run has physically happened, and no cancellation can un-hand-over
 * goods — such a run is finished by delivering or removing the rest. The predicate needs the
 * manifest's LINES to answer its second half and fails closed without them, which is why
 * `CancelConfirm` is the HYDRATION POINT (§5.5) and opens the item sheet before the gate
 * reports.
 *
 * The reason is mandatory and — unlike `OutletReturns` — genuinely persists: this sheet
 * declares `CancelledAt/By/Comment`, so it shows on the View timeline afterwards.
 *
 * `reload: false` — the typed reason is the page's state and reloading would discard it.
 *
 * The node is LIVE from the first render (UI_PAGE_STATE.md §14). `ready` runs once per page
 * and is the only hook with page lifetime, so this is where the manifest node is seeded:
 * it carries the CODE it will update and the columns THIS route writes, and the confirm
 * card binds its text straight onto the record. Nothing is assembled at submit time.
 *
 * `reset: true` drops whatever the previous page left behind — `Page.vue` keeps ONE
 * pageState for every resource page in the session, so the node sitting here may be the
 * record the View page just hydrated.
 *
 * The `...At` / `...By` stamps are NOT seeded. They record when the operator confirmed,
 * not when the page opened, so the builder writes them at submit.
 */
export default {
  sections: ['PageHeader'],
  contents: ['CancelConfirm'],

  PropsPageHeader: {
    title: 'Cancel Delivery',
    reload: false
  },

  ready ({ pageState, routeInfo }) {
    pageState.initResource(RESOURCE, {
      code: routeInfo.value.code,
      isPrimaryKey: true,
      reset: true,
      fields: { Progress: CANCELLED, CancelledComment: '' }
    })
  }
}
