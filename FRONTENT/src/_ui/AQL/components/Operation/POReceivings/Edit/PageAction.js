import { useDataStore } from 'src/stores/data'
import { buildReceivingSaveChainNodes } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingPayload'
import { mergeInspectionLines } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingInspection'
import { isEditable } from 'src/_resource/Operation/POReceivings/composables/usePOReceivingProgress'

const NODE = 'POReceivings'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// [ Cancel ] [ Save Receiving ]
export default (props, { pageState, resourceConfig, resourceRecord }) => {
  const dataStore = useDataStore()
  pageState.useNode(NODE)

  const control = (key) => pageState.getControls(key, null, NODE)
  const form = () => control('Form') || {}

  const receiving = () => {
    const row = resourceRecord?.record?.value
    return text(row?.Code) ? row : null
  }

  const purchaseOrder = () => dataStore.getRecords('PurchaseOrders')
    .find((row) => text(row?.Code) === text(form().PurchaseOrderCode)) || null

  const procurement = () => {
    const code = text(purchaseOrder()?.ProcurementCode)
    if (!code) return null
    return dataStore.getRecords('Procurements').find((row) => text(row?.Code) === code) || null
  }

  const lines = () => {
    const orderCode = text(purchaseOrder()?.Code)
    if (!orderCode) return []
    const orderLines = dataStore.getRecords('PurchaseOrderItems')
      .map(asRow)
      .filter((row) => text(row.PurchaseOrderCode) === orderCode && isActive(row) && text(row.Code))
    const receivingCode = text(receiving()?.Code)
    const savedByOrderItem = new Map(dataStore.getRecords('POReceivingItems')
      .map(asRow)
      .filter((row) => text(row.POReceivingCode) === receivingCode && isActive(row))
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
