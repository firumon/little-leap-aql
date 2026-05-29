import { getInvoiceRemaining } from 'src/composables/operations/outlets/outletConsumptionPricing'

export default {
  metadata: {
    id: 'outstanding_receivables_metric',
    scope: 'operations',
    resource: 'OutletConsumptionInvoices',
    permission: {
      OutletConsumptionInvoices: 'read',
      OutletPayments: 'read'
    },
    config: {
      type: 'MetricWidget',
      title: 'Outstanding Receivables',
      icon: 'account_balance_wallet',
      color: 'orange',
      weight: 200,
      layout: {
        xs: 12,
        sm: 6,
        md: 4,
        lg: 3
      }
    },
    dataSource: {
      resources: ['OutletConsumptionInvoices', 'OutletPayments'],
      evaluate: ([invoices, payments], context) => {
        let outstanding = 0

        invoices.forEach((inv) => {
          // Gate for active and non-cancelled/non-paid invoices
          if (String(inv.Status || '').toUpperCase() !== 'ACTIVE') return
          const progress = String(inv.Progress || '').toUpperCase().trim()
          if (progress === 'CANCELLED' || progress === 'PAID') return

          // Use financial helper to compute unpaid balance including ReturnDeductionTotal
          outstanding += getInvoiceRemaining(inv, payments)
        })

        // Dynamically format using App.Config's default currency without hardcoding
        return context._C(outstanding, true)
      }
    }
  }
}
