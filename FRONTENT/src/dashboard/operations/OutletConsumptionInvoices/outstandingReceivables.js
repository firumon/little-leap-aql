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

          // Invoice total amount formula: Subtotal - Discount + Tax
          const total = Number(inv.Subtotal || 0) - Number(inv.Discount || 0) + Number(inv.Tax || 0)

          // Sum up all active, submitted payments for this specific invoice
          const paid = payments
            .filter((p) => {
              return String(p.OutletConsumptionInvoiceCode || '').toUpperCase().trim() === String(inv.Code || '').toUpperCase().trim() &&
                String(p.Status || '').toUpperCase() === 'ACTIVE' &&
                String(p.Progress || '').toUpperCase().trim() === 'SUBMITTED'
            })
            .reduce((sum, p) => sum + Number(p.Amount || 0), 0)

          outstanding += Math.max(0, total - paid)
        })

        // Dynamically format using App.Config's default currency without hardcoding
        return context._C(outstanding, true)
      }
    }
  }
}
