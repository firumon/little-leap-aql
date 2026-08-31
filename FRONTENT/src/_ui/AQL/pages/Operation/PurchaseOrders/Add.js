// Three steps: pick the quotation, set the quantities, then delivery, charges and check.
export default {
  sections: ['PageHeader'],
  contents: ['SelectQuotation', 'OrderLines', 'OrderReview'],

  PropsPageHeader: {
    title: 'Create Purchase Order',
    reload: false
  },

  PropsSelectQuotation: { step: 1 },
  PropsOrderLines: { step: 2 },
  PropsOrderReview: { step: 3 }
}
