export default {
  sections: [
    'PageHeader',
    'PaymentSummary',
    'InvoiceSummary',
    'InvoiceAllPayments',
    'OtherPendingInvoices',
    'RecentPayments',
    'Workflow'
  ],
  contents: [],

  PropsPageHeader: {
    title: 'Payment Receipt',
    reload: false
  },
  PropsInvoiceSummary: {
    title: 'Credited Invoice'
  },
  PropsInvoiceAllPayments: {
    title: 'All Payments on This Invoice'
  },
  PropsOtherPendingInvoices: {
    title: 'Other Open Invoices'
  },
  PropsRecentPayments: {
    title: 'Recent Payments'
  },
  PropsWorkflow: {
    title: 'Workflow Timeline'
  }
}
