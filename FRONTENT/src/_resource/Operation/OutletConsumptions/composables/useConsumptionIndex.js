/**
 * OutletConsumptions › the Index page's operational projections — Layer 2.
 *
 * "Which outlets are overdue for an audit", "how much of today's plan is done", "which
 * outlets are carrying uninvoiced consumptions" are questions about what the business owes
 * right now, not about how anything is drawn — so they are domain logic, and they live
 * here rather than in four separate widget modifiers
 * (UI_RESOURCE_DOMAIN_LOGIC.md §3).
 *
 * ONE AGGREGATE, READ BY EVERY WIDGET. The four metric cards, the fulfilment gauge, the
 * ageing bands and the two projection list views all read projections of the SAME indexed
 * tree. That is what makes it impossible for the "3 overdue outlets" card and the ageing
 * widget beside it to disagree — they are the same array, counted twice
 * (CORE_ARCHITECTURE_RULES §6, UI_MODULE_DEVELOPER_GUIDE §7.4).
 *
 * ONCE PER APP, NOT ONCE PER CONSUMER (CORE_ARCHITECTURE_RULES §6). Built through
 * `defineSharedComposable`, the same shape every `_resource/Master/*` composable uses, so
 * six consuming widgets run the indexing pass once between them rather than six times over
 * the same rows.
 *
 * INDEXED JOINS, NEVER LINEAR SCANS (§6). Every cross-resource lookup below resolves
 * through a `Map` built in a single pass. A `.find()` inside the per-outlet loop would
 * make the whole projection O(n×m) and re-run in full on every reactive invalidation.
 */

import { computed } from 'vue'
import { defineSharedComposable } from 'src/utils/appHelpers'
import { useDataStore } from 'src/stores/data'
import {
  progressOf,
  isActiveRow,
  countsForUser,
  consumptionCodesOf,
  daysSince,
  overdueBands,
  overdueBandOf,
  defaultVisitFrequencyDays,
  PENDING_INVOICE_GENERATION,
  CANCELLED
} from './useConsumptionProgress'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const todayISO = () => new Date().toISOString().slice(0, 10)

