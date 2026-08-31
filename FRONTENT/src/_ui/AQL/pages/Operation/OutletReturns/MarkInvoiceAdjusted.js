import { watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { buildReturnMarkInvoiceAdjustedNodes } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'

/**
 * OutletReturns › MarkInvoiceAdjusted contract —
 * `/operation/outlet-returns/{code}/_action/mark-invoice-adjusted`.
 *
 * An `_action/:action` route resolves its canonical page key to the ACTION slug, normalized
 * through `toPascalCase(actionParam).toLowerCase()` — `mark-invoice-adjusted` resolves to
 * `markinvoiceadjusted`, so this file is `MarkInvoiceAdjusted.js`
 * (UI_MODULE_DEVELOPER_GUIDE.md §2.1).
 *
 *   single step   confirmation only   →   [ Cancel ] [ Confirm Settlement ]
 *
 * ── WHY THIS ROUTE EXISTS AT ALL ──
 * The ORDINARY way a return's credit is settled is automatic: when an invoice is finalised,
 * `useInvoicePayload` calls the returns domain to credit every return on that bill and walk
 * the settled ones to COMPLETED. Nobody visits this page for that case.
 *
 * This route is the exception — a credit given outside the invoice cycle (a cash refund, a
 * manual credit note, an adjustment agreed off-system). Without it, such a return would sit
 * in the unresolved queue forever, because the event that would have closed it happened
 * somewhere the system cannot see.
 *
 * It collects nothing, deliberately: there is no decision to make, only an attestation that
 * the outlet has been compensated. `ConsumptionInvoiceCode` is left blank, because no
 * invoice credited it — see `ConfirmSettlement.vue`.
 *
 * `ConfirmSettlement` is the HYDRATION POINT (§5.5), preloading the master rows its context
 * lines resolve names from.
 *
 * `reload: false` — consistent with every other transactional route in the module, so a
 * reader never finds a reload control on a page that is mid-commit (§5.5).
 */
export default {
  sections: ['PageHeader'],
  contents: ['ConfirmSettlement'],

  PropsPageHeader: {
    title: 'Settle Return Credit',
    reload: false
  },

  // Nothing is collected on this route, so the batch is complete the moment the return
  // loads and `PageAction.submit` only validates (UI_PAGE_STATE.md §5B).
  ready ({ pageState, resourceRecord }) {
    const { user } = useAuth()
    const NODE = 'OutletReturns'
    const loaded = () => resourceRecord?.record?.value || {}

    watch(() => String(loaded().Code ?? '').trim(), (code) => {
      if (!code) return
      if (!pageState.hasNode(NODE)) pageState.initResource(NODE, { isPrimaryKey: true, code })
      pageState.applyLive(buildReturnMarkInvoiceAdjustedNodes({
        record: loaded(),
        actorName: user.value?.name || user.value?.email || ''
      }), { keep: [NODE] })
    }, { immediate: true })
  }
}
