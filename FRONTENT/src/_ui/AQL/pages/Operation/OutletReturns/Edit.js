/**
 * OutletReturns › Edit — page contract.
 *
 * ── THE SAME SIX CARDS AS ADD ──
 * A correction is not a different act from logging: the officer is answering the same six
 * questions, about a row that already exists. So Edit declares the SAME contents as
 * `Add.js`, in the same order, and drops the generated `Update` form entirely. The two
 * pages cannot offer different controls, because they render the same components — which
 * is the drift a hand-listed `fields` array on one page and a card set on the other
 * guaranteed (§13.6).
 *
 * `FormReturnedItem` takes `mode: 'edit'`, which is the whole difference: `useReturnFormSeed`
 * then hydrates the node from the server row instead of seeding this module's defaults, and
 * the outlet renders as a stated fact rather than a selector — the ledger movement written
 * at creation is scoped to that outlet, and re-pointing the return would leave the movement
 * against the wrong shelf.
 *
 * The flags ARE editable here, unlike in the old field list. That is not a relaxation: a
 * flag change rewrites which ledger movement the return implies, so `buildReturnUpdateBatch`
 * posts a correcting movement for the DIFFERENCE rather than letting the row and the ledger
 * disagree. See that builder.
 *
 * ── THE LOCK ──
 * `EditLockBanner` leads the stack. The Edit URL is directly reachable, so a return that has
 * been credited, shipped, completed or cancelled since the link was opened says so above the
 * form rather than failing at the sticky bar. It renders nothing on an editable record, and
 * reads the same `isEditable` as the FAB and the submit veto (§8.6).
 *
 * The header's reload control is suppressed because the page's data is owned by `pageState`
 * (§5.5): reloading mid-form would discard the correction being typed.
 */
export default {
  sections: ['PageHeader', 'EditLockBanner'],
  contents: [
    'FormReturnedItem',
    'FormBilledOn',
    'FormQuantityValue',
    'FormCommercialCredit',
    'FormReason',
    'FormPhysicalStock'
  ],

  PropsPageHeader: {
    title: 'Edit Return',
    reload: false
  },

  PropsFormReturnedItem: {
    mode: 'edit'
  },

  // Every card spaces itself on the PAGE's own gutter rather than its own fallback (§10.2).
  PropsContent: (pageProps) => ({ gutter: pageProps.gutter }),
  PropsSection: (pageProps) => ({ gutter: pageProps.gutter })
}
