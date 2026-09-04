import { COMPLETED } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

const RESOURCE = 'OutletDeliveries'

/**
 * OutletDeliveries › MarkComplete contract —
 * `/operation/outlet-deliveries/{code}/_action/mark-complete`.
 *
 * `mark-complete` normalizes to `markcomplete`, so this file is `MarkComplete.js` (§2.1).
 *
 *   single step   confirmation + optional note   →   [ Cancel ] [ Complete Delivery ]
 *
 * ── A SAFETY NET, NOT THE NORMAL PATH ──
 * `buildDeliveryMarkDeliveredNodes` closes a run itself the moment its last line lands, so
 * in healthy operation nobody ever opens this page. It exists for the manifest that did NOT
 * close — a line delivered through the standalone restock route, or a batch that partially
 * failed — which would otherwise sit in the active queue forever with nothing left to
 * deliver.
 *
 * Its FAB is gated on `canComplete`, so the action APPEARING is itself the signal that a run
 * needs a human. That is the whole reason it is a visible route rather than a background
 * repair: somebody should notice.
 *
 * `CompleteConfirm` is the HYDRATION POINT (§5.5): the completion check is a question about
 * the manifest's LINES, which the record loader does not bring, so the card opens the item
 * and restock sheets before the gate can answer honestly.
 *
 * `reload: false` — consistent with every other transactional route in the module (§5.5).
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
  contents: ['CompleteConfirm'],

  PropsPageHeader: {
    title: 'Complete Delivery',
    reload: false
  },

  ready ({ pageState, routeInfo }) {
    pageState.initResource(RESOURCE, {
      code: routeInfo.value.code,
      isPrimaryKey: true,
      reset: true,
      fields: { Progress: COMPLETED, ProgressCompletedComment: '' }
    })
  }
}
