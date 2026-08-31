// The inspection: what it was against, the totals, the line counts, then the history.
export default {
  sections: ['PageHeader', 'ReceivingHeader', 'InspectionSummary', 'InspectedItems', 'Workflow'],
  contents: [],

  PropsPageHeader: {
    title: 'PO Receiving',
    reload: false
  },
  PropsReceivingHeader: { title: 'Receiving Details' },
  PropsInspectionSummary: { title: 'Inspection Summary' },
  PropsInspectedItems: { title: 'Inspected Items' },
  PropsWorkflow: { title: 'Workflow Timeline' }
}
