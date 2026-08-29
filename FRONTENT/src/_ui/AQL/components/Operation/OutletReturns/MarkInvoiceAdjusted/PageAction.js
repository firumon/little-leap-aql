import { useAuth } from 'src/composables/core/useAuth'
import { buildReturnMarkInvoiceAdjustedNodes } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import { canMarkInvoiceAdjusted } from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

/**
 * OutletReturns › MarkInvoiceAdjusted › PageAction — JS modifier (tier 2: resource + page).
 *
 *   single step   confirmation only   →   [ Cancel ] [ Confirm Settlement ]
 *
 * A single-step route with no inputs, so `actions` is a plain array (UI_ACTION_SYSTEM.md
 * §11 rule 4).
 *
 * ── THE SUBMIT VETOES FOR TWO REASONS ──
 *
 *   1. STALENESS — the same `canMarkInvoiceAdjusted` predicate that gates the FAB,
 *      re-checked because time has passed: an invoice may have credited this return while
 *      the page was open, and settling it twice would leave the outlet's ledger claiming a
 *      credit they received once.
 *   2. PERMISSION — gated on the permissions the BUILDER declares rather than a literal map
 *      written here (§8.5 step 4). This batch touches only the return, so it asks for only
 *      that.
 *
 * There is no validity gate: the route collects nothing to validate. That is the point of
 * it — the attestation IS the input.
 */
const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  // Safe outside setup: `useAuth` only reaches Pinia stores and calls no `inject()`.
  const { user } = useAuth()

  const record = () => resourceRecord?.record?.value || {}
  const actor = () => text(user.value?.name || user.value?.email || '')

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Confirm Settlement',

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const row = record()
      if (!text(row.Code)) return { valid: false, message: 'This return could not be loaded.' }

      if (!canMarkInvoiceAdjusted(row)) {
        return { valid: false, message: 'This return no longer needs an invoice adjustment.' }
      }

      const result = buildReturnMarkInvoiceAdjustedNodes({ record: row, actorName: actor() })


      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false
      return {
        successMsg: applied.successMsg,
        onSuccess: () => { pageState.reset() }
      }
    },

    successRoute: 'view'
  }
}
