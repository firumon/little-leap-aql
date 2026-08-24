import { canMarkPaid } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'

/**
 * OutletConsumptionInvoices › ResourceActionMarkPaid — JS modifier (tier C: resource-wide).
 *
 * The sheet-level `visibleWhen` tests the Progress column alone, which cannot see the
 * `update` permission this settlement needs. `canMarkPaid` folds both into one predicate,
 * and it is the same one `settlementGate` mirrors on the route itself (§8.6).
 *
 * Function-valued so `evaluateProp` re-runs it per render: a payment that clears the balance
 * while the page is open takes the button away without a reload.
 */
export default {
  show: (record) => canMarkPaid(record),
  label: 'Settle & Mark Paid'
}
