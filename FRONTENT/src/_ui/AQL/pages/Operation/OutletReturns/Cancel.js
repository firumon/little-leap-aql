// `/operation/outlet-returns/{code}/_action/cancel`. Voids a return and writes the
// compensating OutletMovements row, which the old one-field `Cancel` mutate could not do.
// The reason is mandatory and lands on the record's `ReasonComment` column.
export default {
  sections: ['PageHeader'],
  contents: ['CancelConfirm'],

  // Page.vue keeps ONE pageState per Page mount and never clears it, so the nodes and
  // DERIVES of the page visited before this one are still here. Flush them before the card
  // mounts this route's own (UI_PAGE_STATE_NODES.md §5.7A).
  ready ({ pageState }) {
    pageState.resetForResource('OutletReturns')
  },

  PropsPageHeader: {
    title: 'Cancel Return',
    reload: false
  }
}
