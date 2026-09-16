import { computed, inject } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { useInvoiceIndex } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex'
import { canCreateInvoice } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'

/**
 * OutletConsumptionInvoices › Index — the Core-composable relay for the Index page
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * PLACEMENT — `Index/`, the page tier (§6.2): its consumers are the five runtime list
 * overrides this page resolves and nothing else.
 *
 * It calls no `inject()` — the Index lists read the shared aggregate rather than the active
 * record. It exists because §6 admits no exception for "generic identity/navigation reads":
 * `useResourceNav` and `useCurrencyResource` may not be imported by a `.vue` file directly,
 * and this relay is where those imports legally live.
 *
 * Every projection below is READ from `useInvoiceIndex` (Layer 2), never re-derived. The
 * five runtime views, the metric cards and the buckets are all projections of one aggregate,
 * which is what makes it impossible for the "12 unpaid" card and the Pending Invoices list
 * beneath it to disagree (CORE_ARCHITECTURE_RULES §6).
 */
/**
 * The in-flight load, shared by every component that calls the relay during one page visit.
 * Module-scoped deliberately: a `ref` inside the function would be re-created per caller and
 * defeat the de-duplication it exists for.
 */
let pending = null

export function useInvoiceIndexContext () {
  const nav = useResourceNav()
  const ui = useAQLConfig()
  const { _C } = useCurrencyResource()

  const index = useInvoiceIndex()

  const resourceRecord = inject('resourceRecord', null)

  /**
   * The live keyword from `FilterInput`. Every list here renders Layer 2 aggregate rows, not
   * `filteredRecords`, so the framework search never reaches them and each list applies this.
   */
  const filterTerm = computed(() => String(resourceRecord?.filterTerm?.value ?? '').trim().toLowerCase())

  /**
   * The resources this page reads BESIDES its own.
   *
   * `OutletConsumptionItems` is required, not optional: both the "To Invoice" metric and the
   * Invoiceable Outlets view exclude consumptions with no billable lines, and that test reads
   * item rows. Without the load the page cannot tell an orphan header from a real backlog and
   * silently reports every uninvoiced consumption as billable.
   *
   * `OutletPayments` backs every balance on the page. The invoices resource itself is fetched
   * by the route.
   */
  const sources = ['OutletConsumptions', 'OutletConsumptionItems', 'OutletPayments', 'Outlets']
    .map((name) => usePageRecord(name))

  /** Renders from cache and syncs the delta in the background — never blocks first paint. */
  const loadSources = () => Promise.all(sources.map((resource) => resource.reload()))

  /**
   * Kick the load ONCE per page visit, however many components call this relay.
   *
   * The Index has no single always-mounted card to hang an `onMounted` on — the metric cards
   * are a JS modifier with no lifecycle, and every list view mounts only while its own pill is
   * active. So the fetch is started here, guarded by a flag that resets when the page is left,
   * rather than fired once per consuming component (which would be six duplicate syncs).
   */
  if (!pending) {
    pending = loadSources().finally(() => { pending = null })
  }

  return {
    loadSources,
    ui,
    nav,
    money: (value) => _C(Number(value) || 0, true),

    outletPendings: index.outletPendings,
    invoiceableOutlets: index.invoiceableOutlets,
    storedViews: index.storedViews,

    filterTerm,

    /** Narrow one view's rows by the live keyword. Only the active list pays for a keystroke. */
    filterInvoices: (rows) => {
      const keyword = filterTerm.value
      const list = Array.isArray(rows) ? rows : []
      if (!keyword) return list
      return list.filter((row) => (row?.search || '').includes(keyword))
    },

    canCreate: computed(() => canCreateInvoice()),

    /** Open one invoice. */
    openInvoice: (code) => {
      const next = String(code || '').trim()
      if (next) nav.goTo('view', { code: next })
    },

    /**
     * Start a new invoice, optionally pre-loaded with an outlet and its uninvoiced
     * consumptions.
     *
     * The query is why this is a Layer 3 navigation rather than a GAS `navigate` action:
     * `navigate.target` carries only `code`/`pageSlug` (UI_ACTION_SYSTEM.md §7.0.1a), and
     * the generator needs the outlet to open on.
     */
    startInvoice: (outletCode = '') => {
      const outlet = String(outletCode || '').trim()
      nav.goTo('add', outlet ? { query: { outletCode: outlet } } : {})
    }
  }
}

