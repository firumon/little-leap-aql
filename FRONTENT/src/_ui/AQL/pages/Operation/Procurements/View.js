// The lifecycle record: where it stands, everything hanging off it, then how it got here.
export default {
  sections: ['PageHeader', 'ProcurementHeader', 'ProcurementChain', 'Workflow'],
  contents: [],

  PropsPageHeader: {
    title: 'Procurement',
    reload: false
  },
  PropsProcurementHeader: { title: 'Procurement Details' },
  PropsProcurementChain: (pageProps) => ({ title: 'Linked Records', gutter: pageProps.gutter }),
  PropsWorkflow: { title: 'Lifecycle' }
}
