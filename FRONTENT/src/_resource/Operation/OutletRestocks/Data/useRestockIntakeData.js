/**
 * How many restocks come in, from where, and the user's own unsent drafts.
 * A draft is not a request yet, so every intake number leaves drafts out.
 *
 * Reads:
 *   OutletRestocks: Date, Progress, Status, OutletCode, CreatedBy, RequestedUser
 *   Outlets (through useOutletResource): Code, Name
 *
 * Exposes:
 *   loading         - true while OutletRestocks is loading and has no rows
 *   myDraftCount    - DRAFT restocks owned by the signed-in user (CreatedBy or RequestedUser)
 *   raisedToday     - restocks dated today
 *   raisedYesterday - restocks dated yesterday
 *   perDay          - 30 points, one per day, x = the day, y = restocks dated that day
 *   raisedCount     - every active non-draft restock, the base count for topOutlets
 *   topOutlets      - top 8 outlets by restocks inside the chosen range, with outlet names
 *   range           - ref holding the chosen range word
 *   controls        - range
 *
 * Controls:
 *   range: menu picker, $last7Days / $last30Days / $last90Days / $thisMonth / $lastMonth,
 *          changes the window topOutlets counts in
 */

import { ref, computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import { dataControl } from 'src/composables/data/useDataControls'
import { useAuth } from 'src/composables/core/useAuth'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import { isActiveRow, isDraft, isOwnedBy } from './_shared'

const DAY = 24 * 60 * 60 * 1000
const dayKey = (t) => new Date(t).toISOString().slice(0, 10)
const RANGES = ['$last7Days', '$last30Days', '$last90Days', '$thisMonth', '$lastMonth']

export default function useRestockIntakeData () {
  const { rows, isLoading, remember } = useRecord()
  const { countAt, daysAgo, daysSince, inRange, rangeLabel, topN } = useDataContext()
  const { user } = useAuth()
  const { getOutlet } = useOutletResource()

  return remember('useRestockIntakeData', () => {
    const loading = computed(() => isLoading('OutletRestocks') && rows('OutletRestocks').length === 0)

    const active = computed(() => rows('OutletRestocks').filter(isActiveRow))
    const raised = computed(() => active.value.filter((r) => !isDraft(r)))
    const raisedCount = computed(() => raised.value.length)

    const myDraftCount = computed(() =>
      active.value.filter((r) => isDraft(r) && isOwnedBy(r, user.value?.id)).length)

    const raisedToday = computed(() => countAt(raised.value, [daysAgo(0), Date.now()]))
    const raisedYesterday = computed(() => countAt(raised.value, [daysAgo(1), daysAgo(0) - 1]))

    const perDay = computed(() => {
      const now = Date.now()
      const days = new Map()
      for (let d = 29; d >= 0; d--) days.set(dayKey(now - d * DAY), 0)
      for (const r of raised.value) {
        const age = daysSince(r.Date)
        if (age === null || age < 0) continue
        const key = dayKey(now - age * DAY)
        if (days.has(key)) days.set(key, days.get(key) + 1)
      }
      return [...days.entries()].map(([x, y]) => ({ x, y }))
    })

    const range = ref('$last30Days')

    const topOutlets = computed(() => {
      const counts = new Map()
      for (const r of raised.value) {
        if (!inRange(r.Date, range.value)) continue
        counts.set(r.OutletCode, (counts.get(r.OutletCode) || 0) + 1)
      }
      return topN(counts, 8, (code) => getOutlet(code)?.name || code)
    })

    const controls = [
      dataControl('range', {
        type: 'menu',
        options: RANGES.map((value) => ({ label: rangeLabel(value), value })),
        value: range
      })
    ]

    return {
      loading,
      myDraftCount,
      raisedToday,
      raisedYesterday,
      perDay,
      raisedCount,
      topOutlets,
      range,
      controls
    }
  })
}
