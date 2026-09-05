import { canMarkInvoiceAdjusted } from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

// The settlement stands on the live node from the moment the card mounts, with the invoice
// the card matched already written to `ConsumptionInvoiceCode`. Submit builds nothing.
// There is no validity gate: the route collects nothing to validate — the attestation IS
// the input. The success line names the bill when there is one.
const NODE = 'OutletReturns'

const text = (value) => (value == null ? '' : String(value).trim())

export default (props, { pageState, resourceRecord }) => ({
  actions: ['cancel', 'submit'],
  submitLabel: 'Confirm Settlement',

  cancel: (name, { nav }) => {
    nav.goTo('view')
    return false
  },

  submit: () => {
    const row = resourceRecord?.record?.value || {}
    if (!text(row.Code)) return { valid: false, message: 'This return could not be loaded.' }
    if (!canMarkInvoiceAdjusted(row)) {
      return { valid: false, message: 'This return no longer needs an invoice adjustment.' }
    }

    const linked = text(pageState.getRecord('ConsumptionInvoiceCode', NODE))
    return { successMsg: linked ? `Credit settled on invoice ${linked}.` : 'Invoice adjustment settled.' }
  },

  successRoute: 'view'
})
