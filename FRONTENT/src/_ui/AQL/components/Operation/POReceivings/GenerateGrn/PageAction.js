import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'
import { buildGenerateGrnChainNodes } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingPayload'

const NODE = 'POReceivings'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// [ Cancel ] [ Generate Goods Receipt ]
export default (props, { pageState, resourceConfig, resourceRecord }) => {
  const dataStore = useDataStore()
  pageState.useNode(NODE)

  const { user } = useAuth()

  const receiving = () => {
    const row = resourceRecord?.record?.value
    return text(row?.Code) ? row : null
  }

  const items = () => {
    const code = text(receiving()?.Code)
    if (!code) return []
    return dataStore.getRecords('POReceivingItems')
      .map(asRow)
      .filter((row) => text(row.POReceivingCode) === code && isActive(row) && text(row.Code))
  }

  const purchaseOrder = () => {
    const code = text(receiving()?.PurchaseOrderCode)
    if (!code) return null
    return dataStore.getRecords('PurchaseOrders').find((row) => text(row?.Code) === code) || null
  }

  const procurement = () => {
    const code = text(receiving()?.ProcurementCode)
    if (!code) return null
    return dataStore.getRecords('Procurements').find((row) => text(row?.Code) === code) || null
  }

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
