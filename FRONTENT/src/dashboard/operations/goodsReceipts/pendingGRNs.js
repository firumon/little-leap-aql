export default {
  metadata: {
    id: 'pending_grns',
    scope: 'operations',
    resource: 'goodsReceipts',
    permission: {
      goodsReceipts: 'read'
    },
    config: {
      type: 'TimelineWidget',
      title: 'Recent Pending GRNs',
      icon: 'receipt',
      color: 'teal',
      weight: 70,
      layout: {
        xs: 12,
        sm: 12,
        md: 4,
        lg: 4
      }
    },
    dataSource: {
      resource: 'goodsReceipts',
      pipeline: {
        filters: [
          { field: 'Status', op: 'eq', value: 'Pending Receipt' }
        ]
      },
      evaluate: (records) => {
        // Sort descending by CreatedAt and map to Timeline structure
        return records
          .sort((a, b) => {
            const dateA = new Date(a.CreatedAt || 0)
            const dateB = new Date(b.CreatedAt || 0)
            return dateB - dateA
          })
          .slice(0, 5)
          .map((rec) => ({
            title: rec.Code || 'Unknown GRN',
            subtitle: `Supplier: ${rec.SupplierCode || 'N/A'}`,
            timestamp: rec.CreatedAt || '',
            status: rec.Status || 'Pending Receipt'
          }))
      }
    }
  }
}
