import { watch } from 'vue'
import { useAuth } from 'src/composables/core/useAuth'
import { buildSettlementNodes } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'
import { countsAsPayment } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import { useDataStore } from 'src/stores/data'

const NODE = 'OutletConsumptionInvoices'
// Controls, not queued action fields: `MarkPaid` is registered `kind: navigate`, and
// `setActions` silently drops a write to an action that has no request envelope.
const REASON = 'SettlementReason'
const MISMATCH = 'SettlementMismatchAmount'
const COMMENT = 'SettlementComment'

const asRow = (value) => (value && typeof value === 'object' ? value : {})
const text = (value) => (value == null ? '' : String(value).trim())

/** This invoice's own payment rows — the join the builder derives the balance from. */
const paymentsFor = (code) => (useDataStore().getRecords('OutletPayments') || [])
  .map(asRow)
  .filter((row) => text(row.OutletConsumptionInvoiceCode) === code && countsAsPayment(row))

/**
 * OutletConsumptionInvoices › MarkPaid contract —
 * `/operation/outlet-consumption-invoices/{code}/_action/mark-paid`.
 *
 * An `_action/:action` route resolves its page key to the ACTION slug normalized through
 * `toPascalCase(actionParam).toLowerCase()` — `mark-paid` resolves to `markpaid`, so this
 * file is `MarkPaid.js` (UI_MODULE_DEVELOPER_GUIDE.md §2.1).
 *
 *   single step   reason + amount + note   →   [ Cancel ] [ Settle Invoice ]
 *
 * ── WHY THIS IS A ROUTE AND NOT A DIALOG ──
 * Money alone can no longer close an invoice that still owes something: a residue of one
 * cent keeps it PARTIALLY_PAID. This route is the ONLY way from there to PAID, so it is the
 * page where the difference gets a name — and the user must see WHAT is being written off
 * before naming it. A dialog could collect the same three fields but could not show the
 * billed / collected / outstanding split beside them, and it could not enforce the rule that
 * `Other` demands an explanation, because the generic action pipeline validates presence
 * only.
 *
 * `SettleBalance` is the HYDRATION POINT (§5.5): an action route's resolver fetches the
 * invoice alone, so the card opens the payments it needs to derive the balance from.
 *
 * `reload: false` — consistent with every other transactional route in the module, so a
 * reader never finds a reload control on a page that is mid-commit (§5.5).
 */
export default {
  sections: ['PageHeader'],
  contents: ['SettleBalance'],

  // Declarative gating (useContentResolver / useSectionResolver). Each entry names the
  // registered action its route or its foreign resource actually needs; anything not
  // listed renders unconditionally, exactly as before.
  permissions: {
    SettleBalance: ['OutletConsumptionInvoices:markPaid']
  },

  PropsPageHeader: {
    title: 'Settle Invoice',
    reload: false
  },

  // The settlement is assembled as the answers are given, so `PageAction.submit` only
  // validates (UI_PAGE_STATE.md §5B).
  ready ({ pageState, resourceRecord }) {
    const { user } = useAuth()
    const loaded = () => resourceRecord?.record?.value || {}

    watch(() => [
      text(loaded().Code),
      pageState.getControls(REASON, '', NODE),
      pageState.getControls(MISMATCH, undefined, NODE),
      pageState.getControls(COMMENT, '', NODE)
    ], () => {
      const record = loaded()
      const code = text(record.Code)
      if (!code) return
      // Created once, never replaced: initResource would drop the answers being given.
      if (!pageState.hasNode(NODE)) pageState.initResource(NODE, { isPrimaryKey: true, code })
      pageState.applyLive(buildSettlementNodes({
        record,
        payments: paymentsFor(code),
        reason: pageState.getControls(REASON, '', NODE),
        comment: pageState.getControls(COMMENT, '', NODE),
        // Not coerced: a blank reads as "the whole outstanding balance" downstream.
        mismatchAmount: pageState.getControls(MISMATCH, undefined, NODE),
        actorName: user.value?.name || user.value?.email || ''
      }), { keep: [NODE] })
    }, { immediate: true, deep: true })
  }
}
