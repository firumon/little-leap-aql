/**
 * Outlets › the one operational projection — Layer 2.
 *
 * ONE pass over the five operational streams, producing every figure the Outlets module
 * shows: the geographic breakdown, the three pending queues, the two visit queues, the
 * activity-health ratio, the six list views, and the per-outlet slices the View page's cards
 * read. Built through `defineSharedComposable`, so the pass runs once per app and every
 * caller reads the same memoized computeds.
 *
 * ── WHY ONE AGGREGATE AND NOT A COMPOSABLE PER WIDGET ──
 * Every number on the Index page and every card on the View page is a PROJECTION of the same
 * indexed structure. The "Restocks Pending Approval" metric and the restock card on an
 * outlet's View page are the same filter over the same map, so they cannot drift apart
 * (CORE_ARCHITECTURE_RULES §6 — Enrich Once, Then Project).
 *
 * ── INDEXED JOINS, NOT LINEAR SCANS ──
 * Every stream is grouped into a `Map` keyed by `OutletCode` exactly once. A card asking
 * "this outlet's restocks" is an O(1) lookup; nothing iterates a stream inside a render loop.
 *
 * The workflow vocabulary of each stream is imported from that stream's OWN domain layer —
 * this file never restates what `PENDING_APPROVAL` or `PENDING_INVOICE_GENERATION` mean
 * (UI_RESOURCE_DOMAIN_LOGIC.md §3.2: multi-resource logic is composed by importing named
 * domain modules, never by re-deriving them).
 */

