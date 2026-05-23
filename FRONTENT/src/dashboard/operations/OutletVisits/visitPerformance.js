export default {
  metadata: {
    id: 'outlet_visits_performance',
    scope: 'operations',
    resource: 'OutletVisits',
    permission: {
      OutletVisits: ['Complete', 'Postpone'] // Gates widget by allowed Complete AND Postpone actions
    },
    config: {
      type: 'StackedBarChartWidget',
      title: 'Outlet Visit Performance (Last 7 Days)',
      icon: 'date_range',
      color: 'green',
      weight: 150,
      layout: {
        xs: 12,
        sm: 12,
        md: 6,
        lg: 6
      },
      chart: {
        series: [
          {
            key: 'completed',
            label: 'Completed',
            gradientStart: 'hsl(142, 70%, 45%)',
            gradientEnd: 'hsl(142, 60%, 35%)',
            shadowColor: 'hsl(142, 70%, 45%)'
          },
          {
            key: 'postponed',
            label: 'Postponed',
            gradientStart: 'hsl(215, 16%, 65%)',
            gradientEnd: 'hsl(215, 12%, 50%)',
            shadowColor: 'hsl(215, 16%, 65%)'
          }
        ],
        emptyMessage: 'No visit activity in the last 7 days'
      }
    },
    dataSource: {
      resource: 'OutletVisits',
      evaluate: (data) => {
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

        // Count completed & postponed visits per date
        return dates.map(({ dateStr, label }) => {
          const completed = data.filter(r => {
            const rDate = r.Date ? String(r.Date).slice(0, 10) : ''
            const progress = String(r.Progress || r.Status || '').toUpperCase()
            return rDate === dateStr && progress === 'COMPLETED'
          }).length

          const postponed = data.filter(r => {
            const rDate = r.Date ? String(r.Date).slice(0, 10) : ''
            const progress = String(r.Progress || r.Status || '').toUpperCase()
            return rDate === dateStr && progress === 'POSTPONED'
          }).length

          return {
            label,
            date: dateStr,
            completed,
            postponed
          }
        })
      }
    }
  }
}
