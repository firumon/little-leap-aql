export default {
  metadata: {
    id: 'invoice_status_composition',
    scope: 'operations',
    resource: 'OutletConsumptionInvoices',
    permission: {
      OutletConsumptionInvoices: 'read'
    },
    config: {
      type: 'DonutChartWidget',
      title: 'Invoice Payment Status',
      icon: 'donut_large',
      color: 'primary',
      weight: 190,
      layout: {
        xs: 12,
        sm: 12,
        md: 4,
        lg: 4
      },
      chart: {
        emptyMessage: 'No invoice tracking history available'
      }
    },
    dataSource: {
      resource: 'OutletConsumptionInvoices',
      evaluate: (data) => {
        let pending = 0
        let partial = 0
        let paid = 0

        data.forEach((inv) => {
          if (String(inv.Status || '').toUpperCase() !== 'ACTIVE') return
          const progress = String(inv.Progress || '').toUpperCase().trim()
          if (progress === 'CANCELLED') return

          if (progress === 'PENDING_PAYMENT') {
            pending++
          } else if (progress === 'PARTIALLY_PAID') {
            partial++
          } else if (progress === 'PAID') {
            paid++
          }
        })

        const segments = [
          { label: 'Paid', value: paid, color: 'hsl(142, 70%, 45%)' },
          { label: 'Partially Paid', value: partial, color: 'hsl(170, 70%, 40%)' },
          { label: 'Unpaid', value: pending, color: 'hsl(25, 100%, 50%)' }
        ].filter((s) => s.value > 0)

        return segments
      }
    }
  }
}
