/**
 * Money collected against invoices, collections per day, collector rankings, and cancelled payments.
 * Only payments where countsAsPayment is true are counted, except in cancelledPayments.
 *
 * Reads:
 *   OutletPayments: Date, OutletCode, OutletConsumptionInvoiceCode, Amount, Mode,
 *                   Username, Progress, ProgressCancelledAt, Status
 *   Outlets (through useOutletResource): Code, Name
 *
 * Exposes:
 *   loading                 - true while OutletPayments is loading and has no rows
 *   countedPaymentsCount    - total active payments meeting countsAsPayment
 *   collectedToday          - money collected today by Date
 *   collectedYesterday      - money collected yesterday by Date
 *   collectedThisMonth      - money collected this month by Date
 *   collectedLastMonth      - money collected last month by Date
 *   collectionsPerDay       - money per day, last 30 days
 *   topPayingOutlets        - top 8 outlets by money collected inside chosen outletRange
 *   collectionsByPerson     - money by Username inside chosen personRange
 *   cancelledThisMonthCount - cancelled payments by ProgressCancelledAt (fallback Date) this month
 *   cancelledLastMonthCount - cancelled payments by ProgressCancelledAt (fallback Date) last month
 *   outletRange             - ref holding chosen range word for outlets
 *   personRange             - ref holding chosen range word for persons
 *   controls                - array containing outletRange and personRange controls
 *
 * Controls:
 *   outletRange: menu picker, $last7Days / $last30Days / $last90Days / $thisMonth / $lastMonth,
 *                changes the window topPayingOutlets counts in
 *   personRange: menu picker, $last7Days / $last30Days / $last90Days / $thisMonth / $lastMonth,
 *                changes the window collectionsByPerson counts in
 */

import { ref, computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import { dataControl } from 'src/composables/data/useDataControls'
import { useOutletResource } from 'src/_resource/Master/Outlets/composables/useOutletResource'
import {
  isActiveRow,
  isCancelled,
  countsAsPayment
} from './_shared'

const DAY = 24 * 60 * 60 * 1000
const dayKey = (t) => new Date(t).toISOString().slice(0, 10)
const todayISO = () => new Date().toISOString().slice(0, 10)
const RANGES = ['$last7Days', '$last30Days', '$last90Days', '$thisMonth', '$lastMonth']

export default function usePaymentData () {
  const { rows, isLoading, remember } = useRecord()
  const { daysSince, inRange, rangeLabel, topN } = useDataContext()
  const { getOutlet } = useOutletResource()

  const sumTo = (map, key, n) => map.set(key, (map.get(key) || 0) + n)

  return remember('usePaymentData', () => {
    const loading = computed(() => isLoading('OutletPayments') && rows('OutletPayments').length === 0)

    const rawRows = computed(() => rows('OutletPayments'))
    const activeRows = computed(() => rawRows.value.filter(isActiveRow))
    const validPayments = computed(() => activeRows.value.filter(countsAsPayment))
    const countedPaymentsCount = computed(() => validPayments.value.length)

    // Collections today vs yesterday by Date
    const collectedToday = computed(() => {
      const today = todayISO()
      let sum = 0
      for (const p of validPayments.value) {
        if (String(p.Date || '').slice(0, 10) === today) {
          sum += Number(p.Amount) || 0
        }
      }
      return Number(sum.toFixed(2))
    })

    const collectedYesterday = computed(() => {
      const yesterday = new Date(Date.now() - DAY).toISOString().slice(0, 10)
      let sum = 0
      for (const p of validPayments.value) {
        if (String(p.Date || '').slice(0, 10) === yesterday) {
          sum += Number(p.Amount) || 0
        }
      }
      return Number(sum.toFixed(2))
    })

    // Collections this month vs last month by Date
    const collectedThisMonth = computed(() => {
      let sum = 0
      for (const p of validPayments.value) {
        if (inRange(p.Date, '$thisMonth')) {
          sum += Number(p.Amount) || 0
        }
      }
      return Number(sum.toFixed(2))
    })

    const collectedLastMonth = computed(() => {
      let sum = 0
      for (const p of validPayments.value) {
        if (inRange(p.Date, '$lastMonth')) {
          sum += Number(p.Amount) || 0
        }
      }
      return Number(sum.toFixed(2))
    })

    // Collections per day, last 30 days
    const collectionsPerDay = computed(() => {
      const now = Date.now()
      const days = new Map()
      for (let d = 29; d >= 0; d--) days.set(dayKey(now - d * DAY), 0)

      for (const p of validPayments.value) {
        const age = daysSince(p.Date)
        if (age === null || age < 0) continue
        const key = dayKey(now - age * DAY)
        if (days.has(key)) {
          days.set(key, days.get(key) + (Number(p.Amount) || 0))
        }
      }

      return [...days.entries()].map(([x, y]) => ({
        x,
        y: Number(y.toFixed(2))
      }))
    })

    // Range controls
    const outletRange = ref('$last30Days')
    const personRange = ref('$last30Days')
    const controls = [
      dataControl('outletRange', {
        type: 'menu',
        options: RANGES.map((value) => ({ label: rangeLabel(value), value })),
        value: outletRange
      }),
      dataControl('personRange', {
        type: 'menu',
        options: RANGES.map((value) => ({ label: rangeLabel(value), value })),
        value: personRange
      })
    ]

    // Top paying outlets inside range
    const topPayingOutlets = computed(() => {
      const amounts = new Map()
      for (const p of validPayments.value) {
        if (!inRange(p.Date, outletRange.value)) continue
        const code = String(p.OutletCode || '').trim()
        if (!code) continue
        sumTo(amounts, code, Number(p.Amount) || 0)
      }

      return topN(amounts, 8, (code) => getOutlet(code)?.name || code).map((it) => ({
        label: it.label,
        value: Number(it.value.toFixed(2))
      }))
    })

    // Collections by person (Username) inside range
    const collectionsByPerson = computed(() => {
      const amounts = new Map()
      for (const p of validPayments.value) {
        if (!inRange(p.Date, personRange.value)) continue
        const user = String(p.Username || '').trim() || '(Unassigned)'
        sumTo(amounts, user, Number(p.Amount) || 0)
      }

      return topN(amounts, 8).map((it) => ({
        label: it.label,
        value: Number(it.value.toFixed(2))
      }))
    })

    // Cancelled payments by ProgressCancelledAt (fallback Date) this month vs last month
    const cancelledPaymentsList = computed(() => activeRows.value.filter(isCancelled))

    const cancelledThisMonthCount = computed(() => {
      return cancelledPaymentsList.value.filter((p) =>
        inRange(p.ProgressCancelledAt || p.Date, '$thisMonth')
      ).length
    })

    const cancelledLastMonthCount = computed(() => {
      return cancelledPaymentsList.value.filter((p) =>
        inRange(p.ProgressCancelledAt || p.Date, '$lastMonth')
      ).length
    })

    return {
      loading,
      countedPaymentsCount,
      collectedToday,
      collectedYesterday,
      collectedThisMonth,
      collectedLastMonth,
      collectionsPerDay,
      topPayingOutlets,
      collectionsByPerson,
      cancelledThisMonthCount,
      cancelledLastMonthCount,
      outletRange,
      personRange,
      controls
    }
  })
}
