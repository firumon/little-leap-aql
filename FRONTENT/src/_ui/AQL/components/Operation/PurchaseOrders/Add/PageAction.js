import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'
import { buildPurchaseOrderCreateChainNodes } from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderPayload'
import {
  normalizeNumber,
  orderedQtyByQuotationItem,
  remainingQtyOf,
  blankCharges
} from 'src/_resource/Operation/PurchaseOrders/composables/usePurchaseOrderTotals'
import { allowsPartialPo } from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationProgress'

const NODE = 'PurchaseOrders'

const text = (value) => String(value ?? '').trim()
const asRow = (value) => (value && typeof value === 'object' ? value : {})
const isActive = (value) => text(asRow(value).Status || 'Active') === 'Active'

// step 1 quotation | step 2 quantities | step 3 delivery, charges and review
export default (props, { pageState, resourceConfig }) => {
  const dataStore = useDataStore()
  pageState.useNode(NODE)

  const { user } = useAuth()

  const control = (key) => pageState.getControls(key, null, NODE)
  const step = () => pageState.meta?.currentStep || 1
  const form = () => control('Form') || {}

  const quotation = () => dataStore.getRecords('SupplierQuotations')
    .find((row) => text(row?.Code) === text(form().QuotationCode)) || null

  const sourceItems = () => {
    const code = text(quotation()?.Code)
    if (!code) return []
    return dataStore.getRecords('SupplierQuotationItems')
      .map(asRow)
      .filter((row) => text(row.SupplierQuotationCode) === code && isActive(row) && text(row.Code))
  }

  const rfq = () => {
    const code = text(quotation()?.RFQCode)
    if (!code) return null
    return dataStore.getRecords('RFQs').find((row) => text(row?.Code) === code) || null
  }

  const procurement = () => {
    const code = text(quotation()?.ProcurementCode)
    if (!code) return null
    return dataStore.getRecords('Procurements').find((row) => text(row?.Code) === code) || null
  }

  const requisitionIndex = () => new Map(
    dataStore.getRecords('PurchaseRequisitionItems').map(asRow).map((row) => [text(row.Code), row]))

  // Rebuilt from the source rows so the payload cannot drift from what was displayed.
  const lines = () => {
    const state = control('Lines') && typeof control('Lines') === 'object' ? control('Lines') : {}
    const partialAllowed = allowsPartialPo(quotation())
    const ordered = orderedQtyByQuotationItem(
      dataStore.getRecords('PurchaseOrders'), dataStore.getRecords('PurchaseOrderItems'), text(quotation()?.Code))
    const prIndex = requisitionIndex()

    return sourceItems().map((row) => {
      const key = text(row.Code)
      const saved = state[key] || {}
      const remaining = remainingQtyOf(row, ordered)
      const prItem = prIndex.get(text(row.PurchaseRequisitionItemCode)) || {}
      return {
        Selected: saved.Selected == null ? (!partialAllowed || remaining > 0) : saved.Selected === true,
        SupplierQuotationItemCode: key,
        SKU: text(row.SKU),
        Description: text(row.Description),
        UOM: text(prItem.UOM),
        QuotedQuantity: normalizeNumber(row.Quantity),
        RemainingQuantity: remaining,
        OrderedQuantity: saved.OrderedQuantity == null ? remaining : normalizeNumber(saved.OrderedQuantity),
        UnitPrice: normalizeNumber(row.UnitPrice),
        SupplierItemCode: text(row.SupplierItemCode),
        Remarks: text(row.Remarks)
      }
    })
  }

  return {
    get actions () {
      if (step() === 2) return ['back', 'next']
      if (step() === 3) return ['back', 'submit']
      return ['cancel', 'next']
    },

    submitLabel: 'Create Purchase Order',

    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    next: () => {
      if (step() === 1 && !quotation()) {
        return { valid: false, message: 'Select a supplier quotation.' }
      }
      if (step() === 2 && !lines().some((line) => line.Selected && line.OrderedQuantity > 0)) {
        return { valid: false, message: 'Order at least one line with a quantity above zero.' }
      }
      return undefined
    },

    submit: () => {
      const source = quotation()
      const result = buildPurchaseOrderCreateChainNodes({
        form: {
          ...form(),
          ProcurementCode: text(source?.ProcurementCode),
          SupplierQuotationCode: text(source?.Code),
          SupplierCode: text(source?.SupplierCode),
          Currency: text(source?.Currency),
          ExtraChargesBreakup: form().ExtraChargesBreakup || blankCharges()
        },
        items: lines(),
        quotation: source,
        quotationItems: sourceItems(),
        purchaseOrders: dataStore.getRecords('PurchaseOrders'),
        purchaseOrderItems: dataStore.getRecords('PurchaseOrderItems'),
        rfq: rfq(),
        procurement: procurement(),
        closeRfq: control('CloseRfq') === true,
        actorName: user.value?.name || user.value?.email || ''
      })


      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false

      return { successMsg: applied.successMsg }
    },

    successRoute: 'index'
  }
}
