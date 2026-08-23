/**
 * OutletPayments › Index operational projections & metrics — Layer 2.
 *
 * Single aggregate projection for payment collections, overdue monitoring,
 * linear progress pipeline, and multi-queue list switcher views.
 *
 * Built through `defineSharedComposable` for memoized single-pass execution.
 */

import { computed } from 'vue'
import { defineSharedComposable } from 'src/utils/appHelpers'
import { useDataStore } from 'src/stores/data'
import {
  netInvoiceTotalOf,
  paidTotalOf,
  countsAsPayment
} from './useOutletPaymentAllocation'
import { storedTaxBreakdown } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import {
  SUBMITTED,
  CANCELLED,
  progressOf,
  isSubmitted
} from './useOutletPaymentProgress'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const todayISO = () => new Date().toISOString().slice(0, 10)

const isActiveRow = (row) => {
  const status = text(asRow(row).Status)
  return !status || status.toUpperCase() === 'ACTIVE'
}

function daysSince (iso) {
  const date = new Date(`${text(iso)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date(`${todayISO()}T00:00:00`)
  return Math.round((today - date) / 86400000)
}

const shared = defineSharedComposable((dataStore) => {
  const rows = (name) => (dataStore.getRecords(name) || []).map(asRow).filter(isActiveRow)

  const rawInvoices = computed(() => rows('OutletConsumptionInvoices'))
  const rawPayments = computed(() => rows('OutletPayments'))
  const rawOutlets  = computed(() => rows('Outlets'))

  // Outlet Code -> Display Name Map
  const outletNameByCode = computed(() =>
    new Map(rawOutlets.value.map(o => [text(o.Code), text(o.Name) || text(o.Code)]))
  )

  // Invoice Code -> Array of active Payments Map
  const paymentsByInvoice = computed(() => {
    const map = new Map()
    rawPayments.value.forEach(payment => {
      if (!countsAsPayment(payment)) return
      const invCode = text(payment.OutletConsumptionInvoiceCode)
      if (!invCode) return
      const bucket = map.get(invCode)
      if (bucket) bucket.push(payment)
      else map.set(invCode, [payment])
    })
    return map
  })

  // Outlet Code -> Array of active Invoices Map
  const invoicesByOutlet = computed(() => {
    const map = new Map()
    rawInvoices.value.forEach(inv => {
      const outCode = text(inv.OutletCode)
      if (!outCode) return
      const bucket = map.get(outCode)
      if (bucket) bucket.push(inv)
      else map.set(outCode, [inv])
    })
    return map
  })

  // Outlet Code -> Array of Payments Map
  const paymentsByOutlet = computed(() => {
    const map = new Map()
    rawPayments.value.forEach(p => {
      const outCode = text(p.OutletCode)
      if (!outCode) return
      const bucket = map.get(outCode)
      if (bucket) bucket.push(p)
      else map.set(outCode, [p])
    })
    return map
  })

  // ── Unified Invoices Projection ─────────────────────────────────────────────
  const invoiceRows = computed(() => {
    const names = outletNameByCode.value
    const paidMap = paymentsByInvoice.value

    return rawInvoices.value
      .filter(inv => text(inv.Progress).toUpperCase() !== 'CANCELLED')
      .map(inv => {
        const code = text(inv.Code)
        const ownPayments = paidMap.get(code) || []
        const total = netInvoiceTotalOf(inv)
        const collected = paidTotalOf(ownPayments)
        const balance = Math.max(0, Number((total - collected).toFixed(2)))
        const outletCode = text(inv.OutletCode)
        const taxable = num(inv.TotalTaxableAmount) || num(inv.Subtotal)
        const dueIn = text(inv.DueDate) ? -daysSince(inv.DueDate) : null
        const invProgress = text(inv.Progress).toUpperCase()
        const isInvoiceOpen = (invProgress === 'PENDING_PAYMENT' || invProgress === 'PARTIALLY_PAID') && balance > 0.01

        return {
          ...inv,
          code,
          outletCode,
          outletName: names.get(outletCode) || outletCode,
          date: text(inv.Date),
          dueDate: text(inv.DueDate),
          progress: invProgress,
          username: text(inv.Username),
          priceListCode: text(inv.PriceListCode),
          subtotal: num(inv.Subtotal),
          discount: num(inv.Discount),
          totalTaxableAmount: taxable,
          totalTaxAmount: num(inv.TotalTaxAmount),
          taxDetails: storedTaxBreakdown(inv),
          returnDeductionTotal: num(inv.ReturnDeductionTotal),
          total,
          collected,
          balance,
          payments: ownPayments,
          ageDays: daysSince(inv.Date),
          dueInDays: dueIn,
          isOverdue: dueIn !== null && dueIn < 0 && isInvoiceOpen,
          isNearDue: dueIn !== null && dueIn >= 0 && dueIn <= 7 && isInvoiceOpen,
          isOpen: isInvoiceOpen
        }
      })
  })

  // ── Unified Payments Projection ─────────────────────────────────────────────
  const paymentRows = computed(() => {
    const names = outletNameByCode.value

    return rawPayments.value.map(p => {
      const code = text(p.Code)
      const outletCode = text(p.OutletCode)
      const invoiceCode = text(p.OutletConsumptionInvoiceCode)
      const pProgress = progressOf(p)

      return {
        ...p,
        code,
        outletCode,
        outletName: names.get(outletCode) || outletCode,
        invoiceCode,
        date: text(p.Date),
        amount: num(p.Amount),
        mode: text(p.Mode) || 'Cash',
        reference: text(p.Reference),
        username: text(p.Username),
        progress: pProgress,
        isSubmitted: isSubmitted(p),
        isCancelled: pProgress === CANCELLED,
        ageDays: daysSince(p.Date)
      }
    })
  })

  // Invoice Code -> raw / enriched row, so a lookup never scans the whole ledger
  const invoiceByCode = computed(() =>
    new Map(rawInvoices.value.map(inv => [text(inv.Code), inv])))

  const invoiceRowByCode = computed(() =>
    new Map(invoiceRows.value.map(row => [row.code, row])))

  // Open active invoices
  const openInvoices = computed(() => invoiceRows.value.filter(inv => inv.isOpen))

  // ── Metrics ─────────────────────────────────────────────────────────────────

  // Metric 1: Overdue Invoices
  const overdueMetrics = computed(() => {
    const overdue = openInvoices.value.filter(inv => inv.isOverdue)
    return {
      count: overdue.length,
      amount: Number(overdue.reduce((sum, inv) => sum + inv.balance, 0).toFixed(2))
    }
  })

  // Metric 2: Today's Collections
  const todayCollectionsMetrics = computed(() => {
    const today = todayISO()
    const todayPayments = paymentRows.value.filter(p => p.date === today && !p.isCancelled)
    return {
      count: todayPayments.length,
      amount: Number(todayPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2))
    }
  })

  // Linear Collection Progress Bar
  // Denominator: Overdue invoice amount + Today's collections from overdue invoices
  // Numerator: Today's collections from overdue invoices
  const linearProgressData = computed(() => {
    const today = todayISO()
    const todayPayments = paymentRows.value.filter(p => p.date === today && !p.isCancelled)

    // Match payments to invoices that are overdue
    const overdueInvoiceCodes = new Set(invoiceRows.value.filter(inv => inv.isOverdue).map(inv => inv.code))
    const todayCollectionsFromOverdue = todayPayments
      .filter(p => overdueInvoiceCodes.has(p.invoiceCode))
      .reduce((sum, p) => sum + p.amount, 0)

    const overdueAmount = overdueMetrics.value.amount
    const denominator = Number((overdueAmount + todayCollectionsFromOverdue).toFixed(2))
    const numerator = Number(todayCollectionsFromOverdue.toFixed(2))
    const ratio = denominator > 0 ? Math.min(1, Math.max(0, numerator / denominator)) : 0

    return {
      ratio,
      percentage: Number((ratio * 100).toFixed(1)),
      numerator,
      denominator,
      overdueAmount
    }
  })

  // ── Switcher Views ──────────────────────────────────────────────────────────

  const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '')
  const byDueAsc = (a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')

  const views = computed(() => {
    const open = openInvoices.value
    const allPayments = paymentRows.value

    return {
      NearDue: open.filter(inv => inv.isNearDue).sort(byDueAsc),
      Overdue: open.filter(inv => inv.isOverdue).sort(byDueAsc),
      PendingInvoices: [...open].sort((a, b) => (a.date || '').localeCompare(b.date || '')),
      HighValueInvoices: [...open].sort((a, b) => b.balance - a.balance),
      Collections: allPayments.filter(p => p.isSubmitted).sort(byDateDesc),
      Cancelled: allPayments.filter(p => p.isCancelled).sort(byDateDesc)
    }
  })

  /**
   * The collections queue split into the two groups a collector works in a different order:
   * what is ALREADY LATE, and what is COMING UP.
   *
   * Both halves are projections of the SAME `views` object the Overdue pill counts, so the
   * "Near Due" view and the "Overdue" view can never disagree about which invoice is late
   * (CORE_ARCHITECTURE_RULES §6 — Enrich Once, Then Project).
   */
  const dueSplit = computed(() => ({
    overdue: views.value.Overdue,
    upcoming: views.value.NearDue
  }))

  return {
    rawInvoices,
    rawPayments,
    rawOutlets,
    outletNameByCode,
    paymentsByInvoice,
    invoicesByOutlet,
    paymentsByOutlet,
    invoiceRows,
    invoiceByCode,
    invoiceRowByCode,
    paymentRows,
    openInvoices,
    overdueMetrics,
    todayCollectionsMetrics,
    linearProgressData,
    views,
    dueSplit
  }
})

export function useOutletPaymentIndex () {
  return shared(useDataStore())
}
