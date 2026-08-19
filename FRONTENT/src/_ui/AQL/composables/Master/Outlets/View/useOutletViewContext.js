import { ref, computed, inject } from 'vue'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useRouteConfig } from 'src/composables/resources/useRouteConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRecord } from 'src/composables/resources/useRecord'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { useOutletIndex } from 'src/_resource/Master/Outlets/composables/useOutletIndex'
import {
  ACTIVITY_STREAMS,
  ACTIVITY_WINDOW_DAYS,
  activityColor,
  activityLabel,
  ageInDays
} from 'src/_resource/Master/Outlets/composables/useOutletActivity'
import * as VisitProgress from 'src/_resource/Operation/OutletVisits/composables/useVisitProgress'
import * as RestockProgress from 'src/_resource/Operation/OutletRestocks/composables/useRestockProgress'
import * as InvoiceWorkflow from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'
import * as PaymentProgress from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentProgress'
import {
  netInvoiceTotalOf,
  paidTotalOf
} from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentAllocation'

/**
 * Outlets › View — the injection relay for the View page
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * ONE `inject()` for the nine cards on this page, and the one place this page's imports of
 * `useResourceNav`, `useRecord`, `useCurrencyResource` and the Layer 2 domain modules legally
 * live. Every `.vue` under `View/` imports this file and nothing else from outside its folder.
 *
 * ── ONE PROJECTION, NINE CARDS ──
 * Every card reads a slice of the SAME `useOutletIndex` aggregate the Index page's widgets
 * read. The pending-restock count in the summary card and the rows in the restock card are
 * one filter over one map, so the two can never disagree (UI_MODULE_DEVELOPER_GUIDE.md §7.4).
 *
 * ── MULTI-RESOURCE, COMPOSED NOT RE-DERIVED ──
 * Five neighbouring resources' workflow vocabularies are imported as named domain modules
 * (§3.2) rather than restated here. A restock chip on an outlet's page is painted by
 * `OutletRestocks`' own vocabulary, so it matches the chip the restock module would draw.
 *
 * ── STRICT VIEW CONTRACT ──
 * This page RENDERS INFORMATION. There is no `startRestock`/`planVisit` relay here and no
 * card exposes one; the four operational entry points live in the FAB cluster, where the
 * Action subsystem owns their permission gating.
 *
 * PLACEMENT — `View/`, the page tier (§6.2): only this page provides the context it injects.
 */

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const upper = (value) => text(value).toUpperCase()

/**
 * The resources this page reads BESIDES its own, and the streams it draws every card from.
 *
 * `OutletReturns` and `OutletStorages` are here and not on the Index relay: no estate-wide
 * widget needs them, but an outlet's own page shows both its open returns and what is
 * currently sitting on its shelves.
 */
const SOURCE_RESOURCES = [
  'OutletOperatingRules',
  'OutletVisits',
  'OutletRestocks',
  'OutletReturns',
  'OutletConsumptions',
  'OutletConsumptionInvoices',
  'OutletPayments',
  'OutletStorages'
]

let pendingLoad = null
/** Whether the streams have landed at least once — see the Index relay for the rationale. */
let streamsLoaded = false

