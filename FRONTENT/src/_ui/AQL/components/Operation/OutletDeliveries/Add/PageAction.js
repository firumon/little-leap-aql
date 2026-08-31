import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'

// `actions` must stay a getter so the step read stays tracked (UI_ACTION_SYSTEM.md §1.3).
const SELECTION = 'DeliverySelection'
const NODE = 'OutletDeliveries'
const WAREHOUSE_FILTER = 'DeliveryWarehouseFilter'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceConfig }) => {
  // Safe outside setup: `useAuth` only reaches Pinia stores and calls no `inject()`.
  const { user } = useAuth()

  // The sticky bar mounts against the page's node and renders nothing without one.
  pageState.useNode(NODE)

  const actor = () => text(user.value?.name || user.value?.email || '')

  const step = () => pageState.meta?.currentStep || 1

  // The ticks ARE the manifest's own CSV column, not a control (UI_PAGE_STATE.md §5B.2).
  const selectedCodes = () => text(pageState.getRecord('OutletRestockItemCodes', NODE))
    .split(',').map(text).filter(Boolean)

  const warehouse = () => text(pageState.getControls(WAREHOUSE_FILTER, null, SELECTION))

  /** A run loads one van at one warehouse, so the ticks may not straddle two of them. */
  const warehousesOfSelection = () => {
    const chosen = new Set(selectedCodes())
    const rows = useDataStore().getRecords('OutletRestockItems') || []
    return new Set(rows
      .filter((row) => chosen.has(text(row?.Code)))
      .map((row) => text(row?.WarehouseCode))
      .filter(Boolean))
  }

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
      const spread = warehousesOfSelection()
      if (!warehouse() && spread.size > 1) {
        return { valid: false, message: 'Pick one source warehouse before continuing.' }
      }
      return undefined
    },

    submit: () => {
      const codes = selectedCodes()
      if (!codes.length) return { valid: false, message: 'Select at least one allocated item for this delivery.' }
      if (!actor()) return { valid: false, message: 'A driver or delivery agent is required.' }

      return {
        successMsg: `Delivery draft created with ${codes.length} item${codes.length === 1 ? '' : 's'}.`,
        // Otherwise the selection survives the navigation and re-seeds the next visit with
        // lines that are now on the run just created.
        onSuccess: () => { pageState.reset() }
      }
    },

    // Land on the new manifest so the coordinator can dispatch it immediately.
    successRoute: 'view'
  }
}
