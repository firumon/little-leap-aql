import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'
import { makeLineTaxResolver } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionInvoice'
import { batchResultCode } from 'src/composables/resources/usePageState'
import { WIZARD_FIELDS as F, WIZARD_NODE as NODE } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/useConsumptionWizard'
import {
  validateConsumption,
  soldRowsOf,
  returnRowsOf,
  restockRowsOf,
  defaultReturnMeta,
  priceListForOutlet,
  priceOf
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionStock'
import { buildConsumptionWorkflowChainRequests } from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionWorkflow'

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
 * NOT ASSEMBLED HERE. One batch across up to six resources — two of them owned by other
 * domains — is a multi-resource mutation chain, and Layer 2 is its sole owner
 * (UI_RESOURCE_DOMAIN_LOGIC.md §9.1). `submit` below collects the wizard's answers, calls
 * `buildConsumptionWorkflowChainRequests`, gates on the permissions it returns, and hands
 * its requests straight to the dispatcher. No table schema, no default column value, no
 * `$ref`, and no permission derivation is written in this file.
 *
 * What DOES stay here is navigation and step visibility — which screen the user is on and
 * which button set the bar shows. That is presentation, and it is all this file decides.
 */
export default (props, { pageState, resourceConfig }) => {
  // Safe outside setup: both only reach Pinia stores and statically imported plugins —
  // neither calls `inject()`. `user` stays a computed, so reading it at submit time gives
  // the live session user rather than whoever was signed in at import.
  const { user } = useAuth()
  const dataStore = useDataStore()

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
  /**
   * Whether this visit leaves a restock at all — the step-4 switch.
   *
   * Read here as well as in the card, and everything restock-shaped below goes through it:
   * a user who turns the restock off after filling lines must not have those lines
   * submitted because they are still sitting in the control field. Defaults to TRUE, which
   * is the behaviour every existing flow had before the switch existed.
   */
  const enableRestock = () => get(F.ENABLE_RESTOCK, true) !== false
  const directRestock = () => enableRestock() && get(F.DIRECT_RESTOCK, false) === true
  const generateInvoice = () => get(F.GENERATE_INVOICE, true) === true && soldRowsOf(countRows()).length > 0
  const priceListCode = () => text(get(F.PRICE_LIST)) || text(priceListForOutlet(outletCode())?.code)

  /**
   * The engine's price resolver: an override the officer typed on step 3, else the price
   * list's own answer. Mirrors `useConsumptionWizard.resolvePrice` — same control field,
   * same fallback — so what was confirmed on screen is what is billed.
   */
  const resolvePrice = (sku, listCode) => {
    const overrides = get(F.PRICE_OVERRIDES, {}) || {}
    const override = overrides[text(sku)]
    return override === undefined || override === null || override === ''
      ? priceOf(sku, listCode)
      : Number(override) || 0
  }

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

  /** The restock lines that will actually be requested, zeroes already dropped. */
  const liveRestockRows = () => (enableRestock() ? restockRowsOf(get(F.RESTOCK_ROWS, []) || []) : [])

  /**
   * The full validation gate, shared by the step-2 `next` and by `submit`.
   *
   * `submitting` is what separates the two. The "at least one sold item, return item, or
   * restock item" rule can only be judged once every step has been through, so it is armed
   * at submit and silent during navigation — otherwise step 2 would refuse to advance a
   * restock-only audit toward the very step that gives it its restock lines.
   */
  const validate = (options = {}) => validateConsumption(form(), countRows(), rows('OutletStorages'), {
    generateInvoice: generateInvoice(),
    priceListCode: priceListCode(),
    directRestock: directRestock(),
    warehouseCode: text(get(F.WAREHOUSE)),
    returnMetaOf: metaOf,
    restockRows: liveRestockRows(),
    submitting: options.submitting === true
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
      }
      if (step() === 2) {
        const result = validate()
        // Only the count itself is gated here. Pricing and warehouse errors belong to the
        // steps that collect them, so a missing price does not block a user who has not
        // reached the invoice step yet.
        //
        // A count with NOTHING on it is deliberately not gated either. Every shelf matching
        // the system is a legitimate audit outcome, and the officer may still be here to
        // leave a restock behind — `STEP_VISIBLE[3]` is false with no sales, so this walks
        // straight to step 4, where the restock is either added or the guard below stops it.
        const countErrors = result.errors.filter((error) => !/price|warehouse/i.test(error))
        if (countErrors.length) return { valid: false, message: countErrors[0] }
      }
      // Leaving step 4 prunes any line the user zeroed out. Done on the TRANSITION, not on
      // the keystroke that reached zero: pruning live would unmount the row under the
      // user's finger the moment they tapped one decrement too many, with no way back to
      // it except the expansion. Holding it at zero until they move on makes that
      // recoverable, and a zero line was never going to be submitted anyway.
      if (step() === 4) {
        pruneZeroRestockRows()

        // The source warehouse is asked for HERE now, on the step that offers the DIRECT
        // choice. It used to be gated on step 1, which asked the question before the user
        // had decided whether there would be a restock at all.
        if (directRestock() && !text(get(F.WAREHOUSE))) {
          return { valid: false, message: 'Select a source warehouse to continue.' }
        }

        // THE ONE PLACE a restock-only audit can be stopped. Steps 5 and 6 ask about
        // returns and the visit, neither of which is an operational effect on its own, so
        // by the time the user reaches the submit button every remaining screen is optional
        // — an audit that recorded nothing must be caught here, on the step that offered
        // the last chance to give it something to do.
        //
        // Stated as what to do next rather than as what went wrong: both remedies are named,
        // because the user standing in the outlet knows which of the two actually happened.
        if (!soldRowsOf(countRows()).length && !returnRowsOf(countRows()).length && !liveRestockRows().length) {
          return {
            valid: false,
            message: 'Add at least one restock item to continue, or record a sold/return quantity in stock count.'
          }
        }
      }

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

    /**
     * A THIN ADAPTER, nothing more (UI_RESOURCE_DOMAIN_LOGIC.md §9.1).
     *
     * Everything this handler does is collect the wizard's answers and the rows the
     * domain needs to reason about, hand them to ONE Layer 2 chain builder, gate the
     * whole chain on the permissions that builder returns, and forward its requests.
     *
     * The batch's shape, its order, which resources it writes, what the user is told and
     * where they land are all decided in
     * `useConsumptionWorkflow.buildConsumptionWorkflowChainRequests` — including the visit
     * and restock legs, which it delegates to those resources' OWN domain builders rather
     * than restating their schemas here.
     */
    submit: (name, { nav }) => {
      const result = buildConsumptionWorkflowChainRequests({
        form: form(),
        countRows: countRows(),
        actorName: actor(),
        outletStorages: rows('OutletStorages'),
        warehouseStorages: rows('WarehouseStorages'),
        operatingRules: rows('OutletOperatingRules'),
        returnMetaOf: metaOf,
        returnRows: rows('OutletReturns'),
        adjustedReturnCodes: get(F.ADJUSTED_RETURNS, []) || [],
        generateInvoice: generateInvoice(),
        priceListCode: priceListCode(),
        discountType: text(get(F.DISCOUNT_TYPE)),
        discountValue: get(F.DISCOUNT_VALUE, 0),
        invoiceComment: text(get(F.INVOICE_COMMENT)),
        // Same resolver the review step uses, built from the same resolvePrice below.
        calculateLineTax: makeLineTaxResolver({ priceListCode: priceListCode(), resolvePrice }),
        // The unit prices the officer typed on step 3, as a resolver — so the batch prices
        // every line exactly as the review step displayed it. Read straight off the control
        // field, because this handler runs outside any setup context and cannot call the
        // wizard composable that owns the same accessor.
        resolvePrice,
        restockRows: liveRestockRows(),
        directRestock: directRestock(),
        warehouseCode: directRestock() ? text(get(F.WAREHOUSE)) : '',
        markDelivered: enableRestock() && get(F.MARK_DELIVERED, false) === true,
        completeVisit: get(F.COMPLETE_VISIT, true) === true,
        scheduleNext: get(F.SCHEDULE_NEXT, true) === true,
        // The cadence the officer confirmed on step 6, in days. `null` leaves the outlet's
        // configured frequency in charge.
        nextVisitDays: (() => {
          const stored = get(F.NEXT_VISIT_DAYS, null)
          return stored === null || stored === undefined || stored === '' ? null : Number(stored) || 0
        })()
      })

      if (!result.valid) return { valid: false, message: result.message }
      if (resourceConfig?.allowed(result.permissions) !== true) {
        const gaps = resourceConfig?.missing?.(result.permissions) || []
        const detail = gaps.map(({ resource, action }) => `${resource} (${action})`).join(', ')
        return {
          valid: false,
          message: 'You do not have permission to complete this consumption workflow.' +
            (detail ? ` Missing: ${detail}` : '')
        }
      }

      const outcome = result.outcome
      return {
        requests: result.requests,
        successMsg: result.successMsg,
        onSuccess: ({ response }) => {
          // The default handler resets for us; supplying our own replaces it, so the
          // wizard state has to be cleared here or the next audit opens on the last
          // one's answers.
          pageState.reset()
          const code = outcome.at >= 0 ? text(batchResultCode(response, outcome.at)) : ''
          // A bulk create does not always report a single code. Landing on the resource's
          // index is the honest fallback — better than a View route built on a blank code.
          if (!code) return nav.goTo('index')
          if (!outcome.slug) return nav.goTo('view', { code })
          nav.goTo('view', { scope: 'operation', resourceSlug: outcome.slug, code })
        }
      }
    }
  }
}
