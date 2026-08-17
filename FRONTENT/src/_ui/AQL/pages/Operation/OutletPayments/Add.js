/**
 * OutletPayments › Add — page contract (tier CP: resource + page specific).
 *
 * The 3-step collection recorder. Each card renders only on its own step and the sticky
 * form-actions bar owns every move between them (`Add/PageAction.js`), so no step card carries
 * navigation of its own.
 *
 *   1  SelectInvoices    the paying outlet, and which of its open invoices this settles
 *   2  PaymentDetails    how much was taken, how it splits across those invoices, and how
 *   3  PaymentReview     the receipt as it will be written
 *
 * The step number is passed as a PROP rather than hardcoded in each card, so the running order
 * lives here — the same arrangement the invoice generator uses.
 *
 * `sections` carries only the header: the wizard's own cards are `contents`, because they are
 * the page's subject rather than furniture around it.
 */
export default {
  sections: ['PageHeader'],
  contents: [
    'SelectInvoices',
    'PaymentDetails',
    'PaymentReview'
  ],

  PropsPageHeader: {
    title: 'Record Payment',
    reload: false
  },

  PropsSelectInvoices: { step: 1 },
  PropsPaymentDetails: { step: 2 },
  PropsPaymentReview: { step: 3 }
}
