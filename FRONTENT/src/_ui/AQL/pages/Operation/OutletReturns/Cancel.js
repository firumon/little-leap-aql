import { watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { buildReturnCancelNodes } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'

const NODE = 'OutletReturns'
// A control, not the queued Cancel action's field: `Cancel` is registered `kind: navigate`,
// and `setActions` silently drops a write to an action that has no request envelope.
const REASON = 'CancelReason'

/**
 * OutletReturns › Cancel contract — `/operation/outlet-returns/{code}/_action/cancel`.
 *
 * An `_action/:action` route resolves its canonical page key to the ACTION slug, normalized
 * through `toPascalCase(actionParam).toLowerCase()` — `cancel` resolves to `cancel`, so this
 * file is `Cancel.js` (UI_MODULE_DEVELOPER_GUIDE.md §2.1).
 *
 *   single step   reversal preview + reason   →   [ Cancel ] [ Cancel Return ]
 *
 * ── WHY A ROUTE AND NOT THE `mutate` ACTION IT REPLACES ──
 * `GAS/syncAppResources.gs` declared `Cancel` as a one-field `mutate` that flipped
 * `Progress` to CANCELLED and collected a comment. That cannot do the thing cancelling a
 * return actually requires: write the compensating `OutletMovements` row that undoes the
 * shelf movement the return wrote when it was logged. Without it, cancelling a return left
 * the outlet's stock balance permanently wrong in whichever direction the original return
 * moved it.
 *
 * That is also why the reversal is previewed BEFORE the commit. A cancellation's ledger
 * effect is counter-intuitive: a return the outlet was CREDITED for added stock to the
 * shelf, so cancelling it takes stock back OFF. Showing the direction, in units, is what
 * stops a reader cancelling the wrong record.
 *
 * ── ON THE CANCELLATION REASON ──
 * Mandatory, and honestly labelled. `OutletReturns` declares no comment column, and GAS
 * silently drops payload keys that are not sheet headers, so the reason does not yet
 * persist. It is still required and still sent — see `Cancel/CancelConfirm.vue`.
 *
 * `CancelConfirm` is the HYDRATION POINT (§5.5): it seeds the reason control field and
 * preloads the master rows its context lines resolve names from.
 *
 * `reload: false` — the typed reason is the page's state and reloading would discard it.
 */
export default {
  sections: ['PageHeader'],
  contents: ['CancelConfirm'],

  PropsPageHeader: {
    title: 'Cancel Return',
    reload: false
  },

  // The batch is cut as soon as a reason is typed, so `PageAction.submit` only validates
  // (UI_PAGE_STATE.md §5B).
  ready ({ pageState, resourceRecord }) {
    const { user } = useAuth()
    const loaded = () => resourceRecord?.record?.value || {}

    watch(() => [
      String(loaded().Code ?? '').trim(),
      pageState.getControls(REASON, '', NODE)
    ], () => {
      const record = loaded()
      const code = String(record.Code ?? '').trim()
      if (!code) return
      // Created once, never replaced: initResource would drop the reason being typed.
      if (!pageState.hasNode(NODE)) pageState.initResource(NODE, { isPrimaryKey: true, code })
      pageState.applyLive(buildReturnCancelNodes({
        record,
        reason: String(pageState.getControls(REASON, '', NODE) ?? '').trim(),
        actorName: user.value?.name || user.value?.email || ''
      }), { keep: [NODE] })
    }, { immediate: true, deep: true })
  }
}
