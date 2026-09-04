import { watch } from 'vue'
import { restockItemRows } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryRows'
import { nextDeliveryProgress } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

const RESOURCE = 'OutletDeliveries'
// Which lines were handed over. Stays a CONTROL: it is a selection over rows that already
// exist, which `UI_PAGE_STATE_NODES.md` §5B.5 names as a legitimate control, and it maps to
// no column on this sheet.
const SELECTION_FIELD = 'DeliverSelection'

/**
 * The node is LIVE from the first render (UI_PAGE_STATE.md §14). It carries the CODE it
 * will update, and its `Progress` follows the ticks: `nextDeliveryProgress` is the ONE
 * function the payload builder also calls, so what the node says the run is about to become
 * and what the batch actually writes cannot drift.
 *
 * Nothing the user types on this route belongs to an `OutletDeliveries` column — the note
 * lands on the restock lines and the movement rows, and the manifest's own stamp comment is
 * generated from the count. So `Progress` is the whole of this record, and that is honest
 * rather than thin.
 *
 * `reset: true` drops whatever the previous page left behind — `Page.vue` keeps ONE
 * pageState for every resource page in the session.
 */
/**
 * OutletDeliveries › MarkDeliver contract —
 * `/operation/outlet-deliveries/{code}/_action/mark-deliver`.
 *
 * An `_action/:action` route resolves its canonical page key to the ACTION slug, normalized
 * through `toPascalCase(actionParam).toLowerCase()` — `mark-deliver` resolves to
 * `markdeliver`, so this file is `MarkDeliver.js` (never `mark-deliver.js`), and every
 * placeholder beneath it resolves under the `MarkDeliver/` page tier (§2.1).
 *
 *   single step   tick what was handed over + note   →   [ Cancel ] [ Mark N Delivered ]
 *
 * ── THE ONE ROUTE IN THIS MODULE THAT MOVES STOCK ──
 * Everything else here is planning or state. This writes the lines to DELIVERED, one
 * positive `OutletMovements` row each, the parent restock requests' recomputed progress, and
 * the manifest's own next state — atomically, in one batch. The per-line half is delegated
 * to the RESTOCK domain, so a line delivered on a run and the same line delivered through
 * the standalone restock route land identically (§9.1).
 *
 * That is also why it is a ROUTE and not a row action or a mutate: the driver must choose
 * WHICH lines came off the van, which is an inspection, and §7.3 rule 4 keeps an action
 * requiring inspection off a scrolling list.
 *
 * ── AVAILABLE FROM DRAFT, NOT ONLY IN TRANSIT ──
 * `canDeliver` admits both DRAFT and IN_TRANSIT. A short run is often loaded and delivered
 * without anyone stopping to press "depart", and refusing the hand-over because a status
 * button was skipped would push drivers to record deliveries that already happened as
 * happening later. The first delivery moves a DRAFT to IN_TRANSIT by itself.
 *
 * `SelectDeliveredItems` is the HYDRATION POINT (§5.5, §13.5): an `_action` route has no
 * `Create`/`Update` content to seed the node, so the card's `onMounted` seeds the selection
 * and note control fields and opens the item and restock sheets its lines resolve from.
 *
 * `reload: false` — the ticks and the note are the page's state, and reloading would discard
 * a driver's whole round (§5.5).
 */
export default {
  sections: ['PageHeader'],
  contents: ['SelectDeliveredItems'],

  PropsPageHeader: {
    title: 'Record Delivery',
    reload: false
  },

  ready ({ pageState, routeInfo, resourceRecord }) {
    pageState.initResource(RESOURCE, {
      code: routeInfo.value.code,
      isPrimaryKey: true,
      reset: true
    })

    // Keyed on a primitive: `watch` compares with Object.is, so a fresh array would re-fire
    // on every read. The row COUNT is in the key because the item sheet lands after the
    // page does, and the first answer must not be frozen against an empty store.
    watch(
      () => [
        (pageState.getControls(SELECTION_FIELD, [], RESOURCE) || []).join(','),
        String(resourceRecord?.record?.value?.Code || ''),
        restockItemRows().length
      ].join('|'),
      () => {
        const manifest = resourceRecord?.record?.value
        if (!manifest) return
        const ticked = pageState.getControls(SELECTION_FIELD, [], RESOURCE) || []
        pageState.setRecord(
          'Progress', nextDeliveryProgress(manifest, ticked, restockItemRows()), RESOURCE)
      },
      { immediate: true }
    )
  }
}
