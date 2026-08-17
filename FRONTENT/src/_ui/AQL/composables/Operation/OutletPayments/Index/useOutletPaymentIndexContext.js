import { computed } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRecord } from 'src/composables/resources/useRecord'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { useOutletPaymentIndex } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentIndex'
import { canCreatePayment } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentProgress'

/**
 * OutletPayments › Index — the Core-composable relay for the Index page
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `Index/`, the page tier (§6.2): its consumers are the six runtime list
 * overrides this page resolves, and nothing else.
 *
 * It calls no `inject()` — every list reads the shared aggregate rather than the active
 * record. It exists because §6 admits no exception for "generic identity/navigation reads":
 * `useResourceNav` and `useCurrencyResource` may not be imported by a `.vue` file directly,
 * and this relay is where those imports legally live.
 *
 * Every projection below is READ from `useOutletPaymentIndex` (Layer 2), never re-derived,
 * so the "Overdue" metric card and the Overdue queue beneath it cannot disagree
 * (CORE_ARCHITECTURE_RULES §6).
 */

const text = (value) => (value == null ? '' : String(value).trim())

/**
 * The in-flight load, shared by every component that calls the relay during one page visit.
 * Module-scoped deliberately: a `ref` inside the function would be re-created per caller and
 * defeat the de-duplication it exists for.
 */
let pending = null

export function useOutletPaymentIndexContext () {
  const nav = useResourceNav()
  const ui = useAQLConfig()
  const { _C } = useCurrencyResource()

  const index = useOutletPaymentIndex()

  /**
   * The resources this page reads BESIDES its own.
   *
   * `OutletConsumptionInvoices` backs all four invoice queues and every balance on the page;
   * `Outlets` supplies the name each row is identified by. The payments resource itself is
   * fetched by the route.
   */
  const sources = ['OutletConsumptionInvoices', 'Outlets']
    .map((name) => useRecord(name))

  /** Renders from cache and syncs the delta in the background — never blocks first paint. */
  const loadSources = () => Promise.all(sources.map((resource) => resource.reload()))

  /**
   * Kick the load ONCE per page visit, however many components call this relay.
   *
   * The Index has no single always-mounted card to hang an `onMounted` on — the metric cards
   * are a JS modifier with no lifecycle, and every list view mounts only while its own pill
   * is active — so the fetch is started here behind a flag that resets when it settles.
   */
  if (!pending) {
    pending = loadSources().finally(() => { pending = null })
  }

  return {
    loadSources,
    ui,
    nav,
    money: (value) => _C(Number(value) || 0, true),

    overdueMetrics: index.overdueMetrics,
    todayCollectionsMetrics: index.todayCollectionsMetrics,
    linearProgressData: index.linearProgressData,
    views: index.views,
    dueSplit: index.dueSplit,
    openInvoices: index.openInvoices,

    canCreate: computed(() => canCreatePayment()),

    /** Open one payment receipt. */
    openPayment: (code) => {
      const next = text(code)
      if (next) nav.goTo('view', { code: next })
    },

    /**
     * Start a payment against one invoice.
     *
     * The query is why this is a Layer 3 navigation rather than a GAS `navigate` action:
     * `navigate.target` carries only `code`/`pageSlug` (UI_ACTION_SYSTEM.md §7.0.1a), and the
     * collector needs BOTH the outlet to open on and the invoice to pre-select.
     */
    startPayment: (row = {}) => {
      const outletCode = text(row.outletCode || row.OutletCode)
      const invoiceCode = text(row.code || row.Code)
      nav.goTo('add', { query: { outletCode, invoiceCode } })
    }
  }
}
