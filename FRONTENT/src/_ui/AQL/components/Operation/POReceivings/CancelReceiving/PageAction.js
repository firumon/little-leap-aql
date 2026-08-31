import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'
import { buildReceivingCancelChainNodes } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingPayload'

const NODE = 'POReceivings'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// [ Cancel ] [ Cancel Receiving ]
export default (props, { pageState, resourceConfig, resourceRecord }) => {
  const dataStore = useDataStore()
  pageState.useNode(NODE)

  const { user } = useAuth()

  const receiving = () => {
    const row = resourceRecord?.record?.value
    return text(row?.Code) ? row : null
  }

  const goodsReceipt = () => {
    const code = text(receiving()?.Code)
    if (!code) return null
    return dataStore.getRecords('GoodsReceipts')
      .map(asRow)
      .find((row) => text(row.POReceivingCode) === code && isActive(row)) || null
  }

  const procurement = () => {
    const code = text(receiving()?.ProcurementCode)
    if (!code) return null
    return dataStore.getRecords('Procurements').find((row) => text(row?.Code) === code) || null
  }

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
        goodsReceiptItems: dataStore.getRecords('GoodsReceiptItems'),
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
