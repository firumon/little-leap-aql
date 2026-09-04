import {
  NODE,
  WAREHOUSE_FILTER,
  WAREHOUSE_REQUIRED
} from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliverySelection'
import { buildDeliveryCreateNodes } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryPayload'
import { orsisForDelivery } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

// `actions` must stay a getter so the step read stays tracked (UI_ACTION_SYSTEM.md §1.3).

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState }) => {
  // The sticky bar mounts against the page's node, which `Add.js` seeded on arrival.
  pageState.useNode(NODE)

  const step = () => pageState.meta?.currentStep || 1

  // The ticks are a column on the live record, not a control — read them the same way
  // every other reader of a manifest does.
  const selectedCodes = () => orsisForDelivery(pageState.getRecord(null, NODE) || {})

  const warehouse = () => text(pageState.getControls(WAREHOUSE_FILTER, null, NODE))

  // Written by `Add/SelectAllocations.vue`, which owns the queue rows. A run loads one van
  // at one warehouse, so the source must be settled before the picking screen is left.
  const warehouseRequired = () =>
    pageState.getControls(WAREHOUSE_REQUIRED, false, NODE) === true

  return {
    get actions () {
      if (step() === 2) return ['back', 'submit']
      return ['cancel', 'next']
    },

    submitLabel: 'Create Delivery',

    // Abandoning goes to the index, not `goBack()` — the coordinator may have arrived from
    // the outlet queue view. Returning `false` stops a second history entry being popped.
    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    next: () => {
      if (!selectedCodes().length) {
        return { valid: false, message: 'Tick at least one allocated item to continue.' }
      }
      if (warehouseRequired() && !warehouse()) {
        return { valid: false, message: 'Pick one source warehouse before continuing.' }
      }
      return undefined
    },

    // Nothing is assembled here. The record has been live since step 1; Layer 2 validates
    // it and returns the node, and `applyNodes` writes it back onto the same address.
    submit: () => {
      const applied = pageState.applyNodes(
        buildDeliveryCreateNodes({ record: pageState.getRecord(null, NODE) }))
      if (applied.valid === false) return false

      // No `onSuccess` of its own. `PageAction.vue` only installs its default — the one
      // that resets pageState AND follows `successRoute` — when the submit did not supply
      // one, so overriding it here to call `reset()` would silently drop the navigation
      // and the success notice.
      return { successMsg: applied.successMsg }
    },

    // Land on the new manifest so the coordinator can dispatch it immediately.
    successRoute: 'view'
  }
}
