import { IN_TRANSIT } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

const RESOURCE = 'OutletDeliveries'

/**
 * OutletDeliveries › MakeInTransit contract —
 * `/operation/outlet-deliveries/{code}/_action/make-in-transit`.
 *
 * `make-in-transit` normalizes to `makeintransit`, so this file is `MakeInTransit.js` and
 * every placeholder beneath it resolves under the `MakeInTransit/` page tier (§2.1).
 *
 *   single step   confirmation + optional note   →   [ Cancel ] [ Mark In Transit ]
 *
 * ── WHY A ROUTE FOR A ONE-COLUMN CHANGE ──
 * It could have been a `mutate` action, and deliberately is not. Departing is the point at
 * which a run stops being re-plannable — cancelling is DRAFT-only — so the page states that
 * consequence, with the item count, before the coordinator commits. A confirm dialog reading
 * "Mark in transit?" would hide exactly the fact worth knowing.
 *
 * `DepartConfirm` opens the sheets its context lines are resolved from. It no longer seeds
 * anything — `ready` below owns the node.
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
  contents: ['DepartConfirm'],

  // Declarative gating (useContentResolver / useSectionResolver). Each entry names the
  // registered action its route or its foreign resource actually needs; anything not
  // listed renders unconditionally, exactly as before.
  permissions: {
    DepartConfirm: ['OutletDeliveries:makeInTransit']
  },

  PropsPageHeader: {
    title: 'Dispatch Delivery',
    reload: false
  },

  ready ({ pageState, routeInfo }) {
    pageState.initResource(RESOURCE, {
      code: routeInfo.value.code,
      isPrimaryKey: true,
      reset: true,
      fields: { Progress: IN_TRANSIT, ProgressInTransitComment: '' }
    })
  }
}
