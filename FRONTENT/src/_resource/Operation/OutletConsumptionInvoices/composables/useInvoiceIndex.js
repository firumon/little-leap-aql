/**
 * OutletConsumptionInvoices › the Index page's operational projections — Layer 2.
 *
 * "How much is still out there", "which outlets owe the most", "what is old enough to chase"
 * are questions about what the business is owed right now, not about how anything is drawn —
 * so they are domain logic and live here, not in the widgets that display them
 * (UI_RESOURCE_DOMAIN_LOGIC.md §3).
 *
 * ONE AGGREGATE, READ BY EVERY WIDGET (CORE_ARCHITECTURE_RULES §6). Every metric card, every
 * bucket and all five runtime list views are projections of the SAME `invoiceRows` array.
 * That is what makes it impossible for the "12 unpaid" card and the Pending Invoices view
 * beside it to disagree — they are one array, counted twice.
 *
 * ONCE PER APP, NOT ONCE PER CONSUMER (§6). Built through `defineSharedComposable`, so the
 * dozen consuming widgets run the indexing pass once between them.
 *
 * INDEXED JOINS, NEVER LINEAR SCANS (§6). The payments join is the one that matters here:
 * resolving each invoice's balance with a `.filter()` over every payment in the tenant would
 * be O(n×m) and would re-run in full on every reactive invalidation. It is a `Map` built in
 * a single pass instead.
 *
 * ── WHY FIVE VIEWS LIVE HERE AND FOUR DO NOT ──
 * `Overdue`, `Near Due`, `Completed` and `Cancelled` are plain column filters, so they are
 * registered as real GAS `ListViews` and evaluated by the shared token evaluator. The five
 * below cannot be: two group by a DIFFERENT resource, and three key off Balance Due, which
 * is grand total minus active payments and therefore not a column any `column/operator/value`
 * condition can name. They are runtime evaluators for exactly that reason.
 */

import { computed } from 'vue'
import { defineSharedComposable } from 'src/utils/appHelpers'
import { useDataStore } from 'src/stores/data'
import {
  progressOf,
  isOpen,
  PAID,
  CANCELLED
} from './useInvoiceWorkflow'
import {
  grandTotalOf,
  paidTotalOf,
  countsAsPayment,
  isMicroBalance
} from './useInvoiceCalculation'

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

