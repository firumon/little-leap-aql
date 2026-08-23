/**
 * OutletConsumptionInvoices › Edit — page contract (tier CP: resource + page specific).
 *
 *   single step   correct the bill   →   [ Cancel ] [ Save Invoice ]
 *
 * ── WHAT IS EDITABLE ──
 * The commercial terms and the unit prices, and nothing else:
 *
 *   InvoiceTerms      price list, due date and discount
 *   InvoiceItems      one unit-price box per line
 *   BillingSummary    what those two now come to, recalculated live
 *
 * The outlet, the issue date and every quantity are fixed and shown read-only. A quantity is
 * a physical count already recorded against a consumption, so correcting one belongs on that
 * consumption, not on the bill.
 *
 * The PRICE LIST is editable and is the heaviest control on the page — it decides the tax and
 * discount policy every stored figure was computed under, so switching it re-derives the whole
 * invoice. That is exactly what makes it worth offering: an invoice raised against the wrong
 * list is otherwise uncorrectable without cancelling and re-raising it.
 *
 * There is no comment box: the resource has no column for "why this bill changed", and the
 * `Progress*Comment` columns record why the invoice reached each STATE — which an edit does
 * not change. See `InvoiceTerms.vue`.
 *
 * There is no `Update` content: the generic form would offer every stored total as a typed
 * box, and a hand-typed `TotalTaxAmount` is exactly the second arithmetic this module exists
 * to prevent. Every figure here comes from one call to the shared engine (§13.0 — a workflow
 * form, because the primary input is a derived tree rather than the resource's own columns).
 *
 * ── THE LOCK ──
 * `EditLockBanner` leads the stack. The Edit URL is directly reachable, so an invoice that
 * has been paid, part-paid or cancelled since the link was opened says so above the form
 * rather than failing at the sticky bar. It renders nothing on an editable invoice.
 *
 * The header's reload control is suppressed because the page's state is owned by `pageState`
 * (§5.5): reloading mid-edit would discard every price the user has typed.
 */
export default {
  sections: ['PageHeader', 'EditLockBanner'],
  contents: [
    'InvoiceTerms',
    'InvoiceItems',
    'BillingSummary'
  ],

  PropsPageHeader: {
    title: 'Edit Invoice',
    reload: false
  }
}
