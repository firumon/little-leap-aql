import { useAuth } from 'src/composables/core/useAuth'
import { buildReturnCreateBatch } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { returnRequiresTrack, REASON_REQUIRING_COMMENT } from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

/**
 * OutletReturns › Add › PageAction — JS modifier (tier 2: resource + page).
 *
 *   single step   the whole return   →   [ Cancel ] [ Submit Return ]
 *
 * A single-screen form, so `actions` is a plain array rather than a getter — there is no
 * `currentStep` for it to track (UI_ACTION_SYSTEM.md §11 rule 4).
 *
 * ── THE SUBMIT VETOES FOR THREE REASONS ──
 *
 *   1. SHAPE — a return with neither track flagged reconciles nothing: nobody is credited
 *      and nothing moves. This gate lives HERE and not in the payload builder, because the
 *      builder is shared with the consumption path, which legitimately logs such rows as
 *      the audit record of a surplus counted at the outlet. Same domain predicate
 *      (`returnRequiresTrack`), two callers, one of which enforces it — see its docblock.
 *   2. VALIDITY — the field-level rules the builder itself owns (outlet, SKU, quantity, the
 *      mandatory warehouse) are re-reported through the builder's own message rather than
 *      restated here, so the form and the batch can never disagree about what is missing.
 *      The one exception is the mandatory comment on reason OTHER, which is a UI-side
 *      requirement the sheet does not encode.
 *   3. PERMISSION — the batch may write an outlet ledger movement as well as the return, so
 *      it is gated on the permissions the BUILDER declares it needs, not on a literal map
 *      written here (§8.5 step 4). A return that moves no stock must not demand the
 *      movement permission it never uses.
 *
 * This modifier runs OUTSIDE a setup context, so it imports only the PURE domain exports
 * and reads its values off the injected `pageState` — the same node `ReturnForm.vue` writes.
 */
const NODE = 'OutletReturns'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceConfig }) => {
  // Safe outside setup: `useAuth` only reaches Pinia stores and calls no `inject()`.
  const { user } = useAuth()

  // `state.nodes` is keyed by an OPAQUE UID, never by resource name — so
  // `nodes.get('OutletReturns')` answered `undefined` on every call and this modifier
  // validated an empty object, vetoing every submit with the shape message. `useNode` is
  // the supported addressing layer (resource -> role -> uid) and works outside setup.
  const node = pageState.useNode(NODE)
  const form = () => node.record.value || {}
  const actor = () => text(user.value?.name || user.value?.email || '')

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Submit Return',

    // Abandoning goes to the index, not `goBack()` — the officer may have arrived from the
    // Outlet Hub rather than from the list. Returning `false` stops the dispatcher's
    // built-in `goBack()` popping a second history entry on top of it.
    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    submit: () => {
      const entry = form()

      if (!returnRequiresTrack(entry)) {
        return {
          valid: false,
          message: 'A return must either be credited on an invoice or move stock off the shelf.'
        }
      }

      if (text(entry.Reason) === REASON_REQUIRING_COMMENT && !text(entry.ReasonComment)) {
        return { valid: false, message: 'Reason "Other" needs an explanation.' }
      }

      const result = buildReturnCreateBatch({
        form: entry,
        // The figure the form resolved and the officer may have overridden. The builder
        // records what it is handed; it never prices anything itself.
        resolvedPrice: Number(entry.Price) || 0,
        actorName: actor()
      })

      if (!result.valid) return { valid: false, message: result.message }

      if (resourceConfig?.allowed(result.permissions) !== true) {
        return { valid: false, message: 'You are not allowed to log this return.' }
      }

      return {
        requests: result.requests,
        successMsg: result.successMsg,
        // The typed form would otherwise survive the navigation and re-seed the next visit.
        onSuccess: () => { pageState.reset() }
      }
    },

    // Land on the record just created, so the officer sees which tracks are now open and
    // can act on them immediately.
    successRoute: 'view'
  }
}
