// The RFQ is a dispatch record: who it went to leads, then what they must quote for,
// then the terms, then its history.
export default {
  sections: ['PageHeader', 'RFQHeader', 'Suppliers', 'Items', 'Terms', 'Workflow'],
  contents: [],

  PropsPageHeader: {
    title: 'Request for Quotation',
    reload: false
  },
  PropsRFQHeader: { title: 'RFQ Details' },
  PropsSuppliers: { title: 'Suppliers' },
  PropsItems: { title: 'Items to Quote' },
  PropsTerms: { title: 'Commercial Terms' },
  PropsWorkflow: { title: 'Workflow Timeline' }
}
