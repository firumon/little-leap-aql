import { useCurrency } from 'src/composables/useCurrency'

export default {
  metadata: {
    id: 'collections_volume_comparison',
    scope: 'operations',
    resource: 'OutletPayments',
    permission: {
      OutletPayments: 'read'
    },
    config: {
      type: 'ComparisonWidget',
      title: 'Collected Payments (MTD)',
      icon: 'payments',
      color: 'green',
      weight: 170,
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
        verb: 'collected',
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
      resource: 'OutletPayments',
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

        let collectedThisMonth = 0
        let collectedLastMonth = 0

        data.forEach((p) => {
          if (String(p.Status || '').toUpperCase() !== 'ACTIVE') return
          if (String(p.Progress || '').toUpperCase().trim() === 'CANCELLED') return
          if (!p.Date) return

          const d = new Date(p.Date)
          if (isNaN(d.getTime())) return

          const y = d.getFullYear()
          const m = d.getMonth()

          const amount = Number(p.Amount || 0)

          if (y === currentYear && m === currentMonth) {
            collectedThisMonth += amount
          } else if (y === prevYear && m === prevMonth) {
            collectedLastMonth += amount
          }
        })

        // Standardize float limits
        collectedThisMonth = Number(collectedThisMonth.toFixed(2))
        collectedLastMonth = Number(collectedLastMonth.toFixed(2))

        const difference = Number((collectedThisMonth - collectedLastMonth).toFixed(2))
        const percentage = collectedLastMonth > 0 
          ? Number(((difference / collectedLastMonth) * 100).toFixed(1)) 
          : 0

        return {
          current: collectedThisMonth,
          previous: collectedLastMonth,
          difference,
          percentage
        }
      }
    }
  }
}
