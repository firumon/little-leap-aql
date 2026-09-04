import {
  RESTOCK_CONTROL,
  restockRoutingOf,
  restockSubmissionNodes
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'

const RESOURCE = 'OutletRestocks'

/**
 * OutletRestocks › Add › PageAction — JS modifier (tier 2: resource + page).
 *
 * Drives the 3-step wizard from the sticky bar, so the step cards stay pure inputs:
 *
 *   step 1  outlet + routing  →  [ Cancel ] [ Continue ]
 *   step 2  item lines        →  [ Back   ] [ Continue ]
 *   step 3  review + comment  →  [ Back   ] [ Submit Request ]
 *
 * `actions` is a GETTER, not an array. `useActionResolver` caches this factory's result
 * but merges it inside a `computed`, so a getter is re-read on every recompute and its
 * reads of `currentStep` are tracked; a literal array would latch step 1's buttons
 * forever (UI_ACTION_SYSTEM.md §1.3).
 *
 * Only `next` is intercepted — `back` uses the dispatcher's built-in decrement. `next`
 * returns `{ valid: false, message }` to veto and nothing to allow the move.
 *
 * The routing answers are read back through `restockRoutingOf`, the same Layer 2 reader
 * that names the controls in the first place, so this file never spells a control header.
 *
 * `submit` hands Layer 2 the LIVE pageState, not a re-collected copy of the form. The node
 * has been complete since `ready` and the derive rules have kept it and both ledger legs in
 * step with every edit, so submit only has to say what it alone decides: draft or not, and
 * the note. Re-collecting the header and the lines here would compute a second answer to a
 * question already answered (UI_PAGE_STATE.md 12.2).
 */
export default (props, { pageState }) => {
  const parent = pageState.useNode(RESOURCE)
  const itemEntries = parent.children('OutletRestockItems')

  const step = () => pageState.meta.currentStep
  const routing = () => restockRoutingOf(pageState)
  // Wizard-only intent set by `SubmitOptions.vue`; a direct restock allocates now, so it
  // is never a draft.
  const isDraft = () => pageState.getControls('isDraft', null, RESOURCE) === true &&
    routing()[RESTOCK_CONTROL.DIRECT] !== true
  const items = () => itemEntries.value.filter((entry) => entry._action !== 'deactivate')

  function validateItems () {
    const lines = items()
    if (!lines.length || lines.some((entry) => Number(entry.Quantity) <= 0)) {
      return { valid: false, message: 'Add at least one item with a quantity greater than zero.' }
    }
    return null
  }

  return {
    get actions () {
      if (step() === 2) return ['back', 'next']
      if (step() === 3) return ['back', 'submit']
      return ['cancel', 'next']
    },

    get submitLabel () { return isDraft() ? 'Save Draft' : 'Submit Request' },

    // Leaving the wizard abandons an unsaved request, so go to the list rather than
    // `goBack()` — the user may have arrived from an outlet page. Returning false stops
    // the built-in goBack() from popping a second history entry.
    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    next: () => {
      if (step() === 1) {
        const route = routing()
        if (!parent.record.value.OutletCode) return { valid: false, message: 'Select an outlet to continue.' }
        if (route[RESTOCK_CONTROL.DIRECT] === true && !route[RESTOCK_CONTROL.WAREHOUSE]) {
          return { valid: false, message: 'Select a source warehouse to continue.' }
        }
        return
      }
      return validateItems()
    },

    // Nothing is re-collected. Layer 2 reads the live node and returns only the columns
    // submit itself decides, as a MERGE node - the lines and controls on the node are the
    // user's work and must not be replaced by a rebuild.
    submit: () => {
      const applied = pageState.applyNodes(restockSubmissionNodes(pageState, {
        draft: isDraft(),
        comment: parent.record.value.ProgressSubmittedComment
      }))
      if (applied.valid === false) return false
      return { successMsg: applied.successMsg }
    }
  }
}
