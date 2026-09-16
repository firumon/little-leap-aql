import { buildRFQCreateChainNodes } from 'src/_resource/Operation/RFQs/composables/useRFQPayload'
import { usePurchaseRequisitionResource } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionResource'
import { useProcurementResource } from 'src/_resource/Operation/Procurements/composables/useProcurementResource'

const NODE = 'RFQs'

const text = (value) => String(value ?? '').trim()

// step 1 requisition + items | step 2 terms | step 3 suppliers + review
export default (props, { pageState }) => {
  pageState.useNode(NODE)

  const { getPurchaseRequisition, requisitionItemsByCodes } = usePurchaseRequisitionResource()
  const { getProcurement } = useProcurementResource()

  const control = (key) => pageState.getControls(key, null, NODE)
  const step = () => pageState.meta?.currentStep || 1

  const requisition = () => getPurchaseRequisition(control('RequisitionCode'))

  const procurement = () => getProcurement(requisition()?.ProcurementCode)

  const selectedItems = () => requisitionItemsByCodes(control('SelectedItemCodes'))

  return {
    get actions () {
      if (step() === 2) return ['back', 'next']
      if (step() === 3) return ['back', 'submit']
      return ['cancel', 'next']
    },

    submitLabel: 'Generate RFQ',

    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    next: () => {
      if (step() === 1) {
        if (!requisition()) return { valid: false, message: 'Select an approved requisition.' }
        if (!selectedItems().length) return { valid: false, message: 'Select at least one item to quote.' }
      }
      return undefined
    },

    submit: () => {
      const result = buildRFQCreateChainNodes({
        requisition: requisition(),
        items: selectedItems(),
        form: control('Form') || {},
        procurement: procurement(),
        suppliers: Array.isArray(control('SelectedSupplierCodes')) ? control('SelectedSupplierCodes') : []
      })


      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false
      return {
        successMsg: applied.successMsg,
        onSuccess: undefined
      }
    },

    successRoute: 'index'
  }
}
