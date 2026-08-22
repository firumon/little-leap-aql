/**
 * OutletReturns › Add — page contract.
 *
 *   single step   outlet, item, both tracks, reason   →   [ Cancel ] [ Submit Return ]
 *
 * ── WHY NOT `contents: ['Create']` ──
 * A generated form would render the two flag columns as raw `'TRUE'`/`'FALSE'` selects and
 * could not express the two things that actually make this form work: the warehouse
 * selector that only exists when stock is leaving, and the invoice shortcut, which is a
 * join across `OutletConsumptionInvoices` and `OutletConsumptionInvoiceItems` that no
 * `_fields` control can describe. §13.0's test lands on a workflow form — and note that
 * every input in it is still a `_fields` control writing through `pageState.setField`.
 *
 * ── SIX CARDS, SIX CONTENTS, ONE ORDER ──
 *   FormReturnedItem       which outlet, which SKU — nothing else can be decided first
 *   FormBilledOn           the invoice that sold it, offered as a shortcut
 *   FormQuantityValue      price list, quantity, unit price
 *   FormCommercialCredit   is the outlet owed money
 *   FormReason             why it came back
 *   FormPhysicalStock      is stock leaving the shelf, and where to
 *
 * Each is its own content rather than one `ReturnForm` card set, because the ORDER is then
 * a fact of this contract that a reader can see and change, and because `Edit.js` declares
 * the same six — the two pages cannot drift into offering different controls, since they
 * render the same components (§13.6).
 *
 * `FormReturnedItem` is also the HYDRATION POINT (§5.5, §13.5): there is no `Create` content
 * to seed the node, so it calls `useReturnFormSeed`, which seeds the node and preloads every
 * resource the six cards read — outlets, SKUs, products, warehouses and the two invoice
 * sheets — in one place rather than each card fetching as the user scrolls.
 *
 * The header's reload control is suppressed because the page's data is owned by `pageState`
 * (§5.5): reloading mid-form would discard what the officer typed.
 */
export default {
  sections: ['PageHeader'],
  contents: [
    'FormReturnedItem',
    'FormBilledOn',
    'FormQuantityValue',
    'FormCommercialCredit',
    'FormReason',
    'FormPhysicalStock'
  ],

  PropsPageHeader: {
    title: 'Log Outlet Return',
    reload: false
  },

  /**
   * Every card spaces itself on the PAGE's own gutter rather than its own fallback, so the
   * gaps inside a card match the gaps between them (§10.2). The whole BLOCK is the
   * function, never one key inside it (§5.2).
   */
  PropsContent: (pageProps) => ({ gutter: pageProps.gutter })
}
