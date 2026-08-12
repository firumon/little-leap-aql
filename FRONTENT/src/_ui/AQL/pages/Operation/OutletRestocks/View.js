/**
 * OutletRestocks › View.
 *
 * Stacked sections rather than a page override, so the standard breadcrumb, page
 * transition and `PageAction` resolver are all preserved. `contents` is empty:
 * the generic record grid would only restate what `RestockHeader` already says in
 * the workflow's own vocabulary.
 *
 * `RevisionRequiredBanner` leads the stack because it is the only card here that
 * asks for an action rather than reporting one — it renders nothing at all in
 * every other state, so nothing is displaced when there is no revision pending.
 */
export default {
  sections: ['PageHeader', 'RevisionRequiredBanner', 'RestockHeader', 'Items', 'AllocationDetails', 'Workflow'],
  contents: [],

  PropsPageHeader: {
    title: 'Outlet Restock',
    reload: false
  },
  PropsRevisionRequiredBanner: {
    title: 'Revision Required',
    padding: 'sm'
  },
  PropsRestockHeader: {
    title: 'Restock Details'
  },
  PropsItems: {
    title: 'Items Summary'
  },
  // The product cards are siblings INSIDE one section, so `.aql-page-body`'s
  // gutter reaches the section and never them — their rhythm is handed down
  // explicitly here, exactly as `AqlGroupedList` takes its own `gutter`.
  //
  // The whole BLOCK is the function, not the value: `resolvePlaceholderProps`
  // evaluates a function-valued block against the live props bag, but a function
  // sitting on one key is passed through untouched and would reach the String prop
  // as a closure (utils/placeholderProps.js).
  PropsAllocationDetails: (pageProps) => ({
    title: 'Allocation Details',
    gutter: pageProps.gutter
  }),
  PropsWorkflow: {
    title: 'Workflow Timeline'
  }
}
