export default {
  metadata: {
    id: 'restock_efficiency_7days',
    scope: 'operations',
    resource: 'OutletRestocks',
    permission: {
      OutletRestocks: 'read'
    },
    config: {
      type: 'StackedBarChartWidget',
      title: 'Restock & Delivery Efficiency (Last 7 Days)',
      icon: 'trending_up',
      color: 'green',
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
            key: 'restocked',
            label: 'Restocked',
            gradientStart: 'hsl(210, 85%, 55%)',
            gradientEnd: 'hsl(210, 70%, 45%)',
            shadowColor: 'hsl(210, 85%, 55%)'
          },
          {
            key: 'approved',
            label: 'Approved',
            gradientStart: 'hsl(35, 100%, 55%)',
            gradientEnd: 'hsl(25, 100%, 45%)',
            shadowColor: 'hsl(35, 100%, 55%)'
          },
          {
            key: 'delivered',
            label: 'Delivered',
            gradientStart: 'hsl(142, 70%, 45%)',
            gradientEnd: 'hsl(142, 60%, 35%)',
            shadowColor: 'hsl(142, 70%, 45%)'
          }
        ],
        emptyMessage: 'No restock activity in the last 7 days'
      }
    },
    dataSource: {
      resource: 'OutletRestocks',
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

        return dates.map(({ dateStr, label }) => {
          const dayRecords = data.filter(r => {
            const rDate = r.Date ? String(r.Date).slice(0, 10) : ''
            return rDate === dateStr
          })

          // Total restocks excluding DRAFT and REJECTED
          const restocked = dayRecords.filter(r => {
            const progress = String(r.Progress || '').toUpperCase().trim()
            return progress !== 'DRAFT' && progress !== 'REJECTED'
          }).length

          // Approved restocks (APPROVED + PARTIALLY_DELIVERED + DELIVERED)
          const approved = dayRecords.filter(r => {
            const progress = String(r.Progress || '').toUpperCase().trim()
            return progress === 'APPROVED' || progress === 'PARTIALLY_DELIVERED' || progress === 'DELIVERED'
          }).length

          // Fully delivered restocks
          const delivered = dayRecords.filter(r => {
            const progress = String(r.Progress || '').toUpperCase().trim()
            return progress === 'DELIVERED'
          }).length

          return {
            label,
            date: dateStr,
            restocked,
            approved,
            delivered
          }
        })
      }
    }
  }
}
