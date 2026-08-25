/**
 * OutletConsumptionInvoices › View — page contract (tier CP: resource + page specific).
 *
 * The stack is ordered by what a reader needs first: the exception, then the headline, then
 * the evidence, then the context.
 *
 * `SettlementDetails` sits directly under the header because it is the only card that
 * CONTRADICTS what the rest of the page implies — a PAID chip on a bill that never collected
 * its full value reads as a data error until the reason is stated, and the reader needs that
 * reason before reaching the figures it explains. It renders nothing in every ordinary case,
 * so nothing is displaced when there is no settlement.
 *
 * `contents` is empty: the generic record grid would restate, column by column, what
 * `InvoiceHeader` and `BillingSummary` already say in the workflow's own vocabulary — and
 * would show the raw `TaxDetails` JSON alongside the breakdown that exists to replace it.
 *
 * `Mark Paid` and `Cancel` are absent from this contract by design; they are configured
 * `AdditionalActions` and mount through the standard `ResourceActions` FAB. See
 * `View/InvoiceActions.vue` for why `Make Payment` is the one exception.
 */
export default {
  sections: [
    'PageHeader',
    'InvoiceHeader',
    'SettlementDetails',
    'BilledItems',
    'BillingSummary',
    'InvoicePayments',
    'OtherInvoices',
    'RecentPayments'
  ],
  contents: [],

  // Declarative gating (useSectionResolver). A section that renders ANOTHER resource's
  // rows is hidden from a role that cannot read that resource; the rest render as before.
  permissions: {
    InvoicePayments: ['OutletPayments:read'],
    RecentPayments: ['OutletPayments:read'],
    OtherInvoices: ['OutletConsumptionInvoices:read']
  },

  PropsPageHeader: {
    title: 'Consumption Invoice',
    reload: false
  },
  PropsSettlementDetails: {
    title: 'Settlement'
  },
  PropsBilledItems: {
    title: 'Billed Items'
  },
  PropsBillingSummary: {
    title: 'Billing Summary'
  },
  PropsInvoicePayments: {
    title: 'Payments'
  },
  // The outlet's wider position, as two ORDINARY sections rather than one card of collapsed
  // accordions. Context nobody expands is context nobody has; both hide themselves when the
  // outlet has no history, so a first invoice shows neither.
  PropsOtherInvoices: {
    title: 'Other Invoices'
  },
  PropsRecentPayments: {
    title: 'Recent Payments'
  }
}

