/**
 * Domain data composable for Leads intake and volume trends.
 *
 * Reads:
 *   Leads: CreatedAt
 *
 * Exposes:
 *   loading             - Boolean computed, true if Leads resource is loading with 0 rows
 *   newLeadsCount       - Count of leads created in the last 7 days
 *   newLeadsCompare     - Count of leads created in the prior 7-day period (days 8-14 ago)
 *   leadsPerDay         - Array of 30 daily data points ({ x: 'YYYY-MM-DD', y: count })
 *   controls            - Empty array (no controls)
 *
 * Controls:
 *   none
 */

import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'

const DAY = 24 * 60 * 60 * 1000
const dayKey = (t) => new Date(t).toISOString().slice(0, 10)

export default function useLeadIntakeData() {
  const { rows, isLoading, remember } = useRecord()
  const { countAt, daysAgo, daysSince } = useDataContext()

  return remember('useLeadIntakeData', () => {
    const loading = computed(() => isLoading('Leads') && rows('Leads').length === 0)

    const newLeadsCount = computed(() => {
      return countAt(rows('Leads'), [daysAgo(7), Date.now()], null, 'CreatedAt')
    })

    const newLeadsCompare = computed(() => {
      return countAt(rows('Leads'), [daysAgo(14), daysAgo(7)], null, 'CreatedAt')
    })

    const leadsPerDay = computed(() => {
      const list = rows('Leads')
      const now = Date.now()
      const perDay = new Map()

      for (let d = 29; d >= 0; d--) {
        perDay.set(dayKey(now - d * DAY), 0)
      }

      for (const r of list) {
        const age = daysSince(r.CreatedAt)
        if (age === null || age < 0) continue
        const key = dayKey(now - age * DAY)
        if (perDay.has(key)) {
          perDay.set(key, perDay.get(key) + 1)
        }
      }

      return [...perDay.entries()].map(([x, y]) => ({ x, y }))
    })

    const controls = []

    return {
      loading,
      newLeadsCount,
      newLeadsCompare,
      leadsPerDay,
      controls
    }
  })
}
