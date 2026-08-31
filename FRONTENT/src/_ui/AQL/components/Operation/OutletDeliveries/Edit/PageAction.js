import { isEditable } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

// Submit re-checks `isEditable` because the run may have departed while this page was open.
// Item rows come from Layer 2, not `useRecord`: a modifier runs outside component setup.

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceConfig, resourceRecord }) => {
  const record = () => resourceRecord?.record?.value || {}

  // The ticks ARE the manifest's own CSV column, not a control (UI_PAGE_STATE.md §5B.2).
  const selectedCodes = () => text(pageState.getRecord('OutletRestockItemCodes', 'OutletDeliveries'))
    .split(',').map(text).filter(Boolean)

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

      if (!selectedCodes().length) {
        return { valid: false, message: 'A delivery must carry at least one item.' }
      }

      return {
        successMsg: `Delivery ${text(row.Code)} updated.`,
        onSuccess: () => { pageState.reset() }
      }
    },

    successRoute: 'view'
  }
}
