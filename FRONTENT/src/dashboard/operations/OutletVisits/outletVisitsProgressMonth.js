export default {
  metadata: {
    id: 'outlet_visits_progress_month',
    scope: 'operations',
    resource: 'OutletVisits',
    permission: {
      OutletVisits: ['Complete', 'Postpone']
    },
    config: {
      type: 'ProgressBarWidget',
      title: 'Outlet Visit Execution Progress',
      icon: 'playlist_add_check',
      color: 'primary',
      weight: 170,
      layout: {
        xs: 12,
        sm: 12,
        md: 12,
        lg: 12
      },
      chart: {
        segments: [
          {
            key: 'completed',
            label: 'Completed',
            color: 'green',
            gradientStart: 'hsl(142, 70%, 45%)',
            gradientEnd: 'hsl(142, 60%, 35%)'
          },
          {
            key: 'postponed',
            label: 'Postponed',
            color: 'orange',
            gradientStart: 'hsl(25, 100%, 50%)',
            gradientEnd: 'hsl(25, 75%, 40%)'
          },
          {
            key: 'remaining',
            label: 'Remaining',
            color: 'grey',
            gradientStart: 'rgba(255, 255, 255, 0.25)',
            gradientEnd: 'rgba(255, 255, 255, 0.1)'
          }
        ]
      }
    },
    dataSource: {
      resource: 'OutletVisits',
      evaluate: (data) => {
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth()

        let total = 0
        let completed = 0
        let postponed = 0
        let remaining = 0

        data.forEach((r) => {
          if (!r.Date) return
          
          const d = new Date(r.Date)
          if (isNaN(d.getTime())) return

          const y = d.getFullYear()
          const m = d.getMonth()

          // Only aggregate visits planned for the current calendar month
          if (y === currentYear && m === currentMonth) {
            total++

            const progress = String(r.Progress || r.Status || '').toUpperCase()
            if (progress === 'COMPLETED') {
              completed++
            } else if (progress === 'POSTPONED') {
              postponed++
            } else {
              remaining++
            }
          }
        })

        return {
          total,
          completed,
          postponed,
          remaining
        }
      }
    }
  }
}
