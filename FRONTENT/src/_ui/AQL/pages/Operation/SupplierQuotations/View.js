// What the supplier answered, then what it costs, then the history.
export default {
  sections: ['PageHeader', 'QuotationHeader', 'QuotedItems', 'QuotationTotals', 'Workflow'],
  contents: [],

  PropsPageHeader: {
    title: 'Supplier Quotation',
    reload: false
  },
  PropsQuotationHeader: { title: 'Quotation Details' },
  PropsQuotedItems: { title: 'Quoted Items' },
  PropsQuotationTotals: { title: 'Pricing Summary' },
  PropsWorkflow: { title: 'Workflow Timeline' }
}
