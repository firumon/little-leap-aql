import { useAuth } from 'src/composables/core/useAuth'
import { restockItemRows } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryRows'
import { buildDeliveryEditManifestNodes } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryPayload'
import {
  isEditable,
  orsisForDelivery
} from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'
import { NODE } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/useDeliverySelection'

// Submit re-checks `isEditable` because the run may have departed while this page was open.
// Item rows come from Layer 2, not `useRecord`: a modifier runs outside component setup.

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  // Safe outside setup: neither reaches `inject()`.
  const { user } = useAuth()

  const record = () => resourceRecord?.record?.value || {}
  const actor = () => text(user.value?.name || user.value?.email || '')

  // The ticks live on the manifest's own `OutletRestockItemCodes` column, on the live node
  // the grid hydrated — never in a control mirroring them.
  const selectedCodes = () => orsisForDelivery(pageState.getRecord(null, NODE) || {})

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Save Delivery',

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const row = record()
      if (!text(row.Code)) return { valid: false, message: 'This delivery could not be loaded.' }

      if (!isEditable(row)) {
        return { valid: false, message: 'Only a draft delivery can have its items edited.' }
      }

      const result = buildDeliveryEditManifestNodes({
        record: row,
        newOrsiCodes: selectedCodes(),
        allOrsiRows: restockItemRows(),
        actorName: actor()
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
