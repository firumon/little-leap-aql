// Three steps: pick the requisition lines, set the terms, then choose suppliers and check.
export default {
  sections: ['PageHeader'],
  contents: ['SelectRequisition', 'RFQTerms', 'SupplierSelection', 'ReviewRFQ'],

  PropsPageHeader: {
    title: 'Generate RFQ',
    reload: false
  },

  PropsSelectRequisition: { step: 1 },
  PropsRFQTerms: { step: 2 },
  PropsSupplierSelection: { step: 3 },
  PropsReviewRFQ: { step: 3 }
}
