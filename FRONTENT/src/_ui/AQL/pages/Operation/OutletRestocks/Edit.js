/**
 * OutletRestocks › Edit contract.
 *
 * No `Update` content: a restock is edited through the same item cards the Add
 * wizard uses (`AdjustItems` / `NewItems`, both resolved at the resource tier),
 * so the two pages cannot drift into offering different controls. The outlet and
 * the original date are fixed and shown read-only by `EditRestockHeader`, which
 * also hydrates the record + its item lines into pageState in `Update`'s place.
 *
 * `EditSubmitOptions` closes the page with whichever intent control the request's
 * state calls for — the draft toggle on a DRAFT, the resubmission comment on a
 * REVISION_REQUIRED.
 *
 * `AdjustItems`/`NewItems` are declared with no `step`, so they render
 * unconditionally — the Add contract is the one that pins them to step 2.
 */
export default {
  sections: ['PageHeader'],
  contents: [
    'EditRestockHeader',
    'AdjustItems',
    'NewItems',
    'EditSubmitOptions'
  ],
  PropsPageHeader: {
    reload: false
  }
}
