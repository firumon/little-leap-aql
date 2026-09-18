/**
 * Domain data composable for follow-up response times, velocity, and completion rates.
 *
 * Reads:
 *   LeadFollowUps: RespondDate, Date, Progress, CreatedAt
 *
 * Exposes:
 *   loading                 - Boolean computed, true if LeadFollowUps is loading with 0 rows
 *   respondDelayThisMonth   - Average respond delay in days for responses this month
 *   respondDelayLastMonth   - Average respond delay in days for responses last month
 *   thisMonthResponseCount  - Count of measurable responses in current month
 *   lastMonthResponseCount  - Count of measurable responses in previous month
 *   responsesPerDay         - Array of 30 daily data points ({ x: 'YYYY-MM-DD', y: count })
 *   postponeMix             - Array of responded counts by status ([Completed, Postponed, Cancelled])
 *   totalRespondedCount     - Count of all responded follow-ups
 *   totalFollowUpsCount     - Total count of all follow-ups (base count unaffected by controls)
 *   bookedMix               - Follow-ups created in selected window grouped by progress bucket
 *   bookedCount             - Count of follow-ups created in selected window
 *   range                   - Ref holding current selected range ('$last7Days' | '$last30Days' | '$last90Days')
 *   controls                - Array of data controls (range: $last7Days | $last30Days | $last90Days)
 *
 * Controls:
 *   range: plain picker switching window between 7d, 30d, and 3m
 */

import { ref, computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import { dataControl } from 'src/composables/data/useDataControls'
import {
  CANCELLED,
  COMPLETED,
  POSTPONED,
  PROGRESS_ORDER,
  isResponded,
  progressOf,
  progressBucket,
  respondDelayDays
} from './_shared'

const DAY = 24 * 60 * 60 * 1000
const dayKey = (t) => new Date(t).toISOString().slice(0, 10)

export default function useFollowUpResponseData() {
  const { rows, isLoading, remember } = useRecord()
  const { inRange, mean, topN, daysSince } = useDataContext()

  return remember('useFollowUpResponseData', () => {
    const loading = computed(() => isLoading('LeadFollowUps') && rows('LeadFollowUps').length === 0)

    const allRows = computed(() => rows('LeadFollowUps'))
    const totalFollowUpsCount = computed(() => allRows.value.length)

    const thisMonthDelays = computed(() => {
      return allRows.value
        .filter((r) => inRange(r.RespondDate, '$thisMonth'))
        .map(respondDelayDays)
        .filter((d) => d !== null)
    })

    const lastMonthDelays = computed(() => {
      return allRows.value
        .filter((r) => inRange(r.RespondDate, '$lastMonth'))
        .map(respondDelayDays)
        .filter((d) => d !== null)
    })

    const respondDelayThisMonth = computed(() => {
      const m = mean(thisMonthDelays.value) ?? 0
      return Number(m.toFixed(1))
    })

    const respondDelayLastMonth = computed(() => {
      const m = mean(lastMonthDelays.value) ?? 0
      return Number(m.toFixed(1))
    })

    const thisMonthResponseCount = computed(() => thisMonthDelays.value.length)
    const lastMonthResponseCount = computed(() => lastMonthDelays.value.length)

    const responsesPerDay = computed(() => {
      const list = allRows.value
      const now = Date.now()
      const perDay = new Map()

      for (let d = 29; d >= 0; d--) {
        perDay.set(dayKey(now - d * DAY), 0)
      }

      for (const r of list) {
        const age = daysSince(r.RespondDate)
        if (age === null || age < 0) continue
        const key = dayKey(now - age * DAY)
        if (perDay.has(key)) {
          perDay.set(key, perDay.get(key) + 1)
        }
      }

      return [...perDay.entries()].map(([x, y]) => ({ x, y }))
    })

    const responded = computed(() => allRows.value.filter(isResponded))
    const totalRespondedCount = computed(() => responded.value.length)

    const postponeMix = computed(() => {
      const counts = {
        [COMPLETED]: 0,
        [POSTPONED]: 0,
        [CANCELLED]: 0
      }

      for (const r of responded.value) {
        const p = progressOf(r)
        if (counts[p] !== undefined) counts[p]++
      }

      return [
        { label: COMPLETED, value: counts[COMPLETED] },
        { label: POSTPONED, value: counts[POSTPONED] },
        { label: CANCELLED, value: counts[CANCELLED] }
      ]
    })

    const range = ref('$last30Days')

    const rangeRows = computed(() => {
      return allRows.value.filter((r) => inRange(r.CreatedAt, range.value))
    })

    const bookedCount = computed(() => rangeRows.value.length)

    const bookedMix = computed(() => {
      const counts = new Map()
      for (const r of rangeRows.value) {
        const bucket = progressBucket(r)
        counts.set(bucket, (counts.get(bucket) || 0) + 1)
      }
      return topN(counts, PROGRESS_ORDER.length)
    })

    const controls = [
      dataControl('range', {
        type: 'plain',
        options: [
          { label: '7d', value: '$last7Days' },
          { label: '30d', value: '$last30Days' },
          { label: '3m', value: '$last90Days' }
        ],
        value: range
      })
    ]

    return {
      loading,
      respondDelayThisMonth,
      respondDelayLastMonth,
      thisMonthResponseCount,
      lastMonthResponseCount,
      responsesPerDay,
      postponeMix,
      totalRespondedCount,
      totalFollowUpsCount,
      bookedMix,
      bookedCount,
      range,
      controls
    }
  })
}
