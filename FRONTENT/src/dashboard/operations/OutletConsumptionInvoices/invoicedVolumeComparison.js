import { useCurrency } from 'src/composables/useCurrency'
import { getInvoiceTotal } from 'src/composables/operations/outlets/outletConsumptionPricing'

export default {
  metadata: {
    id: 'invoiced_volume_comparison',
    scope: 'operations',
    resource: 'OutletConsumptionInvoices',
    permission: {
      OutletConsumptionInvoices: 'read'
    },
    config: {
      type: 'ComparisonWidget',
      title: 'Invoiced Volume (MTD)',
      icon: 'receipt_long',
      color: 'blue',
      weight: 180,
      layout: {
        xs: 12,
        sm: 6,
        md: 6,
        lg: 6
      },
      comparison: {
        // Dynamic getter to resolve currency code dynamically from App.Config
        get unit() {
          const { defaultCurrencyCode } = useCurrency()
          return defaultCurrencyCode.value || 'AED'
        },
        verb: 'billed',
        currentLabel: 'This month',
        previousLabel: 'last month',
        descriptionTemplate: '{currentLabel} {unit} {current} {verb} which is {unit} {absDifference} {trend} than that of {previousLabel}\'s {previous}.',
        trendLabels: {
          up: 'more',
          down: 'less',
          equal: 'equal'
        }
      }
    },
    dataSource: {
      resource: 'OutletConsumptionInvoices',
      evaluate: (data) => {
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth()

        let prevYear = currentYear
        let prevMonth = currentMonth - 1
        if (prevMonth < 0) {
          prevMonth = 11
          prevYear = currentYear - 1
        }

        let billedThisMonth = 0
        let billedLastMonth = 0

        data.forEach((inv) => {
          if (String(inv.Status || '').toUpperCase() !== 'ACTIVE') return
          if (String(inv.Progress || '').toUpperCase().trim() === 'CANCELLED') return
          if (!inv.Date) return

          const d = new Date(inv.Date)
          if (isNaN(d.getTime())) return

          const y = d.getFullYear()
          const m = d.getMonth()

          // Invoice Total using pricing helper
          const amount = getInvoiceTotal(inv)

          if (y === currentYear && m === currentMonth) {
            billedThisMonth += amount
          } else if (y === prevYear && m === prevMonth) {
            billedLastMonth += amount
          }
        })

        // Standardize float limits
        billedThisMonth = Number(billedThisMonth.toFixed(2))
        billedLastMonth = Number(billedLastMonth.toFixed(2))

        const difference = Number((billedThisMonth - billedLastMonth).toFixed(2))
        const percentage = billedLastMonth > 0 
          ? Number(((difference / billedLastMonth) * 100).toFixed(1)) 
          : 0

        return {
          current: billedThisMonth,
          previous: billedLastMonth,
          difference,
          percentage
        }
      }
    }
  }
}
