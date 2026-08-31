// Five cards, ordered by what the reader must do: the instruction first, then the
// record, its items, the wider procurement, and the history.
export default {
  sections: ['PageHeader', 'RevisionRequiredBanner', 'RequisitionHeader', 'Items', 'ProcurementStage', 'Workflow'],
  contents: [],

  PropsPageHeader: {
    title: 'Purchase Requisition',
    reload: false
  },
  PropsRevisionRequiredBanner: { title: 'Action Needed', padding: 'sm' },
  PropsRequisitionHeader: { title: 'Requisition Details' },
  PropsItems: { title: 'Items Requested' },
  PropsProcurementStage: { title: 'Procurement Stage' },
  PropsWorkflow: { title: 'Workflow Timeline' }
}