/** Whole days between an ISO date and today. Negative means still in the future. */
function daysSince (iso) {
  const date = new Date(`${text(iso)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date(`${todayISO()}T00:00:00`)
  return Math.round((today - date) / 86400000)
}

/**
 * Split a set of values into three tiers derived from the values THEMSELVES.
 *
 * The bands are runtime, not fixed thresholds, because "a big outstanding balance" has no
 * absolute meaning: it is six figures for one tenant and three for another, and a hardcoded
 * table would put every outlet of a small tenant in the same bucket and tell them nothing.
 * Splitting the observed min→max range into equal thirds means the distribution is always
 * legible whatever the scale.
 *
 * Returns `[]` for fewer than two distinct values — one outlet owing money is not a
 * distribution, and drawing three bands with everything piled in one is noise.
 */
export function distributionTiers (values = [], labels = ['Low', 'Medium', 'High']) {
  const numbers = (Array.isArray(values) ? values : []).map(num).filter((value) => value > 0)
  if (numbers.length < 2) return []

  const min = Math.min(...numbers)
  const max = Math.max(...numbers)
  if (max <= min) return []

  const step = (max - min) / 3
  return labels.map((label, index) => {
    const from = min + (step * index)
    // The top band is inclusive of `max`, so the single largest value has a bucket to land
    // in — a half-open top band would silently drop it.
    const to = index === 2 ? max : min + (step * (index + 1))
    return { label, from, to, count: 0, total: 0 }
  })
}

/** Drop a value into its tier. The last band absorbs the maximum (see above). */
function assignTier (tiers, value) {
  if (!tiers.length) return null
  const index = tiers.findIndex((tier, position) =>
    value >= tier.from && (position === tiers.length - 1 ? value <= tier.to : value < tier.to))
  return index >= 0 ? tiers[index] : tiers[tiers.length - 1]
}

const shared = defineSharedComposable((dataStore) => {
  const rows = (name) => (dataStore.getRecords(name) || []).map(asRow).filter(isActiveRow)

  const invoices = computed(() => rows('OutletConsumptionInvoices'))
  const payments = computed(() => rows('OutletPayments'))
  const consumptions = computed(() => rows('OutletConsumptions'))
  const consumptionItems = computed(() => rows('OutletConsumptionItems'))
  const outlets = computed(() => rows('Outlets'))
  const operatingRules = computed(() => rows('OutletOperatingRules'))

  /**
   * Returns owed a credit that no invoice has taken yet.
   *
   * The invoice generator deducts these automatically, so the test is exactly the pair of
   * flags that means "this return entitles the outlet to money it has not received":
   * adjustment REQUIRED and not yet DONE. A return raised for a purely physical reason
   * (stock going back to a warehouse with no credit) never carries the first flag and is
   * correctly ignored here.
   */
  const returnsAwaitingAdjustment = computed(() => rows('OutletReturns').filter((row) =>
    text(row.InvoiceAdjustmentRequired).toUpperCase() === 'TRUE' &&
    text(row.InvoiceAdjustmentDone).toUpperCase() !== 'TRUE' &&
    text(row.Progress).toUpperCase() !== 'CANCELLED'))

  /** Outlet code → display name. One pass, then O(1) per row. */
  const outletNameByCode = computed(() =>
    new Map(outlets.value.map((outlet) => [text(outlet.Code), text(outlet.Name) || text(outlet.Code)])))

  /**
   * Invoice code → its own payment rows.
   *
   * THE indexed join this whole module rests on. Built once per pass; every balance below
   * is then an O(1) lookup instead of a scan (§6).
   */
  const paymentsByInvoice = computed(() => {
    const map = new Map()
    payments.value.forEach((payment) => {
      if (!countsAsPayment(payment)) return
      const code = text(payment.OutletConsumptionInvoiceCode)
      if (!code) return
      const bucket = map.get(code)
      if (bucket) bucket.push(payment)
      else map.set(code, [payment])
    })
    return map
  })

  /**
   * THE aggregate — every invoice with its money and its age already resolved.
   *
   * Derived once so no consumer recomputes a balance per render, and so the metric cards and
   * the list views are counting literally the same objects.
   */
  const invoiceRows = computed(() => {
    const names = outletNameByCode.value
    const paid = paymentsByInvoice.value

    return invoices.value.map((invoice) => {
      const code = text(invoice.Code)
      const own = paid.get(code) || []
      const total = grandTotalOf(invoice)
      const collected = paidTotalOf(own)
      const balance = Math.max(0, total - collected)
      const outletCode = text(invoice.OutletCode)
      const dueIn = text(invoice.DueDate) ? -daysSince(invoice.DueDate) : null

      return {
        invoice,
        code,
        outletCode,
        outletName: names.get(outletCode) || outletCode,
        date: text(invoice.Date),
        dueDate: text(invoice.DueDate),
        progress: progressOf(invoice),
        username: text(invoice.Username),
        total,
        collected,
        balance,
        payments: own,
        ageDays: daysSince(invoice.Date),
        // Negative once the due date has passed. `null` when no due date was set, which is
        // NOT the same as "due today" and must not be banded as overdue.
        dueInDays: dueIn,
        isOverdue: dueIn !== null && dueIn < 0 && isOpen(invoice),
        isSettleable: isOpen(invoice) && balance > 0,
        isMicro: isOpen(invoice) && balance > 0 && isMicroBalance(balance, invoice.PriceListCode)
      }
    })
  })

  /** Open invoices still carrying a real balance — the collections book. */
  const openInvoices = computed(() => invoiceRows.value.filter((row) => isOpen(row.invoice)))

  // ── Metric cards ────────────────────────────────────────────────────────────

  /**
   * The collections position, split into the whole open book and the OVERDUE part of it.
   *
   * `overdueOutletCount` counts OUTLETS, not invoices — three overdue invoices from one
   * outlet is one conversation, and three from three outlets is three. That distinction is
   * what a collector plans a day around, and neither the invoice count nor the amount
   * expresses it.
   */
  const collections = computed(() => {
    const open = openInvoices.value
    const overdue = open.filter((row) => row.isOverdue)
    const overdueOutlets = new Set(overdue.map((row) => row.outletCode).filter(Boolean))
    return {
      count: open.length,
      amount: open.reduce((sum, row) => sum + row.balance, 0),
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((sum, row) => sum + row.balance, 0),
      overdueOutletCount: overdueOutlets.size
    }
  })

  /**
   * Open invoices split by whether their due date has passed.
   *
   * Both halves are derived HERE rather than in the two list views that show them, so the
   * "Overdue" pill's count and the overdue group inside the "Near Due" view are the same
   * set counted twice, never two filters that can drift apart.
   *
   * `dueInDays` is negative once the date has passed; `null` means no due date was set,
   * which is NOT overdue and is grouped with the upcoming side.
   */
  const dueSplit = computed(() => {
    const open = openInvoices.value
    const overdue = open.filter((row) => row.isOverdue)
      // Longest overdue first — the oldest debt is the most likely to go bad.
      .sort((a, b) => (a.dueInDays ?? 0) - (b.dueInDays ?? 0))
    const upcoming = open.filter((row) => !row.isOverdue)
      // Soonest due first, and undated rows last: an invoice with no due date cannot be
      // ranked against one that has one, so it does not get to jump the queue.
      .sort((a, b) => (a.dueInDays ?? Number.MAX_SAFE_INTEGER) - (b.dueInDays ?? Number.MAX_SAFE_INTEGER))
    return { overdue, upcoming }
  })

  /**
   * Today's collections, and how much of the day's overdue book they cleared.
   *
   * ── THE START-OF-DAY RECONSTRUCTION ──
   * Nothing stores what the overdue balance was this morning, so it is DERIVED:
   *
   *     overdue at start of day  =  overdue still outstanding  +  collected today from overdue
   *
   * That identity holds because the only two things that happen to an overdue balance during
   * a day are that it stays outstanding or it gets paid. It is why `fromOverdue` cannot be
   * read off `openInvoices`: an invoice settled in full this morning is no longer open and no
   * longer overdue, yet its payment is precisely what the rank is measuring. So the test here
   * is the DUE DATE alone — was this invoice already past due when the day began — rather
   * than the `isOverdue` flag, which also requires the invoice to still be open.
   *
   * `rank` is the share of the morning's overdue book cleared today, as a percentage. With
   * nothing overdue at the start of the day there is no share to take, and it reports 0
   * rather than 100 — a clean book is not a collection achievement.
   */
  const todayCollection = computed(() => {
    const today = todayISO()
    const dueBefore = new Map()

    invoiceRows.value.forEach((row) => {
      if (row.progress === CANCELLED) return
      // Past due as of this morning. An invoice falling due TODAY was not overdue when the
      // day began, so it is excluded from the denominator and from `fromOverdue`.
      if (row.dueDate && row.dueDate < today) dueBefore.set(row.code, true)
    })

    let total = 0
    let fromOverdue = 0

    payments.value.forEach((payment) => {
      if (!countsAsPayment(payment) || text(payment.Date) !== today) return
      const amount = num(payment.Amount)
      total += amount
      if (dueBefore.has(text(payment.OutletConsumptionInvoiceCode))) fromOverdue += amount
    })

    const outstanding = collections.value.overdueAmount
    const atStartOfDay = outstanding + fromOverdue

    return {
      total,
      fromOverdue,
      outstanding,
      atStartOfDay,
      rank: atStartOfDay > 0 ? (fromOverdue / atStartOfDay) * 100 : 0
    }
  })

  /** Today's invoicing activity — how many were raised and what they came to. */
  const todayInvoicing = computed(() => {
    const today = todayISO()
    const raised = invoiceRows.value.filter((row) => row.date === today && row.progress !== CANCELLED)
    return { count: raised.length, amount: raised.reduce((sum, row) => sum + row.total, 0) }
  })

  /** The set of consumption codes any LIVE invoice already covers. */
  const invoicedConsumptionCodes = computed(() => {
    const covered = new Set()
    invoiceRows.value.forEach((row) => {
      if (row.progress === CANCELLED) return
      text(row.invoice.OutletConsumptionCode).split(',').map(text).filter(Boolean)
        .forEach((code) => covered.add(code))
    })
    return covered
  })

  /**
   * Consumption code → its own item rows.
   *
   * BUILT BY JOIN, not read from `row.$OutletConsumptionItems`. The store nests children onto
   * a record only when that record is hydrated individually (a View page); records read from
   * a LIST carry no `$`-prefixed child arrays at all, so a consumer relying on them silently
   * sees every consumption as empty — which is exactly what made the wizard offer "0 items"
   * against consumptions that had plenty.
   *
   * One pass into a `Map`, so the per-consumption lookup below is O(1) rather than a scan of
   * every item row per consumption (CORE_ARCHITECTURE_RULES §6).
   */
  const consumptionItemsByCode = computed(() => {
    const map = new Map()
    consumptionItems.value.forEach((item) => {
      const code = text(item.OutletConsumptionCode)
      if (!code) return
      const bucket = map.get(code)
      if (bucket) bucket.push(item)
      else map.set(code, [item])
    })
    return map
  })

  /** The item rows of one consumption, or an empty list. */
  const itemsOfConsumption = (code) => consumptionItemsByCode.value.get(text(code)) || []

  /**
   * Consumptions still owed an invoice, and with something billable to put on one.
   *
   * Judged from the INVOICES side — a bundled invoice names several consumption codes in one
   * column, so one pass over the invoices answers every consumption's question at once and a
   * consumption bundled onto a sibling's invoice is correctly reported as invoiced.
   *
   * The billable-lines test excludes ORPHAN HEADERS: a consumption row carrying no item rows
   * can never be invoiced, and without this guard it sits in the To Invoice queue forever
   * offering a bill with nothing on it. The same guard exists in `useConsumptionIndex` for
   * the same reason.
   */
  const hasBillableLines = (row) => itemsOfConsumption(row.Code)
    .some((item) => isActiveRow(item) && num(item.Qty) > 0)

  const pendingInvoiceGeneration = computed(() => {
    const covered = invoicedConsumptionCodes.value
    return consumptions.value.filter((row) =>
      text(row.Progress).toUpperCase() === 'PENDING_INVOICE_GENERATION' &&
      !covered.has(text(row.Code)) &&
      hasBillableLines(row))
  })

  /**
   * Per-outlet outstanding position — one entry per outlet that owes anything.
   *
   * The `Outlet Pendings` view and the pending-amount buckets are both projections of this,
   * so the "outlets owing" count and the bucket totals cannot drift apart.
   */
  const outletPendings = computed(() => {
    const names = outletNameByCode.value
    const byOutlet = new Map()

    openInvoices.value.forEach((row) => {
      if (!row.outletCode) return
      const entry = byOutlet.get(row.outletCode) || {
        outletCode: row.outletCode,
        outletName: names.get(row.outletCode) || row.outletCode,
        invoiceCount: 0,
        balance: 0,
        oldestDate: '',
        overdueCount: 0
      }
      entry.invoiceCount += 1
      entry.balance += row.balance
      entry.overdueCount += row.isOverdue ? 1 : 0
      if (!entry.oldestDate || (row.date && row.date < entry.oldestDate)) entry.oldestDate = row.date
      byOutlet.set(row.outletCode, entry)
    })

    return [...byOutlet.values()]
      .filter((entry) => entry.balance > 0)
      .sort((a, b) => b.balance - a.balance || a.outletName.localeCompare(b.outletName))
  })

  /** Outlets carrying at least one consumption that still owes an invoice. */
  const invoiceableOutlets = computed(() => {
    const names = outletNameByCode.value
    const byOutlet = new Map()
    pendingInvoiceGeneration.value.forEach((row) => {
      const code = text(row.OutletCode)
      if (!code) return
      const entry = byOutlet.get(code) || {
        outletCode: code,
        outletName: names.get(code) || code,
        consumptionCount: 0,
        consumptionCodes: [],
        oldestDate: ''
      }
      entry.consumptionCount += 1
      entry.consumptionCodes.push(text(row.Code))
      const date = text(row.Date)
      if (date && (!entry.oldestDate || date < entry.oldestDate)) entry.oldestDate = date
      byOutlet.set(code, entry)
    })
    return [...byOutlet.values()]
      .sort((a, b) => b.consumptionCount - a.consumptionCount || a.outletName.localeCompare(b.outletName))
  })

  // ── Dynamic buckets ─────────────────────────────────────────────────────────

  /**
   * Outstanding invoices bucketed by AGE, into three runtime tiers.
   *
   * Bands come from the observed spread of ages rather than a fixed 30/60/90 table, for the
   * same reason the amount bands do: a tenant invoicing weekly and one invoicing quarterly
   * do not share a meaningful "old".
   */
  const ageingBuckets = computed(() => {
    const open = openInvoices.value.filter((row) => row.ageDays !== null)
    const tiers = distributionTiers(open.map((row) => row.ageDays), ['Recent', 'Ageing', 'Oldest'])
    if (!tiers.length) return []
    open.forEach((row) => {
      const tier = assignTier(tiers, row.ageDays)
      if (!tier) return
      tier.count += 1
      tier.total += row.balance
    })
    return tiers.map((tier) => ({
      ...tier,
      caption: `${Math.round(tier.from)}–${Math.round(tier.to)} days`
    }))
  })

  /** Outlets bucketed by how much they owe, into three runtime tiers. */
  const pendingAmountBuckets = computed(() => {
    const entries = outletPendings.value
    const tiers = distributionTiers(entries.map((entry) => entry.balance), ['Small', 'Moderate', 'Large'])
    if (!tiers.length) return []
    entries.forEach((entry) => {
      const tier = assignTier(tiers, entry.balance)
      if (!tier) return
      tier.count += 1
      tier.total += entry.balance
    })
    return tiers
  })

  // ── The five runtime list views ─────────────────────────────────────────────

  /**
   * Every runtime view, as `{ rows, sort }` already applied.
   *
   * Ordering is a WORK ORDER, not a preference (UI_MODULE_DEVELOPER_GUIDE §7.2): the oldest
   * debt is the one most likely to go bad, so the collection views lead with it, while the
   * high-value view leads with the largest exposure instead.
   */
  const runtimeViews = computed(() => {
    const open = openInvoices.value

    const byOldest = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)

    return {
      OutletPendings: outletPendings.value,
      InvoiceableOutlets: invoiceableOutlets.value,
      // A real balance — anything at or below the currency's rounding interval is unpayable
      // and belongs in the waive-off queue instead, never in both.
      PendingInvoices: open.filter((row) => row.balance > 0 && !row.isMicro).sort(byOldest),
      HighValueInvoices: open.filter((row) => row.balance > 0 && !row.isMicro).sort((a, b) => b.balance - a.balance),
      WaiveOffInvoices: open.filter((row) => row.isMicro).sort(byOldest)
    }
  })

  /** The four column-filter views, projected off the same aggregate for card reuse. */
  const storedViews = computed(() => {
    const all = invoiceRows.value
    return {
      NearDue: all.filter((row) => isOpen(row.invoice) && row.dueInDays !== null && row.dueInDays >= 0 && row.dueInDays <= 7)
        .sort((a, b) => a.dueInDays - b.dueInDays),
      Overdue: all.filter((row) => row.isOverdue).sort((a, b) => a.dueInDays - b.dueInDays),
      Completed: all.filter((row) => row.progress === PAID).sort((a, b) => (a.date < b.date ? 1 : -1)),
      Cancelled: all.filter((row) => row.progress === CANCELLED).sort((a, b) => (a.date < b.date ? 1 : -1))
    }
  })

  /** One lookup for whichever view the switcher is on, stored or runtime. */
  const rowsForView = (name) => {
    const key = text(name)
    const runtime = runtimeViews.value
    if (Object.prototype.hasOwnProperty.call(runtime, key)) return runtime[key]
    const stored = storedViews.value
    return Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : invoiceRows.value
  }

  /** Invoice code → its aggregate row, for O(1) reads from a View page or a payments card. */
  const rowByCode = computed(() => new Map(invoiceRows.value.map((row) => [row.code, row])))

  return {
    invoices,
    payments,
    consumptions,
    outlets,
    operatingRules,
    returnsAwaitingAdjustment,
    outletNameByCode,
    paymentsByInvoice,
    invoiceRows,
    rowByCode,
    openInvoices,
    collections,
    todayCollection,
    dueSplit,
    todayInvoicing,
    invoicedConsumptionCodes,
    consumptionItems,
    consumptionItemsByCode,
    itemsOfConsumption,
    pendingInvoiceGeneration,
    outletPendings,
    invoiceableOutlets,
    ageingBuckets,
    pendingAmountBuckets,
    runtimeViews,
    storedViews,
    rowsForView
  }
})

/**
 * The data store is passed IN rather than imported at module scope, matching every sibling
 * index composable: `defineSharedComposable` keys its cached scope on the identity it is
 * handed, so a tenant switch rebuilds the projection instead of serving the previous
 * tenant's index.
 */
export function useInvoiceIndex () {
  return shared(useDataStore())
}
