// `/operation/rfqs/{code}/assign-supplier`. RFQSummary is the hydration point.
export default {
  sections: ['PageHeader'],
  contents: ['RFQSummary', 'SupplierPicker'],

  PropsPageHeader: {
    title: 'Assign Suppliers',
    reload: false
  }
}
