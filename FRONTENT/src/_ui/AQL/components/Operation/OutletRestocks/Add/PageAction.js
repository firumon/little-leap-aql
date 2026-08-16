import { useAuth } from 'src/composables/core/useAuth'
import {
  restockCreateFields,
  buildRestockCreateChainRequests
} from 'src/_resource/Operation/OutletRestocks/composables/useRestockPayload'

/**
 * OutletRestocks › Add › PageAction — JS modifier (tier 2: resource + page).
 *
 * Drives the 3-step restock wizard entirely from the sticky form-actions bar, so
 * the step content cards stay pure inputs with no navigation of their own:
 *
 *   step 1  outlet + mode   →  [ Cancel ] [ Continue ]
 *   step 2  item lines      →  [ Back   ] [ Continue ]
 *   step 3  review + comment→  [ Back   ] [ Submit Request ]
 *
 * `actions` is declared as a GETTER rather than a plain array on purpose.
 * `useActionResolver` calls this factory once per resolve and caches the result,
 * but merges it into `finalProps` inside a `computed` — so a getter is re-read on
 * every recompute and its reads of `pageState.meta.currentStep` are tracked. A
 * literal array would latch the step-1 button set forever (UI_ACTION_SYSTEM.md §1.3).
 *
 * Only `next` is intercepted; `back` is left to the dispatcher's built-in
 * decrement. `next` validates and returns `{ valid: false, message }` to veto —
 * on success it returns nothing, so the built-in increment performs the move.
 * Every handler follows the dispatcher contract in UI_ACTION_SYSTEM.md §4.
 */
export default (props, { pageState, resourceConfig }) => {
  const parent = pageState.useNode('OutletRestocks')
  const itemEntries = parent.children('OutletRestockItems')
  // Safe outside setup: `useAuth` only reaches Pinia stores and statically
  // imported Quasar plugins — it calls no `inject()`. `user` stays a computed,
  // so reading it at submit time gives the live session user.
  const { user } = useAuth()

  const step = () => pageState.meta.currentStep
  const mode = () => pageState.getControlField('OutletRestocks', 'RestockMode') || 'STANDARD'
  const warehouse = () => pageState.getControlField('OutletRestocks', 'WarehouseCode') || ''
  // Wizard-only intent set by `SubmitOptions.vue`; direct restocks never offer it.
  const isDraft = () => pageState.getControlField('OutletRestocks', 'isDraft') === true && mode() !== 'DIRECT'
  const items = () => itemEntries.value.filter((entry) => entry._action !== 'deactivate')

  // Reused by step 2's `next` gate and by `submit`: no request leaves the page
  // without at least one line carrying a positive quantity.
  function validateItems () {
    const lines = items()
    if (!lines.length || lines.some((entry) => Number(entry.data.Quantity) <= 0)) {
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

    // Step 3 relabels the primary button; steps 1-2 never render `submit`. A
    // getter for the same reason `actions` is one — so flipping the draft toggle
    // re-reads it instead of latching the label chosen at resolve time.
    get submitLabel () { return isDraft() ? 'Save Draft' : 'Submit Request' },

    // Leaving the wizard abandons an unsaved request, so go to the list rather
    // than `goBack()` — the user may have arrived from an outlet page. Returning
    // false stops the built-in goBack() from popping a second history entry.
    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    next: () => {
      if (step() === 1) {
        if (!parent.record.value.OutletCode) return { valid: false, message: 'Select an outlet to continue.' }
        if (mode() === 'DIRECT' && !warehouse()) return { valid: false, message: 'Select a source warehouse to continue.' }
        return
      }
      return validateItems()
    },

    /**
     * A THIN ADAPTER, nothing more (UI_RESOURCE_DOMAIN_LOGIC.md §9.1).
     *
     * This handler collects what the wizard asked — outlet, mode, warehouse, lines,
     * draft intent — and hands it to `OutletRestocks`' own Layer 2 chain builder. Which
     * `Progress` each mode lands in, which columns carry the submission stamp, and what
     * the direct mode's `StockMovements` deduction looks like are all decided THERE, and
     * are identical whether a restock is raised from this page or chained off a
     * consumption submit.
     *
     * Two calls rather than one, because the page owns the form node: the domain's field
     * decisions are applied to it first (`restockCreateFields`), and the composite save
     * `pageState.build()` then assembles rides into the chain builder as `baseRequests`,
     * so a field the wizard collects — the date, the requesting user, the submission
     * comment — is never restated in Layer 2 and never invented in Layer 3.
     */
    submit: () => {
      const actorName = user.value?.name || user.value?.email || ''
      const lines = items()
      const fields = restockCreateFields({
        mode: mode(),
        draft: isDraft(),
        warehouseCode: warehouse(),
        actorName,
        comment: parent.record.value.ProgressSubmittedComment
      })

      pageState.setFields('OutletRestocks', fields.header)
      if (fields.linePatch) {
        lines.forEach((entry) => {
          pageState.updateChild('OutletRestocks', 'OutletRestockItems', itemEntries.value.indexOf(entry), fields.linePatch)
        })
      }

      const result = buildRestockCreateChainRequests({
        outletCode: parent.record.value.OutletCode,
        mode: mode(),
        draft: isDraft(),
        warehouseCode: warehouse(),
        lines: lines.map((entry) => entry.data),
        baseRequests: pageState.build(),
        actorName
      })
      if (!result.valid) return { valid: false, message: result.message }
      if (resourceConfig?.allowed(result.permissions) !== true) {
        return { valid: false, message: 'You are not allowed to submit this restock request.' }
      }

      return { requests: result.requests, successMsg: result.successMsg }
    }
  }
}
