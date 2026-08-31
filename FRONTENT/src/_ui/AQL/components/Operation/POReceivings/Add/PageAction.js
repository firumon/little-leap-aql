import { useDataStore } from 'src/stores/data'
import { buildReceivingSaveChainNodes } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingPayload'
import { mergeInspectionLines } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingInspection'

const NODE = 'POReceivings'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// step 1 which order arrived | step 2 the counts
export default (props, { pageState, resourceConfig }) => {
  const dataStore = useDataStore()
  pageState.useNode(NODE)

  const control = (key) => pageState.getControls(key, null, NODE)
  const step = () => pageState.meta?.currentStep || 1
  const form = () => control('Form') || {}

  const purchaseOrder = () => dataStore.getRecords('PurchaseOrders')
    .find((row) => text(row?.Code) === text(form().PurchaseOrderCode)) || null

  const procurement = () => {
    const code = text(purchaseOrder()?.ProcurementCode)
    if (!code) return null
    return dataStore.getRecords('Procurements').find((row) => text(row?.Code) === code) || null
  }

  // The same Layer 2 merge the grid renders, so the submit matches the screen.
  const lines = () => {
    const code = text(purchaseOrder()?.Code)
    if (!code) return []
    const orderLines = dataStore.getRecords('PurchaseOrderItems')
      .map(asRow)
      .filter((row) => text(row.PurchaseOrderCode) === code && isActive(row) && text(row.Code))
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
