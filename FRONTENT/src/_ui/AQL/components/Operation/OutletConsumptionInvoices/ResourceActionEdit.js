import { canEditInvoice } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'

/**
 * OutletConsumptionInvoices › ResourceActionEdit — JS modifier (tier C: resource-wide).
 *
 * Hides the Edit FAB once an invoice has taken money or come to rest. A part-paid bill has
 * payments recorded against the figures on it, a paid one is settled, and a cancelled one
 * released its consumptions back to the invoiceable queue — re-pricing any of them would
 * rewrite a document other rows now depend on.
 *
 * `canEditInvoice` is the domain's own gate, and the same one drives `Edit/EditLockBanner.vue`
 * and the Edit submit veto — so the button, the banner and the gate cannot disagree (§8.6).
 *
 * PLACEMENT — the resource tier, not a page folder: the FAB cluster appears on the View page
 * and wherever a row navigates, and the gate must hold on both.
 *
 * `show` is FUNCTION-VALUED so `evaluateProp` re-runs it per render (§8.1) — an invoice that
 * takes a payment while the page is open loses the button without a reload.
 */
export default {
  show: (record) => canEditInvoice(record),
  label: 'Edit Invoice'
}
