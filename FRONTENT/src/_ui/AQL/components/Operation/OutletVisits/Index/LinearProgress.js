function isActive (value) {
  if (value == null || value === 'Active') return true
  return String(value).trim() === 'Active'
}

function isPlanned (value) {
  if (value === 'PLANNED') return true
  return String(value ?? '').trim().toUpperCase() === 'PLANNED'
}

function isIsoDate (value) {
  return typeof value === 'string' &&
    value.length >= 10 &&
    value.charCodeAt(4) === 45 &&
    value.charCodeAt(7) === 45
}

export default function (props, { resourceRecord }) {
  return {
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      let todayCount = 0
      let completedCount = 0

      for (let i = 0; i < records.length; i++) {
        const row = records[i]
        if (!row) continue
        if (!isActive(row.Status)) continue

        const date = row.Date || row.ScheduledAt
        if (!isIsoDate(date) || !date.startsWith(today)) continue

        todayCount++
        if (!isPlanned(row.Progress)) completedCount++
      }

      return [
        { label: 'Completed Visits', value: completedCount, max: todayCount, color: 'positive' }
      ]
    }
  }
}
