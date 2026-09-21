/**
 * Invoiced balances, overdue amounts, debtor rankings, monthly and daily billing metrics.
 *
 * Reads:
 *   OutletConsumptionInvoices: Date, DueDate, OutletCode, Progress, ProgressPaidAt,
 *                              SettlementMismatchAmount, TotalTaxableAmount, Subtotal,
 *                              TotalTaxAmount, ReturnDeductionTotal, PriceListCode, Status
 *   OutletPayments: through useOutletPaymentIndex
 *   Outlets: through useOutletPaymentIndex / useOutletResource
 *
 * Exposes:
 *   loading                 - true while Invoices or Payments is loading and has no rows
 *   totalOutstandingBalance - sum of balance of open invoices
 *   openInvoicesCount       - count of open invoices
 *   totalOverdueAmount      - sum of balance of overdue open invoices
 *   overdueInvoicesCount    - count of overdue open invoices
 *   debtAgeing              - open balance money split into 4 bands: Not due yet, 1-30 days late, 31-60 days late, Over 60 days late
 *   topDebtors              - top 8 outlets by open balance, caption = "N invoices"
 *   invoicedThisMonth       - sum grandTotalOf of non-cancelled invoices dated this month
 *   invoicedLastMonth       - sum grandTotalOf of non-cancelled invoices dated last month
 *   nonCancelledCount       - base count of non-cancelled invoices
 *   topInvoicedOutlets      - top 8 outlets by invoiced money inside chosen range
 *   invoicedPerDay          - invoiced money per day, last 30 days
 *   writtenOffThisMonth     - sum settledOffOf by ProgressPaidAt (fallback Date) this month
 *   writtenOffLastMonth     - sum settledOffOf by ProgressPaidAt (fallback Date) last month
 *   range                   - ref holding chosen range word
 *   controls                - array containing range control
 *
 * Controls:
 *   range: menu picker, $last7Days / $last30Days / $last90Days / $thisMonth / $lastMonth,
 *          changes the window topInvoicedOutlets counts in
 */

