export default {
  metadata: {
    id: 'outlet_restocks_status_composition',
    scope: 'operations',
    resource: 'OutletRestocks',
    permission: {
      OutletRestocks: 'read'
    },
    config: {
      type: 'DonutChartWidget',
      title: 'Restock Status Composition',
      icon: 'pie_chart',
      color: 'primary',
      weight: 170,
      layout: {
        xs: 12,
        sm: 12,
        md: 4,
        lg: 4
      },
      chart: {
        emptyMessage: 'No active restock requests recorded'
      }
    },
    dataSource: {
      resource: 'OutletRestocks',
      evaluate: (data) => {
        let pending = 0
        let approved = 0
        let delivered = 0
        let rejected = 0

        data.forEach((r) => {
          // Avoid DRAFT state
          const progress = String(r.Progress || '').toUpperCase().trim()
          if (!progress || progress === 'DRAFT') return

          if (progress === 'PENDING_APPROVAL' || progress === 'REVISION_REQUIRED') {
            pending++
          } else if (progress === 'APPROVED' || progress === 'PARTIALLY_DELIVERED') {
            approved++
          } else if (progress === 'DELIVERED') {
            delivered++
          } else if (progress === 'REJECTED') {
            rejected++
          }
        })

        const segments = [
          { label: 'Pending', value: pending, color: 'hsl(25, 100%, 50%)' },
          { label: 'Approved', value: approved, color: 'hsl(180, 70%, 45%)' },
          { label: 'Delivered', value: delivered, color: 'hsl(142, 70%, 45%)' },
          { label: 'Rejected', value: rejected, color: 'hsl(0, 85%, 60%)' }
        ].filter(s => s.value > 0)

        return segments
      }
    }
  }
}
