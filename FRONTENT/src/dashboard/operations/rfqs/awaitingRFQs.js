export default {
  metadata: {
    id: 'awaiting_rfqs',
    scope: 'operations',
    resource: 'rfqs',
    permission: {
      rfqs: 'read'
    },
    config: {
      type: 'MetricWidget',
      title: 'Awaiting RFQs',
      icon: 'request_quote',
      color: 'blue',
      weight: 90,
      layout: {
        xs: 12,
        sm: 6,
        md: 4,
        lg: 3
      }
    },
    dataSource: {
      resource: 'rfqs',
      pipeline: {
        filters: [
          { field: 'Status', op: 'eq', value: 'Awaiting Quotations' }
        ],
        aggregate: {
          type: 'count'
        }
      }
    }
  }
}
