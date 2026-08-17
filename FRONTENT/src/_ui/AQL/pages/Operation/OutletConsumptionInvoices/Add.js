/**
 * OutletConsumptionInvoices › Add — page contract (tier CP: resource + page specific).
 *
 * The 3-step invoice generator. Each card renders only on its own step and the sticky
 * form-actions bar owns every move between them (`Add/PageAction.js`), so no step card
 * carries navigation of its own.
 *
 *   1  SelectConsumptions   outlet, price list, and which recorded counts to bill
 *   2  InvoiceItems         the resulting lines, grouped by SKU, with editable prices
 *   3  InvoiceReview        due date, discount, credited returns, and the total
 *
 * The step number is passed as a PROP rather than hardcoded in each card, so the running
 * order lives here — the same arrangement the restock wizard uses.
 *
 * `sections` carries only the header: the wizard's own cards are `contents`, because they
 * are the page's subject rather than furniture around it.
 */
export default {
  sections: ['PageHeader'],
  contents: [
    'SelectConsumptions',
    'InvoiceItems',
    'InvoiceReview'
  ],

  PropsPageHeader: {
    title: 'Generate Invoice',
    reload: false
  },

  PropsSelectConsumptions: { step: 1 },
  PropsInvoiceItems: { step: 2 },
  PropsInvoiceReview: { step: 3 }
}



