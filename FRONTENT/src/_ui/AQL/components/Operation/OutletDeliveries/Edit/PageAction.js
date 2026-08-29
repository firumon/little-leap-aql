import { useAuth } from 'src/composables/core/useAuth'
import { restockItemRows } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryRows'
import { buildDeliveryEditManifestNodes } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryPayload'
import { isEditable } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

// Submit re-checks `isEditable` because the run may have departed while this page was open.
// Item rows come from Layer 2, not `useRecord`: a modifier runs outside component setup.
const SELECTION = 'DeliverySelection'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  // Safe outside setup: neither reaches `inject()`.
  const { user } = useAuth()

  const record = () => resourceRecord?.record?.value || {}
  const actor = () => text(user.value?.name || user.value?.email || '')

  const selectedCodes = () => {
    const raw = pageState.getControls('Codes', null, SELECTION)
    return Array.isArray(raw) ? raw.map(text).filter(Boolean) : []
  }

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
      return {
        successMsg: applied.successMsg,
        onSuccess: () => { pageState.reset() }
      }
    },

    successRoute: 'view'
  }
}
