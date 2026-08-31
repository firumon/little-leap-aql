import { liveDeliveryRun } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliveryRunLive'
import { buildDeliveryCancelNodes } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryPayload'
import { itemRowsForCodes } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryRows'
import { orsisForDelivery } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

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
 */
export default {
  sections: ['PageHeader'],
  contents: ['CancelConfirm'],

  PropsPageHeader: {
    title: 'Cancel Delivery',
    reload: false
  },

  // The batch is built as soon as a reason is typed and re-cut on every edit, so
  // `PageAction.submit` only validates (UI_PAGE_STATE.md §5B). This sheet does NOT
  // prefix its stamps with `Progress`.
  ready: liveDeliveryRun({
    commentField: 'CancelledComment',
    build: ({ record, actorName, comment }) => buildDeliveryCancelNodes({
      record,
      orsiRows: itemRowsForCodes(orsisForDelivery(record)),
      actorName,
      reason: comment
    })
  })
}
