import { canMarkInvoiceAdjusted } from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

/**
 * OutletReturns › ResourceActionMarkInvoiceAdjusted — JS modifier (tier C: resource-wide).
 *
 * ── WHY THIS FILE EXISTS ──
 * The sheet-level `visibleWhen` tests ONE column — `InvoiceAdjustmentDone eq FALSE` — which
 * is true of every return that was never owed a credit in the first place. Left at that, the
 * FAB would offer "Settle Return Credit" on returns with no commercial track, and settling
 * one would mark a credit done that nobody was ever owed.
 *
 * The real question spans two columns, which `visibleWhen` cannot express, so the gate is
 * this function-valued `show` reading the domain predicate (§8.1).
 *
 * ── AND WHY THIS ACTION IS RARE BY DESIGN ──
 * The ordinary settlement path is automatic: finalising an invoice credits every return on
 * it through the returns domain. This route is for a credit given outside that cycle, so on
 * most returns it correctly never appears — the button showing up IS the signal that
 * something needs a human decision.
 *
 * Same predicate as `ConfirmSettlement.vue`'s lock banner and the submit veto (§8.6).
 * Function-valued so `evaluateProp` re-runs it per render — an invoice run that credits this
 * return while the page is open removes the button without a reload.
 */
export default {
  show: (record) => canMarkInvoiceAdjusted(record),
  label: 'Settle Return Credit'
}
