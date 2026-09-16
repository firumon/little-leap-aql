import { useAuth } from 'src/composables/core/useAuth'
import { buildReceivingCancelChainNodes } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingPayload'
import { useGoodsReceiptResource } from 'src/_resource/Operation/GoodsReceipts/composables/useGoodsReceiptResource'
import { useProcurementResource } from 'src/_resource/Operation/Procurements/composables/useProcurementResource'

const NODE = 'POReceivings'

const text = (value) => String(value ?? '').trim()

// [ Cancel ] [ Cancel Receiving ]
export default (props, { pageState, resourceRecord }) => {
  pageState.useNode(NODE)

  const { user } = useAuth()
  const { goodsReceiptOfReceiving, goodsReceiptItems } = useGoodsReceiptResource()
  const { getProcurement } = useProcurementResource()

  const receiving = () => {
    const row = resourceRecord?.record?.value
    return text(row?.Code) ? row : null
  }

  const goodsReceipt = () => goodsReceiptOfReceiving(receiving()?.Code)

  const procurement = () => getProcurement(receiving()?.ProcurementCode)

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Cancel Receiving',

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const result = buildReceivingCancelChainNodes({
        receiving: receiving(),
        goodsReceipt: goodsReceipt(),
        goodsReceiptItems: goodsReceiptItems(),
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
