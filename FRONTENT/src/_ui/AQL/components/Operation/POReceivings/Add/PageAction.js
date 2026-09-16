import { buildReceivingSaveChainNodes } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingPayload'
import { mergeInspectionLines } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingInspection'
import { usePurchaseOrderResource } from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderResource'
import { useProcurementResource } from 'src/_resource/Operation/Procurements/composables/useProcurementResource'

const NODE = 'POReceivings'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// step 1 which order arrived | step 2 the counts
export default (props, { pageState }) => {
  pageState.useNode(NODE)

  const { getPurchaseOrder, orderItemsOf } = usePurchaseOrderResource()
  const { getProcurement } = useProcurementResource()

  const control = (key) => pageState.getControls(key, null, NODE)
  const step = () => pageState.meta?.currentStep || 1
  const form = () => control('Form') || {}

  const purchaseOrder = () => getPurchaseOrder(form().PurchaseOrderCode)

  const procurement = () => getProcurement(purchaseOrder()?.ProcurementCode)

  // The same Layer 2 merge the grid renders, so the submit matches the screen.
  const lines = () => {
    const code = text(purchaseOrder()?.Code)
    if (!code) return []
    const orderLines = orderItemsOf(code)
      .map(asRow)
      .filter((row) => isActive(row) && text(row.Code))
    const counts = control('Counts') && typeof control('Counts') === 'object' ? control('Counts') : {}
    return mergeInspectionLines({ orderLines, counts })
  }

  return {
    get actions () {
      if (step() === 2) return ['back', 'submit']
      return ['cancel', 'next']
    },

    submitLabel: 'Save Receiving',

    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    next: () => {
      if (step() === 1 && !purchaseOrder()) {
        return { valid: false, message: 'Select the purchase order that arrived.' }
      }
      return undefined
    },

    submit: () => {
      const result = buildReceivingSaveChainNodes({
        form: {
          ...form(),
          ProcurementCode: text(purchaseOrder()?.ProcurementCode) || text(form().ProcurementCode)
        },
        items: lines(),
        procurement: procurement()
      })


      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false

      return { successMsg: applied.successMsg }
    },

    successRoute: 'index'
  }
}
