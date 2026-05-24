export default {
  metadata: {
    id: 'outlet_visits_postponed_comparison_month',
    scope: 'operations',
    resource: 'OutletVisits',
    permission: {
      OutletVisits: ['Complete', 'Postpone']
    },
    config: {
      type: 'ComparisonWidget',
      title: 'Outlet Visit Postponed',
      icon: 'event_busy',
      color: 'orange',
      weight: 155,
      layout: {
        xs: 6,
        sm: 6,
        md: 6,
        lg: 6
      },
      comparison: {
        unit: 'visits',
        verb: 'postponed',
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

        let postponedThisMonth = 0
        let postponedLastMonth = 0

        data.forEach((r) => {
          const progress = String(r.Progress || r.Status || '').toUpperCase()
          if (progress !== 'POSTPONED') return

          if (!r.Date) return
          
          const d = new Date(r.Date)
          if (isNaN(d.getTime())) return

          const y = d.getFullYear()
          const m = d.getMonth()

          if (y === currentYear && m === currentMonth) {
            postponedThisMonth++
          } else if (y === prevYear && m === prevMonth) {
            postponedLastMonth++
          }
        })

        const difference = postponedThisMonth - postponedLastMonth
        const percentage = postponedLastMonth > 0 
          ? Number(((difference / postponedLastMonth) * 100).toFixed(1)) 
          : 0

        return {
          current: postponedThisMonth,
          previous: postponedLastMonth,
          difference,
          percentage
        }
      }
    }
  }
}
