import { useAuth } from 'src/composables/core/useAuth'
import { buildGenerateGrnChainNodes } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingPayload'
import { usePOReceivingResource } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingResource'
import { usePurchaseOrderResource } from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderResource'
import { useProcurementResource } from 'src/_resource/Operation/Procurements/composables/useProcurementResource'

const NODE = 'POReceivings'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// [ Cancel ] [ Generate Goods Receipt ]
export default (props, { pageState, resourceRecord }) => {
  pageState.useNode(NODE)

  const { user } = useAuth()
  const { receivingItemsOf } = usePOReceivingResource()
  const { getPurchaseOrder } = usePurchaseOrderResource()
  const { getProcurement } = useProcurementResource()

  const receiving = () => {
    const row = resourceRecord?.record?.value
    return text(row?.Code) ? row : null
  }

  const items = () => {
    const code = text(receiving()?.Code)
    if (!code) return []
    return receivingItemsOf(code)
      .map(asRow)
      .filter((row) => isActive(row) && text(row.Code))
  }

  const purchaseOrder = () => getPurchaseOrder(receiving()?.PurchaseOrderCode)

  const procurement = () => getProcurement(receiving()?.ProcurementCode)

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Generate Goods Receipt',

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const result = buildGenerateGrnChainNodes({
        receiving: receiving(),
        items: items(),
        purchaseOrder: purchaseOrder(),
        procurement: procurement(),
        comment: text(pageState.getControls('ActionComment', null, NODE)),
        actorName: user.value?.name || user.value?.email || ''
      })


      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false

      return { successMsg: applied.successMsg }
    },

    successRoute: 'view'
  }
}
