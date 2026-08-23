import { inject, computed } from 'vue'
import { evaluateProp } from 'src/composables/resources/useSectionResolver'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useRecord } from 'src/composables/resources/useRecord'
import { useCurrencyResource } from 'src/_resource/Master/Currencies/composables/useCurrencyResource'
import { useSkuResource } from 'src/_resource/Master/SKUs/composables/useSkuResource'
import { usePriceListResource } from 'src/_resource/Master/PriceLists/composables/usePriceListResource'
import { useInvoiceIndex } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex'
import {
  invoiceCurrencyOf,
  makeLineTaxResolver
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import {
  editableInvoiceItems,
  invoiceEditDefaults,
  makeStoredPriceResolver,
  recalculateStoredInvoice
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'
import { canEditInvoice, progressMetaOf, isPaid, isCancelled } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'

/**
 * OutletConsumptionInvoices › Edit — the injection relay and the page's working state
 * (UI_RESOURCE_DOMAIN_LOGIC.md §6.1).
 *
 * ONE `inject()` for the four cards this page stacks. Every `.vue` under `Edit/` calls this
 * instead of injecting directly, and none of them imports a store or a Core Composable.
 *
 * PLACEMENT — `Edit/`, the page tier (§6.2): only this page provides the context it injects.
 *
 * ── NO HYDRATION STEP, BY DESIGN ──
 * The four answers this page collects are CONTROL FIELDS, and each getter falls back to the
 * stored row when the user has not touched it. So there is nothing to seed on mount, no
 * watcher racing the record load, and no half-hydrated state to show. The one thing that
 * must be tracked is WHICH invoice the control fields belong to: the node outlives a route
 * change from one invoice's Edit page to another's, and stale answers would then be applied
 * to a different bill. `EditFor` holds the code they were typed against, and every getter
 * ignores them when it does not match.
 *
 * ── ONE CALCULATION ──
 * `invoice` is a single call to `recalculateStoredInvoice` — the same Layer 2 function
 * `Edit/PageAction.js` submits through. The summary card is therefore not an approximation
 * of what will be written; it IS what will be written.
 */

const NODE = 'InvoiceEdit'

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function useInvoiceEditContext () {
  const resourceRecord = inject('resourceRecord', null)
  const resourceConfig = inject('resourceConfig', null)
  const pageState = inject('pageState', null)

  const nav = useResourceNav()
  const ui = useAQLConfig()
  const { _C } = useCurrencyResource()
  // The ONE naming rule for a SKU, owned by the SKUs domain — a code is never a name (§3.3).
  const { skuLabelOf } = useSkuResource()
  const { getPriceList, activePriceLists } = usePriceListResource()
  // The outlet-name map the Index and View pages already read, so all three name an outlet
  // the same way rather than each re-joining the Outlets resource (§6 — Enrich Once).
  const { outletNameByCode } = useInvoiceIndex()

  const record = computed(() => resourceRecord?.record?.value || null)
  const code = computed(() => text(record.value?.Code))

  const items = computed(() => editableInvoiceItems(record.value || {}))
  const defaults = computed(() => invoiceEditDefaults(record.value || {}))

  /** Answers typed against a DIFFERENT invoice are ignored — see the file header. */
  const ownsAnswers = () => text(pageState?.getControlField(NODE, 'EditFor')) === code.value

  const field = (header) => {
    if (!ownsAnswers()) return undefined
    return pageState?.getControlField(NODE, header)
  }

  const setField = (header, value) => {
    pageState?.setControlField(NODE, 'EditFor', code.value)
    pageState?.setControlField(NODE, header, value)
  }

  const dueDate = computed({
    get: () => text(field('DueDate')) || defaults.value.dueDate,
    set: (value) => setField('DueDate', text(value))
  })

  const discountType = computed({
    get: () => text(field('DiscountType')) || defaults.value.discountType,
    set: (value) => setField('DiscountType', text(value) || 'FLAT')
  })

  const discountValue = computed({
    get: () => {
      const typed = field('DiscountValue')
      return typed === undefined || typed === null || typed === '' ? defaults.value.discountValue : num(typed)
    },
    set: (value) => setField('DiscountValue', num(value))
  })

  /**
   * The price list this invoice bills on.
   *
   * EDITABLE, and it is the heaviest control on the page: the list decides the tax-inclusive
   * flag and the discount policy every stored figure was computed under, so switching it
   * re-derives the whole invoice — untouched lines re-price against the new list, and the
   * discount changes side relative to tax if the two lists disagree on policy. That is the
   * point of offering it, and it is why the summary card states the policy it used.
   */
  const priceListCode = computed({
    get: () => text(field('PriceListCode')) || defaults.value.priceListCode,
    set: (value) => setField('PriceListCode', text(value))
  })

  const priceListOptions = computed(() => (activePriceLists.value || [])
    .map((list) => ({ value: list.code, label: list.name || list.code })))

  /**
   * Per-SKU unit-price overrides, as `{ [SKU]: price }`.
   *
   * Keyed by SKU rather than by item code because `OutletConsumptionInvoiceItems` is unique
   * on invoice + SKU, so the two key the same set — and SKU is the key the calculation
   * engine's price resolver already speaks.
   */
  const priceOverrides = computed({
    get: () => {
      const value = field('PriceOverrides')
      return value && typeof value === 'object' ? value : {}
    },
    set: (value) => setField('PriceOverrides', value && typeof value === 'object' ? value : {})
  })

  const setLinePrice = (sku, value) => {
    const key = text(sku)
    if (!key) return
    priceOverrides.value = { ...priceOverrides.value, [key]: num(value) }
  }

  /** Drop one line's override, putting it back on the price the invoice was issued at. */
  const resetLinePrice = (sku) => {
    const key = text(sku)
    const { [key]: dropped, ...rest } = priceOverrides.value
    priceOverrides.value = rest
  }

  const outletName = computed(() => {
    const outlet = text(record.value?.OutletCode)
    return outletNameByCode.value.get(outlet) || outlet
  })

  const priceListName = computed(() => {
    const list = getPriceList(priceListCode.value)
    return text(list?.name || list?.Name) || priceListCode.value
  })

  /** Whether the user has moved the invoice off the list it was issued under. */
  const priceListSwitched = computed(() =>
    !!priceListCode.value && priceListCode.value !== defaults.value.priceListCode)

  /**
   * The override if the user typed one, else the chosen price list, else the price the line
   * was issued at. Layer 2 owns the precedence — see `makeStoredPriceResolver`.
   */
  const resolvePrice = computed(() => makeStoredPriceResolver(items.value, priceOverrides.value, {
    priceListCode: priceListCode.value,
    issuedPriceListCode: defaults.value.priceListCode
  }))

  /**
   * THE invoice, as the summary shows it and as `PageAction.js` submits it.
   *
   * The tax resolver is built from the SAME price resolver, so an overridden unit price is
   * taxed at the price actually being charged. Omitting it would bill every line untaxed —
   * the engine treats a missing calculator as "bill it untaxed" by design.
   */
  const invoice = computed(() => recalculateStoredInvoice({
    record: record.value || {},
    items: items.value,
    discountType: discountType.value,
    discountValue: discountValue.value,
    priceListCode: priceListCode.value,
    priceOverrides: priceOverrides.value,
    calculateLineTax: makeLineTaxResolver({
      priceListCode: priceListCode.value,
      resolvePrice: resolvePrice.value
    })
  }))

  const currencyCode = computed(() => invoiceCurrencyOf(priceListCode.value))
  const money = (value) => _C(num(value), true, currencyCode.value)

  /**
   * Fails CLOSED on a record that has not loaded: showing an editable form and discovering
   * otherwise at the sticky bar is the failure the lock banner exists to prevent. The
   * predicate is the domain's own `canEditInvoice` — the same one that gates the Edit FAB.
   */
  const locked = computed(() => !!record.value && !canEditInvoice(record.value))

  /**
   * The tax LEDGER rows this invoice already owns.
   *
   * Loaded here for one reason: `Edit/PageAction.js` has to hand them to Layer 2 so the old
   * rows are retired in the same batch that writes the new figures, and it reads them from the
   * CACHE. Nothing else on this page's route fetches `TaxTransactions`, so without this the
   * submit would see none and leave a superseded set behind, double-counting the invoice in
   * every tax return it appears in.
   *
   * `reload()` renders from whatever the store already holds and syncs in the background, so
   * it never blocks the form.
   */
  const taxLedger = useRecord('TaxTransactions')
  const loadSources = () => taxLedger.reload()

  return {
    pageState,
    loadSources,
    evaluate: (value) => evaluateProp(value, resourceRecord, resourceConfig),
    ui,
    money,
    skuLabelOf,
    record,
    code,
    items,
    invoice,
    locked,
    priceListCode,
    outletName,
    priceListName,
    priceListSwitched,

    dueDate,
    discountType,
    discountValue,
    priceListOptions,
    priceOverrides,
    setLinePrice,
    resetLinePrice,

    progressMeta: computed(() => progressMetaOf(record.value)),
    isPaid: computed(() => isPaid(record.value)),
    isCancelled: computed(() => isCancelled(record.value)),

    goToView: () => nav.goTo('view', { code: code.value })
  }
}
