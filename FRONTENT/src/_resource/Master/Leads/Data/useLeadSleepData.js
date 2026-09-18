/**
 * Domain data composable for sleeping leads and wake-up queues.
 *
 * Reads:
 *   Leads: Progress, ProgressLaterAt, Name, Code
 *
 * Exposes:
 *   loading             - Boolean computed, true if Leads resource is loading with 0 rows
 *   sleepingCount       - Total count of leads in Later progress
 *   staleSleepingCount  - Count of sleeping leads asleep for over 90 days
 *   wakeUpDue           - Top 5 sleeping leads longest on hold ({ label, value: days })
 *   controls            - Empty array (no controls)
 *
 * Controls:
 *   none
 */

import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import { LATER, progressOf } from './_shared'

export default function useLeadSleepData() {
  const { rows, isLoading, remember } = useRecord()
  const { daysSince } = useDataContext()

  return remember('useLeadSleepData', () => {
    const loading = computed(() => isLoading('Leads') && rows('Leads').length === 0)

    const sleeping = computed(() => rows('Leads').filter((r) => progressOf(r) === LATER))

    const sleepingCount = computed(() => sleeping.value.length)

    const stale = computed(() => {
      return sleeping.value.filter((r) => {
        const days = daysSince(r.ProgressLaterAt)
        return days !== null && days > 90
      })
    })

    const staleSleepingCount = computed(() => stale.value.length)

    const sleepingWithDate = computed(() => {
      return rows('Leads').filter((r) => progressOf(r) === LATER && r.ProgressLaterAt)
    })

    const wakeUpDue = computed(() => {
      return sleepingWithDate.value
        .map((r) => {
          const days = daysSince(r.ProgressLaterAt)
          return {
            label: r.Name || r.Code,
            value: Math.round(days ?? 0)
          }
        })
        .filter((it) => it.value >= 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
    })

    const controls = []

    return {
      loading,
      sleepingCount,
      staleSleepingCount,
      wakeUpDue,
      controls
    }
  })
}
