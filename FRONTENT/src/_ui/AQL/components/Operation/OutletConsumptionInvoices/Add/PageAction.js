import { useAuth } from 'src/composables/core/useAuth'
import { buildInvoiceGenerationRequests } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'
import {
  resolvePriceListCode,
  invoiceDueDaysFor,
  dueDateFrom,
  makeLineTaxResolver
} from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceCalculation'
import { useInvoiceIndex } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceIndex'
import { priceOf } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'

/**
 * OutletConsumptionInvoices › Add › PageAction — JS modifier (tier CP: resource + page).
 *
 * Drives the 3-step invoice generator from the sticky form-actions bar, so the step cards
 * stay pure inputs with no navigation of their own:
 *
 *   step 1  outlet + counts   →  [ Cancel ] [ Continue ]
 *   step 2  lines + prices    →  [ Back   ] [ Continue ]
 *   step 3  terms + review    →  [ Back   ] [ Generate Invoice ]
 *
 * `actions` is a GETTER, not a plain array: `useActionResolver` calls this factory once per
 * resolve and caches the result, but merges it into `finalProps` inside a `computed` — so a
 * getter is re-read on every recompute and its reads of `pageState.meta.currentStep` are
 * tracked. A literal array would latch the step-1 button set forever (UI_ACTION_SYSTEM.md §1.3).
 *
 * Only `next` is intercepted; `back` is left to the dispatcher's built-in decrement. `next`
 * vetoes by returning `{ valid: false, message }` and on success returns nothing, so the
 * built-in increment performs the move (§4).
 *
 * ── A THIN ADAPTER, NOTHING MORE (UI_RESOURCE_DOMAIN_LOGIC.md §9.1) ──
 * `submit` collects the wizard's answers and hands them to `buildInvoiceGenerationRequests`.
 * It performs NO arithmetic and builds NO rows: which columns the header carries, how the
 * lines are priced and taxed, which consumptions get walked to `INVOICE_GENERATED` and which
 * returns get marked adjusted are all decided in Layer 2 — identically whether an invoice is
 * raised here or chained off a consumption submit (Zero UI Schema Invention).
 *
 * It re-reads the control fields rather than importing the page context, because a
 * `PageAction.js` runs OUTSIDE any component `setup()` and cannot call the `inject()` the
 * context composable owns. It receives `pageState` as a parameter instead, which is the
 * documented exemption (§6).
 */

const NODE = 'OutletConsumptionInvoices'

const text = (value) => (value == null ? '' : String(value).trim())
const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const asArray = (value) => (Array.isArray(value) ? value : [])

