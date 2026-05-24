export default {
  metadata: {
    id: 'outlet_visits_comparison_month',
    scope: 'operations',
    resource: 'OutletVisits',
    permission: {
      OutletVisits: ['Complete', 'Postpone']
    },
    config: {
      type: 'ComparisonWidget',
      title: 'Outlet Visit Completion',
      icon: 'check_circle',
      color: 'green',
      weight: 160,
      layout: {
        xs: 6,
        sm: 6,
        md: 6,
        lg: 6
      },
      comparison: {
        unit: 'visits',
        verb: 'completed',
        currentLabel: 'This month',
        previousLabel: 'last month',
        descriptionTemplate: '{currentLabel} {current} {unit} {verb} which is {absDifference} {trend} than that of {previousLabel}\'s {previous}.',
        trendLabels: {
          up: 'more',
          down: 'less',
          equal: 'equal'
        }
      }
    },
    dataSource: {
      resource: 'OutletVisits',
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

        let completedThisMonth = 0
        let completedLastMonth = 0

        data.forEach((r) => {
          const progress = String(r.Progress || r.Status || '').toUpperCase()
          if (progress !== 'COMPLETED') return

          if (!r.Date) return
          
          // Parse the date robustly supporting date strings or Date objects
          const d = new Date(r.Date)
          if (isNaN(d.getTime())) return

          const y = d.getFullYear()
          const m = d.getMonth()

          if (y === currentYear && m === currentMonth) {
            completedThisMonth++
          } else if (y === prevYear && m === prevMonth) {
            completedLastMonth++
          }
        })

        const difference = completedThisMonth - completedLastMonth
        const percentage = completedLastMonth > 0 
          ? Number(((difference / completedLastMonth) * 100).toFixed(1)) 
          : 0

        return {
          current: completedThisMonth,
          previous: completedLastMonth,
          difference,
          percentage
        }
      }
    }
  }
}
