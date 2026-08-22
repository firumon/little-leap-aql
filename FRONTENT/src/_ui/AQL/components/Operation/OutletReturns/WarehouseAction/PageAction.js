import { useAuth } from 'src/composables/core/useAuth'
import { buildReturnWarehouseActionBatch } from 'src/_resource/Operation/OutletReturns/composables/useReturnPayload'
import {
  STOCKED,
  DISPOSED,
  canConfirmWarehouseAction
} from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

/**
 * OutletReturns › WarehouseAction › PageAction — JS modifier (tier 2: resource + page).
 *
 *   single step   disposition + its detail   →   [ Cancel ] [ Confirm Action ]
 *
 * A single-step route, so `actions` is a plain array rather than a getter — there is no
 * `currentStep` for it to track (UI_ACTION_SYSTEM.md §11 rule 4).
 *
 * ── THE SUBMIT VETOES FOR THREE REASONS ──
 *
 *   1. STALENESS — the same `canConfirmWarehouseAction` predicate that gates the FAB,
 *      re-checked here because time has passed: another operator may have confirmed the
 *      receipt while this page was open, and confirming twice would add the units to stock
 *      a second time.
 *   2. INVALIDITY — a disposal with no reason. Re-checked here as well as in the card,
 *      because the card's banner is guidance and this is the gate.
 *   3. PERMISSION — gated on what the batch ACTUALLY writes, which the builder declares:
 *      a disposal touches only the return, while a stocking also writes a `StockMovements`
 *      row. Demanding the movement permission for a write-off would fail closed on a
 *      permission the action never uses, which is as wrong as failing open on one it does
 *      (§8.4).
 *
 * This modifier runs OUTSIDE a setup context, so it imports only the PURE domain exports
 * and reads its values off the injected handles — the same control fields
 * `WarehouseActionCard.vue` writes.
 */
const NODE = 'OutletReturns'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  // Safe outside setup: `useAuth` only reaches Pinia stores and calls no `inject()`.
  const { user } = useAuth()

  const record = () => resourceRecord?.record?.value || {}
  const actor = () => text(user.value?.name || user.value?.email || '')
  const control = (key) => text(pageState.getControlField(NODE, key))

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Confirm Action',

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const row = record()
      if (!text(row.Code)) return { valid: false, message: 'This return could not be loaded.' }

      if (!canConfirmWarehouseAction(row)) {
        return { valid: false, message: 'This return no longer needs a warehouse action.' }
      }

      const actionType = control('WarehouseActionType') || STOCKED
      const disposalReason = control('WarehouseDisposalReason')

      if (actionType === DISPOSED && !disposalReason) {
        return { valid: false, message: 'A disposal reason is required when writing stock off.' }
      }

      const result = buildReturnWarehouseActionBatch({
        record: row,
        actionType,
        storageName: control('WarehouseStorageName'),
        disposalReason,
        actorName: actor()
      })

      if (!result.valid) return { valid: false, message: result.message }

      if (resourceConfig?.allowed(result.permissions) !== true) {
        return { valid: false, message: 'You are not allowed to confirm this warehouse action.' }
      }

      return {
        requests: result.requests,
        successMsg: result.successMsg,
        // The typed disposal reason would otherwise survive the navigation and re-seed the
        // next return opened on this route.
        onSuccess: () => { pageState.reset() }
      }
    },

    successRoute: 'view'
  }
}
