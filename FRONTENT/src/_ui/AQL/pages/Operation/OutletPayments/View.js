/**
 * OutletPayments › View — page contract (tier CP: resource + page specific).
 *
 * The stack is ordered by what a reader needs first: the receipt itself, then the invoice it
 * credited, then the reconciliation, then the outlet's wider position.
 *
 * `PaymentSummary` leads because it IS the document — the amount, who paid, when, how — and it
 * is also where a cancellation is announced, since a cancelled receipt still shows an amount
 * and reads as collected money until the reversal is stated beside it.
 *
 * `InvoiceAllPayments` renders only when the credited invoice has MORE THAN ONE payment
 * against it. On a single-payment invoice that list would restate `PaymentSummary` one card
 * later, which reads as a duplicate record rather than as reconciliation.
 *
 * `contents` is empty: the generic record grid would restate, column by column, what
 * `PaymentSummary` already says in the workflow's own vocabulary, and would show the raw
 * progress-stamp columns alongside the cancellation banner that exists to replace them.
 *
 * `OtherPendingInvoices` and `RecentPayments` are the outlet's wider position, as two ORDINARY
 * sections rather than collapsed accordions. Context nobody expands is context nobody has;
 * both hide themselves when the outlet has no such history, so a first payment shows neither.
 */
export default {
  sections: [
    'PageHeader',
    'PaymentSummary',
    'InvoiceSummary',
    'InvoiceAllPayments',
    'OtherPendingInvoices',
    'RecentPayments'
  ],
  contents: [],

  PropsPageHeader: {
    title: 'Payment Receipt',
    reload: false
  },
  PropsInvoiceSummary: {
    title: 'Credited Invoice'
  },
  PropsInvoiceAllPayments: {
    title: 'All Payments on This Invoice'
  },
  PropsOtherPendingInvoices: {
    title: 'Other Open Invoices'
  },
  PropsRecentPayments: {
    title: 'Recent Payments'
  }
}
