import { getInvoiceTotal } from 'src/composables/operations/outlets/outletConsumptionPricing'

export default {
  metadata: {
    id: 'invoiced_vs_collected_7days',
    scope: 'operations',
    resource: 'OutletPayments',
    permission: {
      OutletConsumptionInvoices: 'read',
      OutletPayments: 'read'
    },
    config: {
      type: 'StackedBarChartWidget',
      title: 'Daily Invoicing vs. Collection (Last 7 Days)',
      icon: 'trending_up',
      color: 'purple',
      weight: 160,
      layout: {
        xs: 12,
        sm: 12,
        md: 8,
        lg: 8
      },
      chart: {
        series: [
          {
            key: 'invoiced',
            label: 'Amount Billed',
            gradientStart: 'hsl(210, 85%, 55%)',
            gradientEnd: 'hsl(210, 70%, 45%)',
            shadowColor: 'hsl(210, 85%, 55%)'
          },
          {
            key: 'collected',
            label: 'Amount Collected',
            gradientStart: 'hsl(142, 70%, 45%)',
            gradientEnd: 'hsl(142, 60%, 35%)',
            shadowColor: 'hsl(142, 70%, 45%)'
          }
        ],
        emptyMessage: 'No billing or collection activity in the last 7 days'
      }
    },
    dataSource: {
      resources: ['OutletConsumptionInvoices', 'OutletPayments'],
      evaluate: ([invoices, payments]) => {
        const dates = []
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

        // Generate last 7 calendar days dynamically based on local browser time
        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const year = d.getFullYear()
          const month = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          const dateStr = `${year}-${month}-${day}`

          let label = `${daysOfWeek[d.getDay()]} ${d.getDate()}`
          if (i === 0) label = 'Today'
          else if (i === 1) label = 'Yest'

          dates.push({ dateStr, label })
        }

        return dates.map(({ dateStr, label }) => {
          // Filter invoices for this date
          const dayInvoices = invoices.filter((inv) => {
            const rDate = inv.Date ? String(inv.Date).slice(0, 10) : ''
            return rDate === dateStr &&
              String(inv.Status || '').toUpperCase() === 'ACTIVE' &&
              String(inv.Progress || '').toUpperCase().trim() !== 'CANCELLED'
          })

          // Filter payments for this date
          const dayPayments = payments.filter((p) => {
            const rDate = p.Date ? String(p.Date).slice(0, 10) : ''
            return rDate === dateStr &&
              String(p.Status || '').toUpperCase() === 'ACTIVE' &&
              String(p.Progress || '').toUpperCase().trim() === 'SUBMITTED'
          })

          // Sum billing volume using pricing helper
          const invoiced = dayInvoices.reduce((sum, inv) => {
            return sum + getInvoiceTotal(inv)
          }, 0)

          // Sum payment collections volume
          const collected = dayPayments.reduce((sum, p) => {
            return sum + Number(p.Amount || 0)
          }, 0)

          return {
            label,
            date: dateStr,
            invoiced: Number(invoiced.toFixed(2)),
            collected: Number(collected.toFixed(2))
          }
        })
      }
    }
  }
}
