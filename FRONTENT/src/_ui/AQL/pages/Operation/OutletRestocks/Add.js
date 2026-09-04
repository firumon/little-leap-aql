import { watch } from 'vue'
import {
  RESTOCK_CONTROL,
  restockDirectOptions,
  restockNode
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'

const RESOURCE = 'OutletRestocks'
// Working state. `AddSeeded` marks a node THIS page built, so a re-run is told apart
// from a fresh arrival; `RoutingSeeded` marks the region default as already applied.
const ADD_SEEDED = 'AddSeeded'
const ROUTING_SEEDED = 'RoutingSeeded'

/**
 * OutletRestocks › Add — a 3-step wizard. One content per decision; the button table per
 * step lives in `Add/PageAction.js`.
 *
 * Seeding happens HERE, not in a step card. `ready` is the only hook with PAGE lifetime —
 * a card that seeds on mount re-seeds every time the user steps back to it, and its
 * watchers die the moment it scrolls off (UI_PAGE_STATE.md §14).
 *
 * The node, its controls and the rules that keep them in step all come from Layer 2:
 * `restockNode` returns the record defaults, the three routing controls and
 * `restockProgressDerive()`, so flipping direct or instant delivery rewrites the parent
 * and every line without a single line of progress arithmetic on this page.
 */
export default {
  sections: ['PageHeader'],
  contents: [
    'OutletSelection',
    'DirectRestock',
    'InstantDelivery',
    'AdjustItems',
    'NewItems',
    'Review',
    'SubmitOptions'
  ],

  PropsPageHeader: {
    reload: false
  },

  // `AdjustItems`/`NewItems` are shared with the Edit page, which has no wizard — so the
  // step they belong to is declared here rather than hardcoded in them.
  PropsAdjustItems: { step: 2 },
  PropsNewItems: { step: 2 },

  ready ({ pageState, routeInfo }) {
    const query = routeInfo.value.query || {}

    // Two very different things reach this line: a genuine arrival on Add, and a mere
    // contract re-resolve on the SAME page (§14.2). They need opposite treatment, and
    // `hasNode` cannot tell them apart - Page.vue keeps ONE pageState for every resource
    // page in the session, so the node sitting here may be the record the VIEW page just
    // hydrated. Seeding must wipe that, or the wizard silently edits it and submit issues
    // an UPDATE against a record the user never opened. Re-running on the same visit must
    // wipe nothing, or the lines already typed are lost.
    //
    // The control answers it: only this block writes it, and `reset()` drops it on a
    // successful submit, so the next arrival seeds fresh.
    if (pageState.getControls(ADD_SEEDED, false, RESOURCE) !== true) {
      pageState.resetForResource(RESOURCE)
      pageState.applyNodes(restockNode(
        { OutletCode: String(query.outletCode || '').trim() },
        [],
        { mode: 'DRAFT' }
      ))
      pageState.setControls(ADD_SEEDED, true, RESOURCE)
      pageState.meta.currentStep = 1
    }

    // Warehouses land after the page does, so the routing default waits for them rather
    // than settling on "no" while the list is still empty. Watched on the COUNT, not the
    // options object, which is rebuilt on every read.
    //
    // The once-only latch is a CONTROL, not a local flag: a local one is re-created by
    // every `ready` re-run and would re-apply the default over a choice the user had
    // since changed. Same reason Edit tracks `EditHydratedFor` (§13.5).
    watch(() => restockDirectOptions().warehouses.length, () => {
      if (pageState.getControls(ROUTING_SEEDED, false, RESOURCE) === true) return
      const { warehouses, canDirect } = restockDirectOptions()
      if (!warehouses.length) return

      pageState.setControls(ROUTING_SEEDED, true, RESOURCE)
      if (!canDirect) return
      // Instant delivery is left OFF: handing the stock over now is the user's claim to
      // make, not a default. `restockNode` already seeded that control false.
      pageState.setControls(RESTOCK_CONTROL.DIRECT, true, RESOURCE)
      pageState.setControls(RESTOCK_CONTROL.WAREHOUSE, warehouses[0].value, RESOURCE)
    }, { immediate: true })
  }
}
