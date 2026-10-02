import { PAYMENT_RECORDED_MESSAGE } from 'src/_resource/Operation/OutletPayments/composables/useOutletPaymentPayload'

const NODE = 'OutletPayments'

export default (props, { pageState }) => {
  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Record Payment',

    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    submit: () => {
      const record = pageState.getRecord(null, NODE) || {}
      const outletCode = String(record.OutletCode || '').trim()
      const amount = Number(record.Amount) || 0
      const autoApprove = pageState.getControls('AutoApprove', false) === true

      if (!outletCode) return { valid: false, message: 'Select an outlet to record payment.' }
      if (amount <= 0) return { valid: false, message: 'Enter an amount greater than zero.' }

      if (autoApprove) {
        const allocations = pageState.getControls('Allocations', {}, NODE) || {}
        const rows = Object.entries(allocations).filter(([_, val]) => Number(val) > 0)
        if (!rows.length) {
          return { valid: false, message: 'Select at least one invoice to settle.' }
        }
        const allocated = rows.reduce((sum, [_, val]) => sum + (Number(val) || 0), 0)
        if (Math.abs(allocated - amount) > 0.01) {
          return {
            valid: false,
            message: `The split (${allocated.toFixed(2)}) does not add up to the amount collected (${amount.toFixed(2)}).`
          }
        }
      }

      return { successMsg: PAYMENT_RECORDED_MESSAGE }
    }
  }
}

