import { buildReceivingSaveChainNodes } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingPayload'
import { mergeInspectionLines } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingInspection'
import { isEditable } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingProgress'
import { usePurchaseOrderResource } from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderResource'
import { useProcurementResource } from 'src/_resource/Operation/Procurements/composables/useProcurementResource'
import { usePOReceivingResource } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingResource'

const NODE = 'POReceivings'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// [ Cancel ] [ Save Receiving ]
export default (props, { pageState, resourceRecord }) => {
  pageState.useNode(NODE)

  const { getPurchaseOrder, orderItemsOf } = usePurchaseOrderResource()
  const { getProcurement } = useProcurementResource()
  const { receivingItemsOf } = usePOReceivingResource()

  const control = (key) => pageState.getControls(key, null, NODE)
  const form = () => control('Form') || {}

  const receiving = () => {
    const row = resourceRecord?.record?.value
    return text(row?.Code) ? row : null
  }

  const purchaseOrder = () => getPurchaseOrder(form().PurchaseOrderCode)

  const procurement = () => getProcurement(purchaseOrder()?.ProcurementCode)

  const lines = () => {
    const orderCode = text(purchaseOrder()?.Code)
    if (!orderCode) return []
    const orderLines = orderItemsOf(orderCode)
      .map(asRow)
      .filter((row) => isActive(row) && text(row.Code))
    const receivingCode = text(receiving()?.Code)
    const savedByOrderItem = new Map(receivingItemsOf(receivingCode)
      .map(asRow)
      .filter((row) => isActive(row))
      .map((row) => [text(row.PurchaseOrderItemCode), row]))
    const counts = control('Counts') && typeof control('Counts') === 'object' ? control('Counts') : {}
    return mergeInspectionLines({ orderLines, savedByOrderItem, counts })
  }

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Save Receiving',

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const record = receiving()
      if (!record) return { valid: false, message: 'This receiving could not be loaded.' }
      if (!isEditable(record)) {
        return { valid: false, message: 'This receiving has been confirmed and can no longer be changed.' }
      }

      const result = buildReceivingSaveChainNodes({
        form: { ...form(), Code: text(record.Code) },
        items: lines(),
        receiving: record,
        procurement: procurement()
      })


      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false

      return { successMsg: applied.successMsg }
    },

    successRoute: 'view'
  }
}
