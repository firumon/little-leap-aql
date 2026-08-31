import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'
import { buildPurchaseOrderCancelChainNodes } from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderPayload'

const NODE = 'PurchaseOrders'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// [ Cancel ] [ Cancel Purchase Order ]
export default (props, { pageState, resourceConfig, resourceRecord }) => {
  const dataStore = useDataStore()
  pageState.useNode(NODE)

  const { user } = useAuth()

  const purchaseOrder = () => {
    const row = resourceRecord?.record?.value
    return text(row?.Code) ? row : null
  }

  const rfq = () => {
    const record = purchaseOrder()
    const direct = text(record?.RFQCode)
    if (direct) return dataStore.getRecords('RFQs').find((row) => text(row?.Code) === direct) || null
    const procurementCode = text(record?.ProcurementCode)
    if (!procurementCode) return null
    return dataStore.getRecords('RFQs').find((row) => text(row?.ProcurementCode) === procurementCode) || null
  }

  const procurement = () => {
    const code = text(purchaseOrder()?.ProcurementCode)
    if (!code) return null
    return dataStore.getRecords('Procurements').find((row) => text(row?.Code) === code) || null
  }

  const liveReceivings = () => {
    const code = text(purchaseOrder()?.Code)
    if (!code) return []
    return dataStore.getRecords('POReceivings')
      .map(asRow)
      .filter((row) => text(row.PurchaseOrderCode) === code &&
        isActive(row) &&
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
        purchaseOrders: dataStore.getRecords('PurchaseOrders'),
        rfq: rfq(),
        rfqSupplierRows: dataStore.getRecords('RFQSuppliers'),
        procurement: procurement()
      })


      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false

      return { successMsg: applied.successMsg }
    },

    successRoute: 'view'
  }
}
