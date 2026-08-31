// The contract first, then what was ordered and how much has landed, then the money,
// then the receiving trail and the history.
export default {
  sections: ['PageHeader', 'PurchaseOrderHeader', 'OrderedItems', 'OrderTotals', 'Receivings', 'Workflow'],
  contents: [],

  PropsPageHeader: {
    title: 'Purchase Order',
    reload: false
  },
  PropsPurchaseOrderHeader: { title: 'Purchase Order Details' },
  PropsOrderedItems: { title: 'Ordered Items' },
  PropsOrderTotals: { title: 'Order Value' },
  PropsReceivings: { title: 'Receiving History' },
  PropsWorkflow: { title: 'Workflow Timeline' }
}
