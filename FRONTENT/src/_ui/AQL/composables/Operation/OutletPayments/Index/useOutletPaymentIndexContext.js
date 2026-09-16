import { computed, inject } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { usePageRecord } from 'src/composables/resources/usePageRecord'
import { useOutletPaymentIndex } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentIndex'

/**
 * OutletPayments › Index — the Core-composable relay for the Index page
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1). Lists may not import `useResourceNav`
 * themselves, so that import lives here.
 */

const text = (value) => (value == null ? '' : String(value).trim())

// Module-scoped so one page visit fires one load, however many lists call the relay.
let pending = null

export function useOutletPaymentIndexContext () {
  const nav = useResourceNav()

  const index = useOutletPaymentIndex()

  const resourceRecord = inject('resourceRecord', null)

  /**
   * The live keyword from `FilterInput`. Every list here renders Layer 2 aggregate rows, not
   * `filteredRecords`, so the framework search never reaches them and each list applies this.
   */
  const filterTerm = computed(() => String(resourceRecord?.filterTerm?.value ?? '').trim().toLowerCase())

  const sources = ['OutletConsumptionInvoices', 'Outlets']
    .map((name) => usePageRecord(name))

  /** Renders from cache and syncs the delta in the background — never blocks first paint. */
  const loadSources = () => Promise.all(sources.map((resource) => resource.reload()))

  if (!pending) {
    pending = loadSources().finally(() => { pending = null })
  }

  return {
    loadSources,
    nav,
    views: index.views,

    filterTerm,

    /** Narrow one view's rows by the live keyword. Only the active list pays for a keystroke. */
    filterPayments: (rows) => {
      const keyword = filterTerm.value
      const list = Array.isArray(rows) ? rows : []
      if (!keyword) return list
      return list.filter((row) => (row?.search || '').includes(keyword))
    },

    /** Open one payment receipt. */
    openPayment: (code) => {
      const next = text(code)
      if (next) nav.goTo('view', { code: next })
    },

    /**
     * Start a payment. The invoice code is optional: the Outlets queue opens the
     * form on the outlet and lets the collector pick the invoices there.
     */
    startPayment: (outletCode, invoiceCode) => {
      const query = { outletCode: text(outletCode) }
      if (text(invoiceCode)) query.invoiceCode = text(invoiceCode)
      nav.goTo('add', { query })
    }
  }
}
