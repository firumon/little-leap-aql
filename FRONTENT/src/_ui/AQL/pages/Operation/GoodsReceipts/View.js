// A GRN is a finished record: what it is, what it posted, then when it happened.
export default {
  sections: ['PageHeader', 'GoodsReceiptHeader', 'ReceiptItems', 'Workflow'],
  contents: [],

  PropsPageHeader: {
    title: 'Goods Receipt',
    reload: false
  },
  PropsGoodsReceiptHeader: { title: 'Goods Receipt Details' },
  PropsReceiptItems: { title: 'Received Items' },
  PropsWorkflow: { title: 'Workflow Timeline' }
}
