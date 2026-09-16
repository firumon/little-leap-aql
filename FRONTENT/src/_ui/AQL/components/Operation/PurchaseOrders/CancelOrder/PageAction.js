import { useAuth } from 'src/composables/core/useAuth'
import { buildPurchaseOrderCancelChainNodes } from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderPayload'
import { useRFQResource } from 'src/_resource/Operation/RFQs/composables/useRFQResource'
import { useProcurementResource } from 'src/_resource/Operation/Procurements/composables/useProcurementResource'
import { usePOReceivingResource } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingResource'
import { usePurchaseOrderResource } from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderResource'

const NODE = 'PurchaseOrders'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// [ Cancel ] [ Cancel Purchase Order ]
export default (props, { pageState, resourceRecord }) => {
  pageState.useNode(NODE)

  const { user } = useAuth()
  const { getRFQ, rfqOfProcurement, rfqSupplierRows } = useRFQResource()
  const { getProcurement } = useProcurementResource()
  const { receivingsOfOrder } = usePOReceivingResource()
  const { purchaseOrders } = usePurchaseOrderResource()

  const purchaseOrder = () => {
    const row = resourceRecord?.record?.value
    return text(row?.Code) ? row : null
  }

  const rfq = () => {
    const record = purchaseOrder()
    const direct = text(record?.RFQCode)
    if (direct) return getRFQ(direct)
    const procurementCode = text(record?.ProcurementCode)
    if (!procurementCode) return null
    return rfqOfProcurement(procurementCode)
  }

  const procurement = () => getProcurement(purchaseOrder()?.ProcurementCode)

  const liveReceivings = () => {
    const code = text(purchaseOrder()?.Code)
    if (!code) return []
    return receivingsOfOrder(code)
      .map(asRow)
      .filter((row) => isActive(row) &&
        text(row.Progress).toUpperCase() !== 'CANCELLED')
  }

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Cancel Purchase Order',

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      // A cancellation cannot undo goods that have physically arrived.
      if (liveReceivings().length) {
        return { valid: false, message: 'Goods have been received against this order, so it can no longer be cancelled.' }
      }

      const result = buildPurchaseOrderCancelChainNodes({
        purchaseOrder: purchaseOrder(),
        comment: text(pageState.getControls('CancelComment', null, NODE)),
        actorName: user.value?.name || user.value?.email || '',
        purchaseOrders: purchaseOrders(),
        rfq: rfq(),
        rfqSupplierRows: rfqSupplierRows(),
        procurement: procurement()
      })


      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false

      return { successMsg: applied.successMsg }
    },

    successRoute: 'view'
  }
}
