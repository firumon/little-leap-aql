import { buildReturnUpdateBatch } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { REASON_REQUIRING_COMMENT } from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

/**
 * OutletReturns › Edit › PageAction — JS modifier (tier 2: resource + page).
 *
 *   single view   the corrected return   →   [ Cancel ] [ Save Changes ]
 *
 * The Edit contract renders the Add form's own six cards and no `Update` content, so the
 * bar has to assemble the batch itself rather than letting the generated form do it. It
 * reads the node those cards write and the SERVER row they were hydrated from — the update
 * builder needs both, because the ledger correction it may post is the difference between
 * what the stored row implied and what the corrected one implies.
 *
 * ── THE SUBMIT VETOES FOR THE SAME THREE REASONS AS ADD ──
 *   1. SHAPE and VALIDITY are re-reported through the BUILDER's own messages, so the form
 *      and the batch can never disagree about what is missing. The one exception is the
 *      mandatory comment on reason OTHER, which is a UI-side requirement the sheet does not
 *      encode.
 *   2. ELIGIBILITY is the builder's too (`isEditable`), re-checked at submit rather than
 *      trusted from page load — a return can be credited by someone else while this form
 *      is open.
 *   3. PERMISSION is taken from what the BUILDER declares it needs, not from a literal map
 *      written here (§8.5 step 4): a correction that moves no stock must not demand the
 *      movement permission it never uses.
 *
 * This modifier runs OUTSIDE a setup context, so it imports only PURE domain exports and
 * reads its values off the injected `pageState` / `resourceRecord`.
 */
const NODE = 'OutletReturns'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceRecord, resourceConfig }) => {
  // `state.nodes` is keyed by an opaque uid, never by resource name — `useNode` is the
  // supported addressing layer, and it works outside setup.
  const node = pageState.useNode(NODE)

  const form = () => node.record.value || {}
  const stored = () => resourceRecord?.record?.value || {}

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Save Changes',

    // Abandoning an edit returns to the record, not through `goBack()` — the officer came
    // here to look at this return, and replaying whatever history opened the form is not
    // where they wanted to land.
    cancel: (name, { nav }) => {
      nav.goTo('view', { code: text(stored().Code) })
      return false
    },

    submit: () => {
      const entry = form()

      if (text(entry.Reason) === REASON_REQUIRING_COMMENT && !text(entry.ReasonComment)) {
        return { valid: false, message: 'Reason "Other" needs an explanation.' }
      }

      const result = buildReturnUpdateBatch({
        record: stored(),
        form: entry,
        // The figure the form resolved and the officer may have overridden. The builder
        // records what it is handed; it never prices anything itself.
        resolvedPrice: Number(entry.Price) || 0
      })

      if (!result.valid) return { valid: false, message: result.message }

      if (resourceConfig?.allowed(result.permissions) !== true) {
        return { valid: false, message: 'You are not allowed to edit this return.' }
      }

      return {
        requests: result.requests,
        successMsg: result.successMsg,
        // The typed form would otherwise survive the navigation and re-seed the next visit.
        onSuccess: () => { pageState.reset() }
      }
    },

    // Land back on the record, so the officer sees the corrected row and which tracks are
    // now open on it.
    successRoute: 'view'
  }
}
