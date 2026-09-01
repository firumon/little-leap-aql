// `/operation/outlet-consumption-invoices/{code}/_action/cancel`. CancelConfirm hydrates.
export default {
  sections: ['PageHeader'],
  contents: ['CancelConfirm'],

  permissions: {
    CancelConfirm: ['OutletConsumptionInvoices:cancel']
  },

  PropsPageHeader: {
    title: 'Cancel Invoice',
    reload: false
  }
}