export function useOutletViewContext () {
  const ui = useAQLConfig()
  const nav = useResourceNav()
  const { code } = useRouteConfig()
  const { _C } = useCurrencyResource()
  const { skuLabelOf } = useSkuResource()

  const resourceConfig = inject('resourceConfig', null)
  const resourceRecord = inject('resourceRecord', null)

  const index = useOutletIndex()

  const loaded = ref(streamsLoaded)
  if (!streamsLoaded) {
    if (!pendingLoad) {
      const sources = SOURCE_RESOURCES.map((name) => useRecord(name))
      pendingLoad = Promise.all(sources.map((resource) => resource.reload()))
        .finally(() => { streamsLoaded = true; pendingLoad = null })
    }
    pendingLoad.finally(() => { loaded.value = true })
  }

  const pending = computed(() => (resourceRecord?.loading?.value ?? false) || !loaded.value)

  const outletCode = computed(() => text(code.value))

  /**
   * The outlet, preferred from the enriched master map rather than from `resourceRecord`.
   *
   * The enriched entry carries the joined `OutletOperatingRules` row — the limits, the visit
   * cadence, the due days, the resolved price list — which the raw sheet record does not. The
   * raw record is the fallback for the tick before the rules resource settles.
   */
  const outlet = computed(() =>
    index.outletMap.value.get(outletCode.value) || null)

  const record = computed(() => outlet.value || resourceRecord?.record?.value || null)

  const summary = computed(() => index.summaryFor(outletCode.value))

  // ── The five streams, sliced to this outlet ─────────────────────────────────

  const visits = computed(() => index.visitsFor(outletCode.value))
  const restocks = computed(() => index.restocksFor(outletCode.value))
  const returns = computed(() => index.returnsFor(outletCode.value))
  const consumptions = computed(() => index.consumptionsFor(outletCode.value))
  const invoices = computed(() => index.invoicesFor(outletCode.value))
  const payments = computed(() => index.paymentsFor(outletCode.value))
  const stock = computed(() => index.stockFor(outletCode.value))

  // ── Invoice balances ────────────────────────────────────────────────────────
  //
  // Read through `OutletPayments`' own allocation domain, not recomputed: what an invoice is
  // worth after tax and discount, and what counts as a payment against it, are accounting
  // decisions that belong to the resources that own them.

  const paymentsByInvoice = computed(() => {
    const map = new Map()
    for (const payment of payments.value) {
      const invoiceCode = text(payment.OutletConsumptionInvoiceCode)
      if (!invoiceCode) continue
      const bucket = map.get(invoiceCode)
      if (bucket) bucket.push(payment)
      else map.set(invoiceCode, [payment])
    }
    return map
  })

  /** Each invoice with its own total, collected amount and remaining balance. */
  const invoiceRows = computed(() => invoices.value.map((invoice) => {
    const invoiceCode = text(invoice.Code)
    const own = paymentsByInvoice.value.get(invoiceCode) || []
    const total = netInvoiceTotalOf(invoice)
    const collected = paidTotalOf(own)
    return {
      row: invoice,
      code: invoiceCode,
      date: text(invoice.Date),
      dueDate: text(invoice.DueDate),
      total,
      collected,
      balance: Math.max(0, Number((total - collected).toFixed(2))),
      meta: InvoiceWorkflow.progressMetaOf(invoice),
      isOpen: InvoiceWorkflow.isOpen(invoice)
    }
  }))

  const outstanding = computed(() =>
    Number(invoiceRows.value
      .filter((entry) => entry.isOpen)
      .reduce((sum, entry) => sum + entry.balance, 0)
      .toFixed(2)))

  // ── Summary statistics ──────────────────────────────────────────────────────
  //
  // The four figures the legacy Hub led with, kept because they are the right four — but
  // computed from the shared aggregate rather than from a page-local fetch.

  const plannedVisits = computed(() =>
    visits.value.filter((row) => upper(row.Progress) === VisitProgress.PLANNED))

  const pendingRestocks = computed(() =>
    restocks.value.filter((row) => !RestockProgress.TERMINAL_STATES.includes(upper(row.Progress))))

  const openReturns = computed(() =>
    returns.value.filter((row) => upper(row.Progress) !== 'CANCELLED' && upper(row.Progress) !== 'COMPLETED'))

  const stockUnits = computed(() =>
    stock.value.reduce((sum, row) => sum + num(row.Quantity), 0))

  return {
    ui,
    pending,
    activityWindowDays: ACTIVITY_WINDOW_DAYS,
    activityStreams: ACTIVITY_STREAMS,

    /** Evaluate a prop that may be a function of the record, exactly as a Section does. */
    evaluate: (value) => (typeof value === 'function'
      ? value(record.value, resourceConfig?.config?.value ?? null)
      : value),
    money: (value) => _C(num(value), true),
    skuLabelOf,
    ageInDays,
    activityColor,
    activityLabel,

    record,
    outlet,
    outletCode,
    summary,

    visits,
    restocks,
    returns,
    consumptions,
    invoices,
    invoiceRows,
    payments,
    stock,

    plannedVisits,
    pendingRestocks,
    openReturns,
    outstanding,
    stockUnits,

    // Neighbouring vocabularies, relayed so a card needs one import line.
    visitMeta: (row) => ({
      label: VisitProgress.progressLabel(row),
      color: VisitProgress.progressColor(row),
      icon: VisitProgress.progressIcon(row)
    }),
    restockMeta: (row) => {
      const state = RestockProgress.progressOf(row)
      return {
        label: RestockProgress.progressLabel(state),
        color: RestockProgress.progressColor(state),
        icon: RestockProgress.progressIcon(state)
      }
    },
    paymentMeta: (row) => PaymentProgress.progressMetaOf(row),

    /** Open a record on the resource that owns it — the only navigation this page performs. */
    openRecord: (resourceSlug, recordCode, scope = 'operation') => {
      const target = text(recordCode)
      if (!target) return
      nav.goTo('view', { scope, resourceSlug, code: target })
    }
  }
}
