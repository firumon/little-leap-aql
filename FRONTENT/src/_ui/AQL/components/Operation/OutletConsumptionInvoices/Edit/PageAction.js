import { editableInvoiceItems } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoicePayload'
import { canEditInvoice } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'

// Validation only. `Edit.js`'s `ready` keeps the revised invoice in the batch as the
// answers are given (UI_PAGE_STATE.md §5B).

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceRecord }) => {
  // The sticky bar mounts against the page's node and renders nothing without one.
  pageState.useNode('OutletConsumptionInvoices')

  const record = () => resourceRecord?.record?.value || {}

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Save Invoice',

    // false stops the built-in goBack() popping a second history entry.
    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const row = record()
      if (!text(row.Code)) return { valid: false, message: 'This invoice could not be loaded.' }

      if (!canEditInvoice(row)) {
        return { valid: false, message: 'This invoice can no longer be edited — it has taken a payment or come to rest.' }
      }

      if (!editableInvoiceItems(row).length) {
        return { valid: false, message: 'This invoice has no editable lines.' }
      }

      return { successMsg: `Invoice ${text(row.Code)} updated.` }
    },

    successRoute: 'view'
  }
}
