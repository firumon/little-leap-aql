// Reason (hydration point) → the three cascade toggles → the stock that goes back.
export default {
  sections: ['PageHeader'],
  contents: ['CancelReason', 'StockRestoration', 'CascadeOptions'],

  // Page.vue keeps ONE pageState per Page mount and never clears it, so the nodes and
  // DERIVES of the page visited before this one are still here (UI_PAGE_STATE_NODES §5.7A).
  ready ({ pageState }) {
    pageState.resetForResource('OutletConsumptions')
  },

  PropsSection: (pageProps) => ({ gutter: pageProps.gutter }),

  PropsPageHeader: {
    title: 'Cancel Consumption',
    reload: false
  }
}
