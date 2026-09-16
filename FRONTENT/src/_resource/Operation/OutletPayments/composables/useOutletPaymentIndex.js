import { computed } from 'vue'
import { useRecord } from 'src/composables/resources/useRecord'
import { parseAnyDate } from 'src/utils/dateHelpers'
import {
  netInvoiceTotalOf,
  paidTotalOf,
  balanceDueOf,
  countsAsPayment
} from './useOutletPaymentAllocation'
import { storedTaxBreakdown } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import { CANCELLED, progressOf, isSubmitted } from './useOutletPaymentProgress'
const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const todayISO = () => new Date().toISOString().slice(0, 10)

/** One lowercase haystack per row, built here so a keystroke costs one `includes`. */
const haystack = (...parts) => parts.map(text).filter(Boolean).join(' ').toLowerCase()

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

const build = (recordSource) => {
  const rows = (name) => (recordSource.rows(name) || []).map(asRow).filter(isActiveRow)

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
        const balance = Number(balanceDueOf(inv, ownPayments).toFixed(2))
        const outletCode = text(inv.OutletCode)
        const taxable = num(inv.TotalTaxableAmount) || num(inv.Subtotal)
        const dueIn = text(inv.DueDate) ? -daysSince(inv.DueDate) : null
        const invProgress = text(inv.Progress).toUpperCase()
        const isInvoiceOpen = (invProgress === 'PENDING_PAYMENT' || invProgress === 'PARTIALLY_PAID') && balance > 0

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
          isOpen: isInvoiceOpen,
          search: haystack(
            code,
            outletCode,
            names.get(outletCode) || outletCode,
            text(inv.Date),
            text(inv.DueDate),
            text(inv.Username),
            invProgress
          )
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
        ageDays: daysSince(p.Date),
        search: haystack(
          code,
          outletCode,
          names.get(outletCode) || outletCode,
          invoiceCode,
          text(p.Date),
          text(p.Mode) || 'Cash',
          text(p.Reference),
          text(p.Username),
          pProgress
        )
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

  // Progress bar: how much of today's overdue book was collected today.
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

  const recencyOf = (row) => {
    const stamp = parseAnyDate(row?.UpdatedAt) || parseAnyDate(row?.date)
    return stamp ? stamp.getTime() : 0
  }

  // One entry per outlet that still owes money, with its open invoices carried along.
  const outletDebts = (open) => {
    const map = new Map()
    open.forEach(inv => {
      const code = inv.outletCode
      if (!code) return
      let entry = map.get(code)
      if (!entry) {
        entry = {
          code,
          name: inv.outletName || code,
          totalBalance: 0,
          invoiceCount: 0,
          invoices: [],
          search: haystack(code, inv.outletName || code)
        }
        map.set(code, entry)
      }
      entry.totalBalance += inv.balance
      entry.invoiceCount += 1
      entry.invoices.push(inv)
    })
    return [...map.values()]
      .map(entry => ({ ...entry, totalBalance: Number(entry.totalBalance.toFixed(2)) }))
      .sort((a, b) => b.totalBalance - a.totalBalance)
  }

  const RECENT_LIMIT = 50

  const views = computed(() => {
    const open = openInvoices.value
    const allPayments = paymentRows.value

    return {
      Recent: [...allPayments].sort((a, b) => recencyOf(b) - recencyOf(a)).slice(0, RECENT_LIMIT),
      OverdueInvoices: open.filter(inv => inv.isOverdue).sort(byDueAsc),
      Outlets: outletDebts(open),
      CompletedPayments: allPayments.filter(p => p.isSubmitted).sort(byDateDesc),
      CancelledPayments: allPayments.filter(p => p.isCancelled).sort(byDateDesc)
    }
  })

  return {
    rawInvoices,
    rawPayments,
    rawOutlets,
    outletNameByCode,
    paymentsByInvoice,
    invoiceRows,
    invoiceByCode,
    invoiceRowByCode,
    paymentRows,
    openInvoices,
    overdueMetrics,
    todayCollectionsMetrics,
    linearProgressData,
    views
  }
}

export function useOutletPaymentIndex () {
  const recordSource = useRecord()
  return recordSource.remember('useOutletPaymentIndex', () => build(recordSource))
}
