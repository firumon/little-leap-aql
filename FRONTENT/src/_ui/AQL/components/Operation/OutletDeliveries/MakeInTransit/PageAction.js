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
  const record = () => resourceRecord?.record?.value || {}

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

      return {
        successMsg: 'Delivery marked as in transit.',
        onSuccess: () => { pageState.reset() }
      }
    },

    successRoute: 'view'
  }
}
