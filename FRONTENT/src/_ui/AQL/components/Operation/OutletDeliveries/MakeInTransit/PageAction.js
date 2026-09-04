import { useAuth } from 'src/composables/core/useAuth'
import { buildDeliveryMarkInTransitNodes } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryPayload'
import { canMakeInTransit } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

/**
 * OutletDeliveries › MakeInTransit › PageAction — JS modifier (tier 2: resource + page).
 *
 *   single step   confirmation + optional note   →   [ Cancel ] [ Mark In Transit ]
 *
 * ── THE SUBMIT VETOES FOR TWO REASONS ──
 *
 *   1. STALENESS — the same `canMakeInTransit` predicate that gates the FAB, re-checked
 *      because another coordinator may have dispatched the run while this page was open.
 *      The builder additionally refuses an EMPTY manifest, which is reported through its own
 *      message: a van with nothing on it has not departed for anything.
 *   2. PERMISSION — gated on what the builder declares (§8.5 step 4). Departing writes one
 *      column and three stamps on one row, so it asks for `outletDelivery: 'update'` alone.
 */
const NODE = 'OutletDeliveries'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  // Safe outside setup: `useAuth` only reaches Pinia stores and calls no `inject()`.
  const { user } = useAuth()

  const record = () => resourceRecord?.record?.value || {}
  const actor = () => text(user.value?.name || user.value?.email || '')

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Mark In Transit',

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const row = record()
      if (!text(row.Code)) return { valid: false, message: 'This delivery could not be loaded.' }

      if (!canMakeInTransit(row)) {
        return { valid: false, message: 'Only a draft delivery can be marked as in transit.' }
      }

      const result = buildDeliveryMarkInTransitNodes({
        record: row,
        actorName: actor(),
        comment: text(pageState.getRecord('ProgressInTransitComment', NODE))
      })

      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false

      // No `onSuccess` of its own: `PageAction.vue` installs its default — reset pageState,
      // then follow `successRoute` — only when the submit supplies none. Overriding it to
      // call `reset()` silently drops the navigation and the success notice.
      return { successMsg: applied.successMsg }
    },

    successRoute: 'view'
  }
}
