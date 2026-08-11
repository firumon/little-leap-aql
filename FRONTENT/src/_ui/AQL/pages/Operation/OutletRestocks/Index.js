/**
 * OutletRestocks index contract.
 *
 * The first migration slice uses the full-page override while the workflow
 * sections are being moved into resolver-backed components. Keeping this
 * contract in place documents the intended generic-page surface and gives the
 * fallback page a stable configuration during the transition.
 */
export default {
  sections: ['PageHeader', 'FilterInput', 'ListSwitcher'],
  contents: ['List']
}