const shared = defineSharedComposable((dataStore) => {
  const rows = (name) => (dataStore.getRecords(name) || []).map(asRow).filter(isActiveRow)

  const consumptions = computed(() => rows('OutletConsumptions'))
  const consumptionItems = computed(() => rows('OutletConsumptionItems'))
  const visits = computed(() => rows('OutletVisits'))
  const invoices = computed(() => rows('OutletConsumptionInvoices'))
  const outlets = computed(() => rows('Outlets'))
  const operatingRules = computed(() => rows('OutletOperatingRules'))

  /** Outlet code → display name. One pass, then O(1) per row. */
  const outletNameByCode = computed(() =>
    new Map(outlets.value.map((outlet) => [text(outlet.Code), text(outlet.Name) || text(outlet.Code)])))

  /**
   * Outlet code → its configured audit cadence.
   *
   * Falls back to the backend's configured default rather than to a literal, so an outlet
   * with no operating rule is still judged against a number somebody chose. A cadence of
   * `0` means "not configured anywhere" and every consumer below declines to band that
   * outlet rather than inventing a frequency for it.
   */
  const frequencyByOutlet = computed(() => {
    const fallback = defaultVisitFrequencyDays()
    const map = new Map()
    operatingRules.value.forEach((rule) => {
      const code = text(rule.OutletCode)
      const frequency = num(rule.VisitFrequencyDays)
      if (code && frequency > 0) map.set(code, frequency)
    })
    return { map, fallback, of: (code) => map.get(text(code)) || fallback }
  })

  /**
   * The set of consumption codes ANY live invoice covers.
   *
   * Built from the invoices side rather than by asking each consumption whether it has
   * one, because a bundled invoice names several codes in one comma-separated column — so
   * one pass over the invoices resolves every consumption's answer at once, and a
   * consumption bundled onto a sibling's invoice is correctly reported as invoiced.
   */
  const invoicedConsumptionCodes = computed(() => {
    const covered = new Set()
    invoices.value.forEach((invoice) => {
      if (progressOf(invoice) === CANCELLED) return
      consumptionCodesOf(invoice).forEach((code) => covered.add(code))
    })
    return covered
  })

  /**
   * Consumption code → the total quantity its item rows carry.
   *
   * BUILT BY JOIN, never from `row.$OutletConsumptionItems` — the store nests children onto
   * a record only when that record is hydrated individually (a View page), so records read
   * from a LIST carry no `$`-prefixed child arrays at all and a consumer reading them sees
   * every consumption as empty. Same trap, same fix as `useInvoiceIndex`'s
   * `consumptionItemsByCode`; see `uninvoicedConsumptions` below for what it cost here.
   *
   * ANSWERS `undefined`, NOT `0`, FOR A CONSUMPTION WITH NO ITEM ROWS LOADED. The child
   * resource is fetched on demand, so "no rows for this code" means either an empty
   * consumption or an unloaded one, and those must not render the same. A caller showing
   * this figure has to decide what to print when it is missing rather than being handed a
   * confident zero — which is exactly the lie the wizard was telling.
   *
   * One pass into a `Map`, so each lookup is O(1) rather than a scan per consumption
   * (CORE_ARCHITECTURE_RULES §6).
   */
  const soldQtyByConsumption = computed(() => {
    const map = new Map()
    consumptionItems.value.forEach((item) => {
      const code = text(item.OutletConsumptionCode)
      if (!code) return
      map.set(code, (map.get(code) || 0) + num(item.Qty))
    })
    return map
  })

  /** Total counted quantity of one consumption, or `undefined` if its lines are not loaded. */
  const soldQtyOfConsumption = (code) => soldQtyByConsumption.value.get(text(code))

  /**
   * Consumptions still owed an invoice — the state column and the absence of a real
   * invoice. Two conditions, both answerable from the PARENT row alone.
   *
   * NO LINE-ITEM CONDITION HERE, DELIBERATELY. An earlier version also required the
   * consumption to carry a billable line, to keep ORPHAN headers out of the queue. That
   * test cannot be asked at Index level: child rows are fetched only when a record is
   * hydrated individually (a View page), so `OutletConsumptionItems` has zero rows on this
   * page and `row.$OutletConsumptionItems` does not exist at all on records read from a
   * LIST — see the same warning at `useInvoiceIndex.js`'s `itemsByConsumption`. The guard
   * therefore reported EVERY consumption as empty and emptied the whole queue: 63 rows
   * sitting in PENDING_INVOICE_GENERATION rendered as "Everything is invoiced".
   *
   * Loading every item row just to answer it would be the wrong trade — a whole child
   * resource pulled into an index page for a guard against rows the submit path no longer
   * writes (`Add/PageAction.js` writes no header unless something was actually consumed).
   * A projection over parent rows must not depend on data the page does not load; the
   * orphan case belongs where the items ARE loaded — the Add-invoice wizard, which reads
   * the real lines before it offers a bill.
   *
   * The failure directions are not symmetric either: a stray empty header shows one extra
   * row that resolves itself when opened, while this guard hid every real one.
   */
  const uninvoicedConsumptions = computed(() => {
    const covered = invoicedConsumptionCodes.value
    return consumptions.value.filter((row) =>
      progressOf(row) === PENDING_INVOICE_GENERATION &&
      !covered.has(text(row.Code)))
  })

  /**
   * Per-outlet audit state — the tree every widget on this page reads a projection of.
   *
   * One entry per outlet that has any history or any plan, carrying: when it was last
   * audited, how far past its own cadence that is, which band that lands in, and how many
   * consumptions it is still owed an invoice for.
   */
  const outletAudits = computed(() => {
    const frequency = frequencyByOutlet.value
    const names = outletNameByCode.value
    const byOutlet = new Map()

    const entryFor = (code) => {
      const outletCode = text(code)
      if (!outletCode) return null
      if (!byOutlet.has(outletCode)) {
        byOutlet.set(outletCode, {
          outletCode,
          outletName: names.get(outletCode) || outletCode,
          frequencyDays: frequency.of(outletCode),
          lastAuditDate: '',
          latestConsumptionCode: '',
          uninvoicedCount: 0,
          uninvoicedCodes: [],
          plannedToday: null,
          overdueVisits: []
        })
      }
      return byOutlet.get(outletCode)
    }

    // Pass 1 — the outlet's most recent consumption: its DATE (what the ageing bands are
    // measured from) and its CODE (what a row linking to "this outlet's latest
    // consumption" navigates to). The two are tracked together because they must describe
    // the same record — resolving the code in a second pass could pick a different row
    // whenever two consumptions share a date.
    //
    // Cancelled audits do not count as visits made, so they neither reset the clock nor
    // become the link target.
    consumptions.value.forEach((row) => {
      if (progressOf(row) === CANCELLED) return
      const entry = entryFor(row.OutletCode)
      if (!entry) return
      const date = text(row.Date)
      const code = text(row.Code)
      if (!date) return
      // Ties broken by Code, which is monotonic (`OC-000123`): two consumptions recorded
      // on one day resolve to the later of the two rather than to whichever the store
      // happened to hand over first.
      const newer = date > entry.lastAuditDate ||
        (date === entry.lastAuditDate && code > entry.latestConsumptionCode)
      if (!newer) return
      entry.lastAuditDate = date
      entry.latestConsumptionCode = code
    })

    // Pass 2 — the uninvoiced backlog per outlet.
    uninvoicedConsumptions.value.forEach((row) => {
      const entry = entryFor(row.OutletCode)
      if (!entry) return
      entry.uninvoicedCount += 1
      entry.uninvoicedCodes.push(text(row.Code))
    })

    // Pass 3 — planned visits, split into today's and everything already past.
    const today = todayISO()
    visits.value.forEach((visit) => {
      if (progressOf(visit) !== 'PLANNED') return
      const entry = entryFor(visit.OutletCode)
      if (!entry) return
      const date = text(visit.Date)
      if (!date) return
      if (date === today) entry.plannedToday = visit
      else if (date < today) entry.overdueVisits.push(visit)
    })

    // Pass 4 — derive the age reading once, so no consumer recomputes it per render.
    return Array.from(byOutlet.values()).map((entry) => {
      const days = entry.lastAuditDate ? daysSince(entry.lastAuditDate) : null
      const band = overdueBandOf(days, entry.frequencyDays)
      return {
        ...entry,
        daysSinceAudit: days,
        band,
        // `null` days (never audited) is NOT overdue-by-elapsed-time — there is no elapsed
        // time to measure. It is surfaced by the scheduled queue instead, via its planned
        // visit, so a brand-new outlet does not appear in a red band on no evidence.
        isOverdue: days !== null && entry.frequencyDays > 0 && days > entry.frequencyDays
      }
    })
  })

  /**
   * Outlet code → its audit entry.
   *
   * Exists so a per-row resolver — a list row's urgency chip, called once per rendered row
   * — resolves in O(1) instead of scanning `outletAudits`. A `.find()` whose input is
   * another array's iteration is O(n×m) and recomputes in full on every reactive
   * invalidation (CORE_ARCHITECTURE_RULES §6 — Indexed Joins, Never Linear Scans).
   */
  const auditByOutlet = computed(() =>
    new Map(outletAudits.value.map((entry) => [entry.outletCode, entry])))

  // ── Widget projections ──────────────────────────────────────────────────────

  /** Consumptions recorded today, for the signed-in user's visible set. */
  const consumptionsToday = (userId) => {
    const today = todayISO()
    return consumptions.value.filter((row) =>
      countsForUser(row, userId) && text(row.Date) === today && progressOf(row) !== CANCELLED)
  }

  /** Outlets past their own cadence. */
  const overdueOutlets = computed(() => outletAudits.value.filter((entry) => entry.isOverdue))

  /** Outlets carrying at least one consumption that still owes an invoice. */
  const invoiceableOutlets = computed(() => outletAudits.value
    .filter((entry) => entry.uninvoicedCount > 0)
    // Heaviest backlog first — the outlet owing six invoices is the one to clear.
    .sort((a, b) => b.uninvoicedCount - a.uninvoicedCount || a.outletName.localeCompare(b.outletName)))

  /**
   * Today's fulfilment ratio — the gauge's numerator and denominator.
   *
   * COMMITTED-OBLIGATION DENOMINATOR (UI_MODULE_DEVELOPER_GUIDE §9.2): only visits PLANNED
   * for today count. A walk-in audit against no planned visit is real work but was never
   * an obligation, so counting it would let a user push the ratio past 100% by visiting
   * outlets that were not scheduled — which is why the numerator is likewise restricted to
   * consumptions carrying one of today's visit codes, not merely dated today.
   */
  const todayFulfilment = computed(() => {
    const today = todayISO()
    const plannedCodes = new Set()
    visits.value.forEach((visit) => {
      if (text(visit.Date) !== today) return
      const progress = progressOf(visit)
      // COMPLETED counts too: a visit completed today WAS planned for today, and dropping
      // it the moment it is done would make the denominator shrink as the numerator grows.
      if (progress === 'PLANNED' || progress === 'COMPLETED') plannedCodes.add(text(visit.Code))
    })

    const doneCodes = new Set()
    consumptions.value.forEach((row) => {
      if (progressOf(row) === CANCELLED) return
      const visitCode = text(row.OutletVisitCode)
      if (visitCode && plannedCodes.has(visitCode)) doneCodes.add(visitCode)
    })

    return { completed: doneCodes.size, planned: plannedCodes.size }
  })

  /**
   * Outlets bucketed by how far past their cadence they are.
   *
   * Banded per outlet against ITS OWN frequency, then counted into the shared tier scale —
   * so a weekly outlet and a monthly one land in the same band when each is equally late
   * in proportion, which a fixed day-threshold table could not express.
   *
   * Outlets with no readable age or no configured cadence are left uncounted rather than
   * dumped into the healthiest or the worst bucket.
   */
  const ageingBuckets = computed(() => {
    const scale = overdueBands(frequencyByOutlet.value.fallback || 1)
    if (!scale.length) return []
    const counts = scale.map(() => 0)
    outletAudits.value.forEach((entry) => {
      if (!entry.band) return
      const index = overdueBands(entry.frequencyDays).findIndex((band) => band.label === entry.band.label)
      if (index >= 0) counts[index] += 1
    })
    return scale.map((band, index) => ({
      label: band.label, caption: band.caption, color: band.color, count: counts[index]
    }))
  })

  /**
   * The scheduled work queue — today's planned visits first, then everything overdue,
   * oldest first.
   *
   * Ordering is a work order, not a preference (UI_MODULE_DEVELOPER_GUIDE §7.2): within
   * the overdue group the longest wait is the most urgent, so it sorts oldest-first.
   */
  const scheduledVisitRows = computed(() => {
    const today = todayISO()
    const names = outletNameByCode.value
    const decorate = (visit, overdue) => ({
      visit,
      visitCode: text(visit.Code),
      outletCode: text(visit.OutletCode),
      outletName: names.get(text(visit.OutletCode)) || text(visit.OutletCode),
      date: text(visit.Date),
      overdue,
      daysLate: overdue ? daysSince(visit.Date) : 0
    })

    const todays = []
    const overdue = []
    visits.value.forEach((visit) => {
      if (progressOf(visit) !== 'PLANNED') return
      const date = text(visit.Date)
      if (!date) return
      if (date === today) todays.push(decorate(visit, false))
      else if (date < today) overdue.push(decorate(visit, true))
    })

    todays.sort((a, b) => a.outletName.localeCompare(b.outletName))
    overdue.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    return [...todays, ...overdue]
  })

  return {
    consumptions,
    visits,
    invoices,
    outlets,
    outletNameByCode,
    frequencyByOutlet,
    invoicedConsumptionCodes,
    uninvoicedConsumptions,
    soldQtyOfConsumption,
    outletAudits,
    auditByOutlet,
    consumptionsToday,
    overdueOutlets,
    invoiceableOutlets,
    todayFulfilment,
    ageingBuckets,
    scheduledVisitRows
  }
})

/**
 * The data store is passed IN rather than imported at module scope, matching every
 * `_resource/Master/*` composable: `defineSharedComposable` keys its cached scope on the
 * identity it is handed, so a store swap (a tenant switch) rebuilds the whole projection
 * instead of serving the previous tenant's index.
 */
export function useConsumptionIndex () {
  return shared(useDataStore())
}