import { ref, computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { useDataContext } from 'src/composables/data/useDataContext'
import { dataControl } from 'src/composables/data/useDataControls'
import { useOutletPaymentIndex } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentIndex'
import {
  isActiveRow,
  isCancelled,
  grandTotalOf,
  settledOffOf
} from './_shared'

const DAY = 24 * 60 * 60 * 1000
const dayKey = (t) => new Date(t).toISOString().slice(0, 10)
const RANGES = ['$last7Days', '$last30Days', '$last90Days', '$thisMonth', '$lastMonth']

export default function useInvoiceData () {
  const { rows, isLoading, remember } = useRecord()
  const { daysSince, inRange, rangeLabel } = useDataContext()
  const { openInvoices, invoiceRows, views } = useOutletPaymentIndex()

  return remember('useInvoiceData', () => {
    const loading = computed(() =>
      (isLoading('OutletConsumptionInvoices') && rows('OutletConsumptionInvoices').length === 0) ||
      (isLoading('OutletPayments') && rows('OutletPayments').length === 0)
    )

    const rawInvoices = computed(() => rows('OutletConsumptionInvoices').filter(isActiveRow))
    const nonCancelledInvoices = computed(() => rawInvoices.value.filter((r) => !isCancelled(r)))
    const nonCancelledCount = computed(() => nonCancelledInvoices.value.length)

    // Outstanding balance & open count
    const openList = computed(() => openInvoices.value)
    const openInvoicesCount = computed(() => openList.value.length)
    const totalOutstandingBalance = computed(() =>
      Number(openList.value.reduce((sum, inv) => sum + (inv.balance || 0), 0).toFixed(2))
    )

    // Overdue balance & overdue count
    const overdueList = computed(() => openList.value.filter((inv) => inv.isOverdue))
    const overdueInvoicesCount = computed(() => overdueList.value.length)
    const totalOverdueAmount = computed(() =>
      Number(overdueList.value.reduce((sum, inv) => sum + (inv.balance || 0), 0).toFixed(2))
    )

    // Debt ageing: open balance money in 4 bands from dueInDays
    const debtAgeing = computed(() => {
      let notDue = 0
      let late1to30 = 0
      let late31to60 = 0
      let over60 = 0

      for (const inv of openList.value) {
        const bal = inv.balance || 0
        const dueIn = inv.dueInDays
        if (dueIn === null || dueIn === undefined || dueIn >= 0) {
          notDue += bal
        } else {
          const daysLate = -dueIn
          if (daysLate <= 30) late1to30 += bal
          else if (daysLate <= 60) late31to60 += bal
          else over60 += bal
        }
      }

      return [
        { label: 'Not due yet', value: Number(notDue.toFixed(2)) },
        { label: '1–30 days late', value: Number(late1to30.toFixed(2)) },
        { label: '31–60 days late', value: Number(late31to60.toFixed(2)) },
        { label: 'Over 60 days late', value: Number(over60.toFixed(2)) }
      ]
    })

    // Top debtors: views.Outlets already sorted by totalBalance descending
    const topDebtors = computed(() => {
      const outlets = views.value.Outlets || []
      return outlets.slice(0, 8).map((entry) => ({
        label: entry.name || entry.code,
        value: entry.totalBalance,
        caption: `${entry.invoiceCount} ${entry.invoiceCount === 1 ? 'invoice' : 'invoices'}`
      }))
    })

    // Invoiced this month vs last month
    const invoicedThisMonth = computed(() => {
      let sum = 0
      for (const inv of nonCancelledInvoices.value) {
        if (inRange(inv.Date, '$thisMonth')) {
          sum += grandTotalOf(inv)
        }
      }
      return Number(sum.toFixed(2))
    })

    const invoicedLastMonth = computed(() => {
      let sum = 0
      for (const inv of nonCancelledInvoices.value) {
        if (inRange(inv.Date, '$lastMonth')) {
          sum += grandTotalOf(inv)
        }
      }
      return Number(sum.toFixed(2))
    })

    // Controls
    const range = ref('$last30Days')
    const controls = [
      dataControl('range', {
        type: 'menu',
        options: RANGES.map((value) => ({ label: rangeLabel(value), value })),
        value: range
      })
    ]

    // Top invoiced outlets inside range
    const topInvoicedOutlets = computed(() => {
      const totalsByOutlet = new Map()
      const outletNames = new Map()

      for (const row of invoiceRows.value) {
        if (!inRange(row.date, range.value)) continue
        const code = row.outletCode
        if (!code) continue
        totalsByOutlet.set(code, (totalsByOutlet.get(code) || 0) + (row.total || 0))
        if (!outletNames.has(code)) {
          outletNames.set(code, row.outletName || code)
        }
      }

      return [...totalsByOutlet.entries()]
        .map(([code, total]) => ({
          label: outletNames.get(code) || code,
          value: Number(total.toFixed(2))
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
    })

    // Invoiced per day: last 30 days
    const invoicedPerDay = computed(() => {
      const now = Date.now()
      const days = new Map()
      for (let d = 29; d >= 0; d--) days.set(dayKey(now - d * DAY), 0)

      for (const inv of nonCancelledInvoices.value) {
        const age = daysSince(inv.Date)
        if (age === null || age < 0) continue
        const key = dayKey(now - age * DAY)
        if (days.has(key)) {
          days.set(key, days.get(key) + grandTotalOf(inv))
        }
      }

      return [...days.entries()].map(([x, y]) => ({
        x,
        y: Number(y.toFixed(2))
      }))
    })

    // Written off this month vs last month: settledOffOf by ProgressPaidAt (fallback Date)
    const writtenOffThisMonth = computed(() => {
      let sum = 0
      for (const inv of rawInvoices.value) {
        const d = inv.ProgressPaidAt || inv.Date
        if (inRange(d, '$thisMonth')) {
          sum += settledOffOf(inv)
        }
      }
      return Number(sum.toFixed(2))
    })

    const writtenOffLastMonth = computed(() => {
      let sum = 0
      for (const inv of rawInvoices.value) {
        const d = inv.ProgressPaidAt || inv.Date
        if (inRange(d, '$lastMonth')) {
          sum += settledOffOf(inv)
        }
      }
      return Number(sum.toFixed(2))
    })

    return {
      loading,
      totalOutstandingBalance,
      openInvoicesCount,
      totalOverdueAmount,
      overdueInvoicesCount,
      debtAgeing,
      topDebtors,
      invoicedThisMonth,
      invoicedLastMonth,
      nonCancelledCount,
      topInvoicedOutlets,
      invoicedPerDay,
      writtenOffThisMonth,
      writtenOffLastMonth,
      range,
      controls
    }
  })
}
