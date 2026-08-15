import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'
import { useTaxCalculator } from 'src/composables/useTaxCalculator'
import { resourceGetRequest } from 'src/composables/resources/usePageState'
import { WIZARD_FIELDS as F, WIZARD_NODE as NODE } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionWizard'
import {
  validateConsumption,
  soldRowsOf,
  returnRowsOf,
  defaultReturnMeta,
  priceListForOutlet
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'
import { visitFrequencyFor } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionProgress'
import {
  buildConsumptionCompositeRequest,
  buildConsumptionMovementsRequest,
  buildReturnsRequests,
  buildReturnAdjustmentRequests,
  buildInvoiceRequests,
  buildVisitCompleteRequest,
  buildNextVisitRequest,
  buildRestockRequests
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionPayload'

/**
 * OutletConsumptions › Add › PageAction — JS modifier (tier 2: resource + page).
 *
 * Drives the six-step audit wizard entirely from the sticky bar, so the step cards stay
 * pure inputs with no navigation of their own — a card that navigated would double-fire
 * against the dispatcher and make a handler's veto unable to stop it (§13.6).
 *
 *   step 1  outlet, visit, restock source  →  [ Cancel ] [ Continue ]
 *   step 2  physical count                 →  [ Back   ] [ Continue ]
 *   step 3  sold review + invoice          →  [ Back   ] [ Continue ]
 *   step 4  restock + transfer             →  [ Back   ] [ Continue ]
 *   step 5  pending returns (SKIPPED when there are none)
 *                                          →  [ Back   ] [ Continue ]
 *   step 6  visit completion               →  [ Back   ] [ Record Audit ]
 *
 * `actions` is a GETTER, not a plain array. `useActionResolver` calls this factory once per
 * resolve and caches the result, but merges it into `finalProps` inside a `computed` — so a
 * getter is re-read on every recompute and its reads of `pageState.meta.currentStep` are
 * tracked. A literal array would latch the step-1 button set forever (§11 rule 4).
 *
 * ── STEP 5 SKIPPING ──
 * Both `next` and `back` step over step 5 when the outlet has no unsettled returns. It is
 * done here rather than by auto-advancing inside the card because navigation belongs to
 * the bar: a card that advanced itself would fight the Back button, landing the user on a
 * step that immediately bounced them forward again.
 *
 * ── THE SUBMIT ──
 * One batch, six resources, in dependency order. Everything after the composite save
 * chains its parent code off `$ref:OutletConsumptions.latest.code`, so nothing is split
 * into a second round trip that could fail after the first has already committed (§8.2).
 */
export default (props, { pageState, resourceConfig }) => {
  // Safe outside setup: both only reach Pinia stores and statically imported plugins —
  // neither calls `inject()`. `user` stays a computed, so reading it at submit time gives
  // the live session user rather than whoever was signed in at import.
  const { user } = useAuth()
  const dataStore = useDataStore()
  const { calculateLineTax } = useTaxCalculator()

  const node = pageState.useNode(NODE)
  const step = () => pageState.meta.currentStep
  const get = (field, fallback = null) => {
    const value = pageState.getControlField(NODE, field)
    return value === undefined || value === null ? fallback : value
  }
  const text = (value) => (value == null ? '' : String(value).trim())
  const actor = () => user.value?.name || user.value?.email || ''
  const form = () => node.record.value

  const countRows = () => get(F.COUNT_ROWS, []) || []
  const returnMeta = () => get(F.RETURN_META, {}) || {}
  const metaOf = (sku) => ({ ...defaultReturnMeta(), ...(returnMeta()[text(sku)] || {}) })
  const rows = (name) => dataStore.getRecords(name) || []

  const outletCode = () => text(form().OutletCode)

  /**
   * Drop restock lines the user zeroed out.
   *
   * Written here rather than in the card because the card must NOT remove them — see the
   * `next` handler. `_edited` is preserved on survivors so the sales mirror still leaves
   * hand-adjusted quantities alone.
   */
  function pruneZeroRestockRows () {
    const rowsNow = get(F.RESTOCK_ROWS, []) || []
    const kept = rowsNow.filter((row) => Number(row.Quantity) > 0)
    if (kept.length !== rowsNow.length) pageState.setControlField(NODE, F.RESTOCK_ROWS, kept)
  }
  const directRestock = () => get(F.DIRECT_RESTOCK, false) === true
  const generateInvoice = () => get(F.GENERATE_INVOICE, true) === true && soldRowsOf(countRows()).length > 0
  const priceListCode = () => text(get(F.PRICE_LIST)) || text(priceListForOutlet(outletCode())?.code)

  /** Unsettled returns raised on an EARLIER visit, which step 5 also offers to settle. */
  const hasPendingReturns = () => rows('OutletReturns').some((row) =>
    text(row?.OutletCode) === outletCode() &&
    text(row?.Status || 'Active') === 'Active' &&
    text(row?.InvoiceAdjustmentRequired) === 'TRUE' &&
    text(row?.InvoiceAdjustmentDone) !== 'TRUE')

  /**
   * Which steps have anything to ask, given what the count actually found.
   *
   * A step is SKIPPED when its question has no subject — not merely when it would render
   * empty. Two of the six qualify:
   *
   *   step 3  sold review + invoicing  — nothing sold, so there is nothing to price and no
   *                                      invoice to configure. A damage-only visit goes
   *                                      straight from the count to the restock.
   *   step 5  returns                  — no surplus counted and no unsettled return from an
   *                                      earlier visit, so there is no routing to decide.
   *
   * Expressed as one predicate per step and walked by `nextStep`/`prevStep` below, rather
   * than as a pair of hardcoded jumps. The previous form special-cased 4→6 in `next` and
   * 6→4 in `back`; adding a second skippable step to that shape would have produced four
   * more branches, and any two of them could disagree about where the user lands.
   */
  const STEP_VISIBLE = {
    1: () => true,
    2: () => true,
    3: () => soldRowsOf(countRows()).length > 0,
    4: () => true,
    5: () => returnRowsOf(countRows()).length > 0 || hasPendingReturns(),
    6: () => true
  }

  const FIRST_STEP = 1
  const LAST_STEP = 6

  /** The next step at or after `from` that has something to ask; `null` past the end. */
  function nextStep (from) {
    for (let step = from + 1; step <= LAST_STEP; step++) {
      if (STEP_VISIBLE[step]?.() !== false) return step
    }
    return null
  }

  /** The previous visible step; `null` before the beginning. */
  function prevStep (from) {
    for (let step = from - 1; step >= FIRST_STEP; step--) {
      if (STEP_VISIBLE[step]?.() !== false) return step
    }
    return null
  }

  /** The full validation gate, shared by the step-2 `next` and by `submit`. */
  const validate = () => validateConsumption(form(), countRows(), rows('OutletStorages'), {
    generateInvoice: generateInvoice(),
    priceListCode: priceListCode(),
    directRestock: directRestock(),
    warehouseCode: text(get(F.WAREHOUSE)),
    returnMetaOf: metaOf
  })

  return {
    get actions () {
      if (step() === 1) return ['cancel', 'next']
      // Keyed on whether a NEXT step exists rather than on the literal step number: with
      // step 5 skipped, step 4 is the last screen before submit and must show the submit
      // button, not a Continue that leads nowhere.
      if (nextStep(step()) === null) return ['back', 'submit']
      return ['back', 'next']
    },

    // Static: this page has exactly one possible outcome, so the label states the
    // transition it performs rather than tracking any state (§13.6).
    submitLabel: 'Record Consumption',

    // Leaving abandons an unsaved audit, so go to the list rather than `goBack()` — the
    // user may have arrived from an outlet page. Returning `false` stops the built-in
    // `goBack()` from popping a second history entry on top of it (§8.2).
    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    // Two phases, and the order is the whole contract: VALIDATE the step being left, then
    // WALK to the next step that has something to ask.
    //
    // They were previously interleaved — each step's validation branch ended in its own
    // `return`, so the walk below was unreachable from steps 1 and 2 and the step-3 bypass
    // silently never fired for the case it exists for (a damage-only visit leaving step 2).
    // Validation now only returns EARLY when it actually vetoes; the walk is the single
    // exit every non-vetoed transition takes.
    next: () => {
      if (step() === 1) {
        if (!outletCode()) return { valid: false, message: 'Select an outlet to continue.' }
        if (directRestock() && !text(get(F.WAREHOUSE))) {
          return { valid: false, message: 'Select a source warehouse to continue.' }
        }
      }
      if (step() === 2) {
        const result = validate()
        // Only the count itself is gated here. Pricing and warehouse errors belong to the
        // steps that collect them, so a missing price does not block a user who has not
        // reached the invoice step yet.
        const countErrors = result.errors.filter((error) => !/price|warehouse/i.test(error))
        if (countErrors.length) return { valid: false, message: countErrors[0] }
      }
      // Leaving step 4 prunes any line the user zeroed out. Done on the TRANSITION, not on
      // the keystroke that reached zero: pruning live would unmount the row under the
      // user's finger the moment they tapped one decrement too many, with no way back to
      // it except the expansion. Holding it at zero until they move on makes that
      // recoverable, and a zero line was never going to be submitted anyway.
      if (step() === 4) pruneZeroRestockRows()

      // Walk to the next step that has something to ask. Returning `false` suppresses the
      // built-in single-step increment, which this jump has already performed.
      const target = nextStep(step())
      if (target !== null && target !== step() + 1) {
        pageState.meta.currentStep = target
        return false
      }
    },

    back: () => {
      const target = prevStep(step())
      if (target !== null && target !== step() - 1) {
        pageState.meta.currentStep = target
        return false
      }
    },

    submit: () => {
      const result = validate()
      if (!result.valid) return { valid: false, message: result.errors[0] }

      const invoicing = generateInvoice()
      const restockRows = (get(F.RESTOCK_ROWS, []) || []).filter((row) => Number(row.Quantity) > 0)
      const adjustedCodes = get(F.ADJUSTED_RETURNS, []) || []
      const completingVisit = get(F.COMPLETE_VISIT, true) === true && !!text(form().OutletVisitCode)
      const schedulingNext = get(F.SCHEDULE_NEXT, true) === true

      /**
       * NAME EVERY RESOURCE THE BATCH WRITES, not just the parent (§8.4). The map is a
       * function of what the user actually chose, so a plain stock count is not blocked by
       * an invoice permission it never needed — and a direct restock cannot proceed
       * without the warehouse-movement permission it genuinely requires.
       *
       * Action names are lower-camel: `allowed()` upper-cases only the first character, so
       * an all-caps name resolves to a key that can never match and fails closed silently.
       */
      const permissions = { OutletConsumptions: 'create', OutletConsumptionItems: 'create', OutletMovements: 'create' }
      if (returnRowsOf(countRows()).length) permissions.OutletReturns = 'create'
      if (adjustedCodes.length) permissions.OutletReturns = 'update'
      if (invoicing) {
        permissions.OutletConsumptionInvoices = 'create'
        permissions.OutletConsumptionInvoiceItems = 'create'
      }
      if (completingVisit || schedulingNext) permissions.OutletVisits = completingVisit ? 'update' : 'create'
      if (restockRows.length) {
        permissions.OutletRestocks = 'create'
        permissions.OutletRestockItems = 'create'
        if (directRestock()) permissions.StockMovements = 'create'
      }
      if (resourceConfig?.allowed(permissions) !== true) {
        return { valid: false, message: 'You do not have permission to complete this consumption workflow.' }
      }

      const requests = []

      // 1. Returns FIRST — the invoice below needs their codes to record what it credited.
      requests.push(...buildReturnsRequests(form(), countRows(), metaOf, { priceListCode: priceListCode() }))

      // 2. The consumption and its sold lines. Everything after this chains off its $ref.
      requests.push(buildConsumptionCompositeRequest(form(), countRows(), actor(), { generateInvoice: invoicing }))

      // 3. The outlet ledger deduction.
      requests.push(buildConsumptionMovementsRequest(form(), countRows()))

      // 4. The invoice, bundling any earlier uninvoiced audits the user ticked. Its lines
      //    are the union of this audit's sales and every bundled audit's, merged here
      //    because the builder prices what it is given and does not decide what belongs on
      //    the bill.
      if (invoicing) {
        const bundled = get(F.BUNDLED, []) || []
        const bundledLines = bundled.flatMap((code) => rows('OutletConsumptionItems')
          .filter((row) => text(row?.OutletConsumptionCode) === text(code) && text(row?.Status || 'Active') === 'Active')
          .map((row) => ({ SKU: row.SKU, SoldQty: row.Qty })))

        const invoice = buildInvoiceRequests(form(), [...soldRowsOf(countRows()), ...bundledLines], {
          priceListCode: priceListCode(),
          bundledConsumptionCodes: bundled,
          returnDeduction: returnDeductionOf(adjustedCodes),
          discountType: text(get(F.DISCOUNT_TYPE)) || 'FLAT',
          discountValue: Number(get(F.DISCOUNT_VALUE, 0)) || 0,
          invoiceComment: text(get(F.INVOICE_COMMENT)),
          returnCodes: adjustedCodes,
          actorName: actor(),
          calculateLineTax
        })
        requests.push(...invoice.requests)

        // 5. Settle the returns that were credited against it.
        if (adjustedCodes.length) {
          const selected = rows('OutletReturns').filter((row) => adjustedCodes.includes(text(row?.Code)))
          requests.push(...buildReturnAdjustmentRequests(selected))
        }
      }

      // 6. Close the visit this audit was made against, and plan the next one.
      if (completingVisit) {
        const request = buildVisitCompleteRequest(form().OutletVisitCode, actor())
        if (request) requests.push(request)
      }
      if (schedulingNext) {
        const frequency = visitFrequencyFor(outletCode(), rows('OutletOperatingRules'))
        const request = buildNextVisitRequest(form(), frequency, actor())
        // `null` when no cadence is configured anywhere — no visit is planned rather than
        // one planned on a guessed frequency.
        if (request) requests.push(request)
      }

      // 7. Replenishment, in whichever mode step 1 and step 4 selected.
      if (restockRows.length) {
        const restock = buildRestockRequests(form(), restockRows, {
          mode: directRestock() ? 'APPROVED' : 'PENDING_APPROVAL',
          warehouseCode: text(get(F.WAREHOUSE)),
          warehouseStorages: rows('WarehouseStorages'),
          markDelivered: get(F.MARK_DELIVERED, false) === true,
          actorName: actor()
        })
        requests.push(...restock.requests)
      }

      // The batch just changed balances three other resources derive from. Pull them back
      // in the same round trip rather than leaving the next page to find them stale (§8.2).
      requests.push(resourceGetRequest(['OutletStorages', 'WarehouseStorages', 'OutletVisits']))

      return { requests, successMsg: 'Consumption recorded.' }
    }
  }

  /** The monetary credit the ticked returns apply — read off the stored rows, not recomputed. */
  function returnDeductionOf (codes) {
    if (!codes?.length) return 0
    return rows('OutletReturns')
      .filter((row) => codes.includes(text(row?.Code)))
      .reduce((sum, row) => sum + (Number(row?.Qty) || 0) * (Number(row?.Price) || 0), 0)
  }
}
