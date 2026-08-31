// `/operation/rfqs/{code}/mark-as-sent`. RFQSummary is the hydration point.
export default {
  sections: ['PageHeader'],
  contents: ['RFQSummary', 'DispatchPicker'],

  PropsPageHeader: {
    title: 'Mark RFQ As Sent',
    reload: false
  }
}