import { computed } from 'vue'
import { defineSharedComposable } from 'src/utils/appHelpers'
import { useDataStore } from 'src/stores/data'
import { useOutletResource } from './useOutletResource'
import {
  VISIT_WINDOW_DAYS,
  ACTIVITY_WINDOW_DAYS,
  ACTIVITY_STREAMS,
  ageInDays,
  withinPastDays,
  withinNextDays,
  isActiveRow,
  isActiveOutlet
} from './useOutletActivity'
import {
  PENDING_APPROVAL as RESTOCK_PENDING_APPROVAL,
  AWAITING_DELIVERY as RESTOCK_AWAITING_DELIVERY
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'
import { PENDING_INVOICE_GENERATION } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'
import { PLANNED as VISIT_PLANNED, COMPLETED as VISIT_COMPLETED } from 'src/_resource/Operation/OutletVisits/composables/useVisitProgress'

const text = (value) => (value == null ? '' : String(value).trim())
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const upper = (value) => text(value).toUpperCase()

/** Group already-filtered rows into a `Map` keyed by their outlet code. */
function groupByOutlet (rows, column = 'OutletCode') {
  const map = new Map()
  for (const row of rows) {
    const code = text(row[column])
    if (!code) continue
    const bucket = map.get(code)
    if (bucket) bucket.push(row)
    else map.set(code, [row])
  }
  return map
}

/** The most recent (largest) ISO date string in a set of rows, or `''` when there is none. */
function latestDate (rows, column) {
  let latest = ''
  for (const row of rows) {
    const value = text(row[column])
    if (value && value > latest) latest = value
  }
  return latest
}

/**
 * Count distinct outlet codes across a set of rows.
 *
 * The three pending metrics all count OUTLETS, not documents: an outlet with four
 * consumptions awaiting invoicing is one place someone has to go, not four.
 */
function distinctOutlets (rows) {
  const seen = new Set()
  for (const row of rows) {
    const code = text(row.OutletCode)
    if (code) seen.add(code)
  }
  return seen.size
}

const shared = defineSharedComposable((dataStore) => {
  const { outlets, activeOutlets, outletMap } = useOutletResource()

  const rows = (name) => (dataStore.getRecords(name) || []).map(asRow).filter(isActiveRow)

  // ── Raw streams ─────────────────────────────────────────────────────────────

  const rawVisits = computed(() => rows('OutletVisits'))
  const rawRestocks = computed(() => rows('OutletRestocks'))
  const rawConsumptions = computed(() => rows('OutletConsumptions'))
  const rawInvoices = computed(() => rows('OutletConsumptionInvoices'))
  const rawPayments = computed(() => rows('OutletPayments'))
  const rawReturns = computed(() => rows('OutletReturns'))
  const rawStorages = computed(() => (dataStore.getRecords('OutletStorages') || []).map(asRow))

  // ── Indexed joins — every stream keyed by outlet, built exactly once ─────────

  const visitsByOutlet = computed(() => groupByOutlet(rawVisits.value))
  const restocksByOutlet = computed(() => groupByOutlet(rawRestocks.value))
  const consumptionsByOutlet = computed(() => groupByOutlet(rawConsumptions.value))
  const invoicesByOutlet = computed(() => groupByOutlet(rawInvoices.value))
  const paymentsByOutlet = computed(() => groupByOutlet(rawPayments.value))
  const returnsByOutlet = computed(() => groupByOutlet(rawReturns.value))
  const storagesByOutlet = computed(() => groupByOutlet(rawStorages.value))

  /** The five activity streams, resolved to their live maps, in vocabulary order. */
  const streamMaps = computed(() => ({
    visit: visitsByOutlet.value,
    restock: restocksByOutlet.value,
    consumption: consumptionsByOutlet.value,
    invoice: invoicesByOutlet.value,
    payment: paymentsByOutlet.value
  }))

  // ── Per-outlet activity summaries ───────────────────────────────────────────
  //
  // ONE row per outlet, carrying the last event date per stream, the overall last-activity
  // date, and its age in days. Everything downstream — the health ratio, the "No Updates"
  // queue, all four "Recently …" queues, the View page's cards — is a filter or a sort over
  // this one array.

  const outletSummaries = computed(() => {
    const maps = streamMaps.value

    return outlets.value.map((outlet) => {
      const code = outlet.code
      const streams = {}
      let lastActivityAt = ''

      for (const stream of ACTIVITY_STREAMS) {
        const streamRows = maps[stream.key]?.get(code) || []
        const last = latestDate(streamRows, stream.dateColumn)
        streams[stream.key] = { count: streamRows.length, lastAt: last }
        if (last && last > lastActivityAt) lastActivityAt = last
      }

      const summary = {
        outlet,
        code,
        name: outlet.name || code,
        province: outlet.province,
        city: outlet.city,
        area: outlet.area,
        status: outlet.status,
        streams,
        lastActivityAt,
        lastActivityDays: ageInDays(lastActivityAt),

        /**
         * The row's keyword haystack, built ONCE here rather than per keystroke.
         *
         * Every list view on the Index page filters summaries, not raw records, so the
         * framework's own `filteredRecords` search never reaches them. Rebuilding a search
         * string for 139 outlets on every character typed is the linear scan this module
         * exists to avoid; built here it is recomputed only when the outlet data itself
         * changes, and a keystroke costs one `includes` per row.
         *
         * It covers exactly the fields a reader can SEE on a row plus the identifiers they
         * are likely to paste — searching a column nobody is shown returns matches that
         * look like bugs.
         */
        search: [
          code,
          outlet.name,
          outlet.province,
          outlet.city,
          outlet.area,
          outlet.contactPerson,
          outlet.phone,
          outlet.email
        ].map(text).filter(Boolean).join(' ').toLowerCase()
      }

      summary.isActive = isActiveOutlet(summary)
      return summary
    })
  })

  const summaryByCode = computed(() =>
    new Map(outletSummaries.value.map((summary) => [summary.code, summary])))

  /** Only the summaries of outlets that are themselves Active master records. */
  const activeSummaries = computed(() =>
    outletSummaries.value.filter((summary) => upper(summary.status) === 'ACTIVE'))

  // ── Metric 1: total outlets ─────────────────────────────────────────────────

  const totalsMetrics = computed(() => ({
    total: outlets.value.length,
    active: activeOutlets.value.length,
    inactive: outlets.value.length - activeOutlets.value.length
  }))

  // ── Geographic distribution ─────────────────────────────────────────────────
  //
  // Counted from ACTIVE outlets only: a distribution is a picture of where the business
  // currently operates, and an archived outlet is not a place anyone visits. Blank values
  // are dropped rather than bucketed as "Unknown" — a tenant that never fills `Area` should
  // see the Area tab empty and the widget hide it, not a single bar labelled with a guess.

  function countBy (key) {
    const counts = new Map()
    for (const summary of activeSummaries.value) {
      const value = text(summary[key])
      if (!value) continue
      counts.set(value, (counts.get(value) || 0) + 1)
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }

  const geography = computed(() => ({
    province: countBy('province'),
    city: countBy('city'),
    area: countBy('area')
  }))

  // ── Metric 2–4: the three pending queues ────────────────────────────────────

  const pendingRestockRows = computed(() =>
    rawRestocks.value.filter((row) => upper(row.Progress) === RESTOCK_PENDING_APPROVAL))

  const pendingDeliveryRows = computed(() =>
    rawRestocks.value.filter((row) => RESTOCK_AWAITING_DELIVERY.includes(upper(row.Progress))))

  const pendingInvoiceRows = computed(() =>
    rawConsumptions.value.filter((row) => upper(row.Progress) === PENDING_INVOICE_GENERATION))

  const pendingMetrics = computed(() => ({
    restockOutlets: distinctOutlets(pendingRestockRows.value),
    restockRequests: pendingRestockRows.value.length,
    deliveryOutlets: distinctOutlets(pendingDeliveryRows.value),
    deliveryRequests: pendingDeliveryRows.value.length,
    invoiceOutlets: distinctOutlets(pendingInvoiceRows.value),
    invoiceConsumptions: pendingInvoiceRows.value.length
  }))

  // ── Metric 5–6: the two visit queues ────────────────────────────────────────
  //
  // Both read `VISIT_WINDOW_DAYS`, the field-route window, NOT the wider activity window —
  // "who did we see this week" and "who is on the list" are route questions.

  const recentVisitRows = computed(() =>
    rawVisits.value.filter((row) =>
      upper(row.Progress) === VISIT_COMPLETED && withinPastDays(row.Date, VISIT_WINDOW_DAYS)))

  const upcomingVisitRows = computed(() =>
    rawVisits.value.filter((row) =>
      upper(row.Progress) === VISIT_PLANNED && withinNextDays(row.Date, VISIT_WINDOW_DAYS)))

  const visitMetrics = computed(() => ({
    windowDays: VISIT_WINDOW_DAYS,
    recentVisits: recentVisitRows.value.length,
    recentOutlets: distinctOutlets(recentVisitRows.value),
    upcomingVisits: upcomingVisitRows.value.length,
    upcomingOutlets: distinctOutlets(upcomingVisitRows.value)
  }))

  // ── Activity health ─────────────────────────────────────────────────────────
  //
  // The denominator is every outlet on the master list, not only the ones with a stream —
  // an outlet nobody has touched is precisely what this ratio exists to make visible.

  const activityMetrics = computed(() => {
    const total = activeSummaries.value.length
    const active = activeSummaries.value.filter((summary) => summary.isActive).length
    return {
      windowDays: ACTIVITY_WINDOW_DAYS,
      total,
      active,
      stale: total - active,
      ratio: total > 0 ? active / total : 0
    }
  })

  // ── The six list views ──────────────────────────────────────────────────────
  //
  // Four of them are "recently X" queues over the SAME activity window as the health ratio,
  // so the bar and the pills describe one definition of "recent" rather than two. The visit
  // METRICS above deliberately use the narrower route window; the visit LIST sits beside its
  // three siblings and uses theirs.

  const byName = (a, b) => a.name.localeCompare(b.name)
  const byStreamDesc = (key) => (a, b) =>
    text(b.streams[key].lastAt).localeCompare(text(a.streams[key].lastAt)) || byName(a, b)

  /** Outlets whose given stream fired inside the activity window, newest first. */
  const recentlyIn = (key) => activeSummaries.value
    .filter((summary) => withinPastDays(summary.streams[key].lastAt, ACTIVITY_WINDOW_DAYS))
    .sort(byStreamDesc(key))

  const views = computed(() => ({
    AllOutlets: [...activeSummaries.value].sort(byName),

    // Oldest silence first — and outlets that were NEVER touched (`lastActivityDays === null`)
    // lead the queue, because "no event ever recorded" is the longest silence there is and
    // sorting them numerically would sink them below a 400-day-old one.
    NoUpdates: activeSummaries.value
      .filter((summary) => !summary.isActive)
      .sort((a, b) => {
        const left = a.lastActivityDays
        const right = b.lastActivityDays
        if (left === null && right === null) return byName(a, b)
        if (left === null) return -1
        if (right === null) return 1
        return right - left || byName(a, b)
      }),

    RecentlyRestocked: recentlyIn('restock'),
    RecentlyConsumed: recentlyIn('consumption'),
    RecentlyPaid: recentlyIn('payment'),
    RecentlyVisited: recentlyIn('visit')
  }))

  // ── Per-outlet slices, for the View page ────────────────────────────────────
  //
  // Every getter is an O(1) map read followed by a sort of that outlet's own rows. A View
  // card never scans a whole stream.

  const sortedFor = (map, code, column) =>
    [...(map.get(text(code)) || [])].sort((a, b) => text(b[column]).localeCompare(text(a[column])))

  return {
    // Raw streams — for a consumer that genuinely needs the whole set.
    rawVisits,
    rawRestocks,
    rawConsumptions,
    rawInvoices,
    rawPayments,
    rawReturns,
    rawStorages,

    // Indexed joins.
    outletMap,
    visitsByOutlet,
    restocksByOutlet,
    consumptionsByOutlet,
    invoicesByOutlet,
    paymentsByOutlet,
    returnsByOutlet,
    storagesByOutlet,

    // Summaries.
    outletSummaries,
    summaryByCode,
    activeSummaries,

    // Metrics.
    totalsMetrics,
    geography,
    pendingMetrics,
    visitMetrics,
    activityMetrics,

    // Queues.
    pendingRestockRows,
    pendingDeliveryRows,
    pendingInvoiceRows,
    recentVisitRows,
    upcomingVisitRows,
    views,

    // Per-outlet projections.
    summaryFor: (code) => summaryByCode.value.get(text(code)) || null,
    visitsFor: (code) => sortedFor(visitsByOutlet.value, code, 'Date'),
    restocksFor: (code) => sortedFor(restocksByOutlet.value, code, 'Date'),
    consumptionsFor: (code) => sortedFor(consumptionsByOutlet.value, code, 'Date'),
    invoicesFor: (code) => sortedFor(invoicesByOutlet.value, code, 'Date'),
    paymentsFor: (code) => sortedFor(paymentsByOutlet.value, code, 'Date'),
    returnsFor: (code) => sortedFor(returnsByOutlet.value, code, 'Date'),
    stockFor: (code) => [...(storagesByOutlet.value.get(text(code)) || [])]
      .filter((row) => num(row.Quantity) !== 0)
      .sort((a, b) => num(b.Quantity) - num(a.Quantity))
  }
})

export function useOutletIndex () {
  return shared(useDataStore())
}