export default (props, { pageState, resourceConfig }) => {
  // Safe outside setup: `useAuth` only reaches Pinia stores and calls no `inject()`. `user`
  // stays a computed, so reading it at submit time gives the live session user.
  const { user } = useAuth()

  /**
   * Register the page's form node.
   *
   * This wizard writes no record through `pageState` — every answer is a CONTROL FIELD and
   * the requests are built in Layer 2 — but the node still has to EXIST, because the sticky
   * form-actions bar mounts against the page's node and renders nothing without one. Calling
   * `useNode` is what creates it; the returned handle is deliberately unused.
   */
  pageState.useNode(NODE)

  const field = (header, fallback = '') => {
    const value = pageState.getControlField(NODE, header)
    return value === undefined || value === null ? fallback : value
  }

  // Defaulted to 1, never read bare. Before the first step move `currentStep` may not be set,
  // and an undefined step falls past the step-1 branch below into the item check — which
  // vetoes `next` on a wizard that has not asked for items yet, stranding the user on step 1.
  const step = () => pageState.meta?.currentStep || 1
  const outlet = () => text(field('OutletCode'))
  const selectedCodes = () => asArray(field('ConsumptionCodes', [])).map(text).filter(Boolean)
  const extras = () => asArray(field('ExtraItems', []))
  const overrides = () => {
    const value = field('PriceOverrides', {})
    return value && typeof value === 'object' ? value : {}
  }

  /**
   * The billable lines, rebuilt from the same answers the step cards derived them from.
   *
   * This is the one piece of shaping the adapter does, and it is unavoidable: the lines live
   * only as a `computed()` inside the page context, which this module cannot reach. The
   * GROUPING RULE is the same one the context applies — one row per SKU, quantities summed
   * across every ticked count — so the bill submitted is the bill reviewed.
   */
  function billableLines () {
    const { pendingInvoiceGeneration, itemsOfConsumption } = useInvoiceIndex()
    const chosen = new Set(selectedCodes())
    const bySku = new Map()

    pendingInvoiceGeneration.value
      .filter((row) => chosen.has(text(row.Code)))
      .forEach((row) => {
        // The aggregate's indexed join, not `row.$OutletConsumptionItems`: list records carry
        // no nested children, so that accessor would submit an empty bill.
        asArray(itemsOfConsumption(row.Code))
          .filter((item) => text(item?.Status || 'Active').toUpperCase() === 'ACTIVE')
          .forEach((item) => {
            const sku = text(item.SKU)
            if (!sku) return
            bySku.set(sku, (bySku.get(sku) || 0) + num(item.Qty))
          })
      })

    extras().forEach((extra) => {
      const sku = text(extra.SKU)
      if (!sku) return
      bySku.set(sku, (bySku.get(sku) || 0) + num(extra.Qty))
    })

    return [...bySku.entries()]
      .filter(([, qty]) => qty > 0)
      .map(([SKU, Qty]) => ({ SKU, Qty }))
  }

  /**
   * The returns this invoice actually credits.
   *
   * OPT-IN and per-return: nothing is credited unless the user turned return credits on, and
   * then only the ones they ticked. Crediting is not just a deduction — it also marks the
   * return adjusted — so an unticked return must be left completely untouched.
   *
   * The qualifying rule (adjustment required, not done, not cancelled) still lives in
   * Layer 2; this only intersects it with the selection.
   */
  function creditedReturns (outletCode) {
    if (field('ApplyReturns', false) !== true) return []
    const chosen = new Set(asArray(field('ReturnCodes', [])).map(text).filter(Boolean))
    if (!chosen.size) return []
    const { returnsAwaitingAdjustment } = useInvoiceIndex()
    return returnsAwaitingAdjustment.value
      .filter((row) => text(row.OutletCode) === outletCode && chosen.has(text(row.Code)))
  }

  /** The user's price overrides, else the price list — the same resolver step 2 previewed. */
  function resolvePrice (sku, listCode) {
    const override = overrides()[text(sku)]
    if (override !== undefined && override !== null && override !== '') return num(override)
    return priceOf(sku, listCode)
  }

  return {
    get actions () {
      if (step() === 2) return ['back', 'next']
      if (step() === 3) return ['back', 'submit']
      return ['cancel', 'next']
    },

    submitLabel: 'Generate Invoice',

    // Leaving the wizard abandons an unsaved invoice, so go to the list rather than
    // `goBack()` — the user may have arrived from an Invoiceable Outlets row. Returning
    // false stops the built-in goBack() popping a second history entry.
    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    next: () => {
      if (step() === 1) {
        if (!outlet()) return { valid: false, message: 'Select an outlet to continue.' }
        return
      }
      if (!billableLines().length) {
        return { valid: false, message: 'Add at least one item with a quantity before continuing.' }
      }
      return undefined
    },

    submit: () => {
      const { operatingRules } = useInvoiceIndex()
      const outletCode = outlet()
      const rules = operatingRules.value
      const priceListCode = text(field('PriceListCode')) || resolvePriceListCode(outletCode, rules)
      const today = new Date().toISOString().slice(0, 10)

      const result = buildInvoiceGenerationRequests({
        outletCode,
        username: user.value?.name || user.value?.email || '',
        actorName: user.value?.name || user.value?.email || '',
        date: today,
        dueDate: text(field('DueDate')) || dueDateFrom(today, invoiceDueDaysFor(outletCode, rules)),
        priceListCode,
        lines: billableLines(),
        consumptionCodes: selectedCodes(),
        returnRows: creditedReturns(outletCode),
        discountType: text(field('DiscountType')) || 'FLAT',
        discountValue: num(field('DiscountValue', 0)),
        comment: text(field('Comment')),
        resolvePrice,
        // The SAME resolver the review step displayed, built from the same price resolver —
        // so the tax the user agreed to and the tax the sheet stores are one calculation, not
        // two that happen to agree.
        calculateLineTax: makeLineTaxResolver({ priceListCode, resolvePrice })
      })

      if (!result.valid) return { valid: false, message: result.message }
      if (resourceConfig?.allowed(result.permissions) !== true) {
        return { valid: false, message: 'You are not allowed to generate this invoice.' }
      }

      return { requests: result.requests, successMsg: result.successMsg }
    }
  }
}

