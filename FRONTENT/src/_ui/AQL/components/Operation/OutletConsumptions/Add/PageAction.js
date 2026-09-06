import { batchResultCode } from 'src/composables/resources/resourceRequests'
import { NODE, INVOICING, RESTOCKING } from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Add/nodes'
import {
  CHAIN_SUCCESS,
  CHAIN_OUTCOME,
  validateConsumptionDraft,
  settleConsumptionCount,
  settleConsumptionRestock,
  seedConsumptionInvoice,
  dropInvoiceNodes,
  hasPendingConsumptionReturns,
  consumptionInvoicingAllowed,
  consumptionRestockingAllowed,
  consumptionSoldItems,
  consumptionReturnItems
} from 'src/_resource/Operation/OutletConsumptions/composables/useConsumptionDraft'

// The sticky bar for the six-step wizard. It owns step order and nothing else: the nodes
// are the answers, the domain keeps them true, and submit only validates.
export default (props, { pageState }) => {
  const step = () => pageState.meta.currentStep
  const text = (value) => (value == null ? '' : String(value).trim())

  const outletCode = () => text(pageState.getRecord('OutletCode', NODE.CONSUMPTION))
  const soldItems = () => consumptionSoldItems(pageState)
  const returnItems = () => consumptionReturnItems(pageState)

  // A step is skipped when its question has no subject.
  const STEP_VISIBLE = {
    1: () => true,
    2: () => true,
    3: () => consumptionInvoicingAllowed() && soldItems().length > 0,
    // Permission only, never the toggle or the lines: turning restock off drops the node,
    // and a line count read off it then locked the step the user turns it back on in.
    4: () => consumptionRestockingAllowed(),
    5: () => returnItems().length > 0 || hasPendingConsumptionReturns(outletCode()),
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

  // Where the finished batch lands. Read at submit, because the reset that follows a
  // successful send clears the nodes this is derived from.
  let landing = { outcome: null, at: -1 }

  function advance () {
    if (step() === 1) {
      if (!outletCode()) return { valid: false, message: 'Select an outlet to continue.' }
    }

    if (step() === 2) {
      const { sold, restocks } = settleConsumptionCount(pageState)

      // A consumption IS the sale. Returns or restocks alone are not one, so they cannot
      // carry the wizard past this step on their own.
      if (!sold.length) {
        return {
          valid: false,
          message: 'No any items sold to proceed ..'
        }
      }

      if (restocks.length && consumptionRestockingAllowed()) {
        pageState.setControls(RESTOCKING, true)
      }

      if (sold.length && consumptionInvoicingAllowed()) {
        seedConsumptionInvoice(pageState, sold)
        pageState.setControls(INVOICING, true)
        return { step: 3 }
      }
      dropInvoiceNodes(pageState)
      // Asked for, never set here: PageAction moves the step behind its own fade, so a
      // skip looks the same as a plain Continue instead of swapping the bar mid-fade.
      return { step: nextStep(2) ?? LAST_STEP }
    }

    // Leaving step 3 settles the invoice: the toggle is the answer, so a node the
    // officer turned off must not travel on into the rest of the wizard.
    if (step() === 3 && pageState.getControls(INVOICING, true) !== true) {
      dropInvoiceNodes(pageState)
    }

    if (step() === 4) settleConsumptionRestock(pageState)

    const target = nextStep(step())
    return target !== null && target !== step() + 1 ? { step: target } : undefined
  }

  return {
    get actions () {
      if (step() === 1) return ['cancel', 'next']
      // Keyed on whether a NEXT step exists: with step 5 skipped, step 4 is the last screen.
      if (nextStep(step()) === null) return ['back', 'submit']
      return ['back', 'next']
    },

    submitLabel: 'Record Consumption',

    // Leaving abandons an unsaved audit, so go to the list rather than `goBack()`.
    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    next: () => {
      try {
        return advance()
      } catch (error) {
        console.error('[OutletConsumptions/Add] step move failed', error)
        return { valid: false, message: `Could not continue: ${error?.message || error}` }
      }
    },

    back: () => {
      const target = prevStep(step())
      return target !== null && target !== step() - 1 ? { step: target } : undefined
    },

    // Validation only: pageState already holds exactly what will be sent.
    //
    // The whole body is guarded. The dispatcher sets `meta.submitting` BEFORE calling this
    // and only clears it in a `finally` AFTER, so a throw here leaves the button disabled
    // for the rest of the page's life with nothing on screen to say why.
    submit: () => {
      try {
        const problem = validateConsumptionDraft(pageState)
        if (problem) return { valid: false, message: problem }

        const outcome = pageState.getControls(CHAIN_OUTCOME) || null
        // Resolved after hydration: only build() knows where the resource lands in the batch.
        landing = {
          outcome,
          at: outcome?.resource
            ? pageState.build().findIndex((request) => request.resource === outcome.resource)
            : -1
        }

        return { successMsg: pageState.getControls(CHAIN_SUCCESS) || 'Consumption recorded.' }
      } catch (error) {
        console.error('[OutletConsumptions/Add] submit failed', error)
        return { valid: false, message: `Could not submit: ${error?.message || error}` }
      }
    },

    // Runs AFTER the pipeline's own reset, so the wizard is cleared for us.
    onSubmitSuccess: ({ response }, { nav }) => {
      const { outcome, at } = landing
      const code = at >= 0 ? text(batchResultCode(response, at)) : ''
      // A bulk create may report no single code. The index is the honest fallback.
      if (!code) return nav.goTo('index')
      if (!outcome?.slug) return nav.goTo('view', { code })
      nav.goTo('view', { scope: 'operation', resourceSlug: outcome.slug, code })
    }
  }
}
