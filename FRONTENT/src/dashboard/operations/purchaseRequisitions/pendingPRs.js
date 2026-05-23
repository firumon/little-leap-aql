export default {
  metadata: {
    id: 'pending_prs',
    scope: 'operations',
    resource: 'purchaseRequisitions',
    permission: {
      purchaseRequisitions: 'read'
    },
    config: {
      type: 'MetricWidget',
      title: 'Pending PRs',
      icon: 'shopping_cart',
      color: 'orange',
      weight: 100,
      layout: {
        xs: 12,
        sm: 6,
        md: 4,
        lg: 3
      }
    },
    dataSource: {
      resource: 'purchaseRequisitions',
      pipeline: {
        filters: [
          { field: 'Status', op: 'eq', value: 'Pending' }
        ],
        aggregate: {
          type: 'count'
        }
      }
    }
  }
}
