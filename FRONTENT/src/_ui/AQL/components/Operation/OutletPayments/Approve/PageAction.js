export default (props, { pageState, resourceConfig, nav }) => {
  const step = () => pageState?.meta?.currentStep || 1
  const hasNodes = () => Boolean(pageState?.hasNodes?.value)

  return {
    get showFormActions () {
      return step() >= 2
    },

    get actions () {
      if (step() <= 1) return []
      return [
        'back',
        { name: 'submit', disabled: !hasNodes(), label: 'Approve' }
      ]
    },

    back: () => {
      const nextStep = Math.max(1, step() - 1)
      if (nextStep === 1) {
        pageState?.resetForResource('OutletPayments')
      }
      return { step: nextStep }
    },

    submit: () => {
      if (!hasNodes()) {
        return { valid: false, message: 'No approval nodes prepared.' }
      }
      return {
        successMsg: 'Payment approved and invoices allocated.',
        onSuccess: () => {
          pageState?.resetForResource?.('OutletPayments')
          if (pageState?.meta) pageState.meta.currentStep = 1
        }
      }
    }
  }
}
