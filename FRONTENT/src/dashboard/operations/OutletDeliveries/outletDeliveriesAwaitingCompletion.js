export default {
  metadata: {
    id: 'outlet_deliveries_awaiting_completion',
    scope: 'operations',
    resource: 'OutletDeliveries',
    permission: {
      OutletDeliveries: 'read'
    },
    config: {
      type: 'TimelineWidget',
      title: 'Deliveries Awaiting Completion',
      icon: 'hourglass_empty',
      color: 'orange',
      weight: 165,
      layout: {
        xs: 12,
        sm: 12,
        md: 4,
        lg: 4
      },
      chart: {
        emptyMessage: 'No deliveries awaiting completion'
      }
    },
    dataSource: {
      resource: 'OutletDeliveries',
      evaluate: (data) => {
        // Filter active and non-cancelled/non-completed deliveries (IN_TRANSIT or DRAFT only)
        const activeDeliveries = data.filter((r) => {
          const status = String(r.Status || 'Active').toUpperCase().trim()
          if (status !== 'ACTIVE') return false

          const progress = String(r.Progress || '').toUpperCase().trim()
          return progress === 'IN_TRANSIT' || progress === 'DRAFT'
        })

        const parseTime = (row) => {
          const v = row.UpdatedAt || row.CreatedAt || row.Date || ''
          return typeof v === 'number' ? v : (Date.parse(String(v)) || 0)
        }

        const sorted = activeDeliveries.sort((a, b) => parseTime(b) - parseTime(a))
        const top5 = sorted.slice(0, 5)

        return top5.map((r) => {
          const itemCount = r.OutletRestockItemCodes 
            ? String(r.OutletRestockItemCodes).split(',').filter(Boolean).length 
            : 0
          return {
            title: `Delivery ${r.Code}`,
            subtitle: `By ${r.UserName || 'System'} · ${itemCount} item${itemCount === 1 ? '' : 's'}`,
            timestamp: r.Date || r.CreatedAt || '',
            status: r.Progress
          }
        })
      }
    }
  }
}
