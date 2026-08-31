import { useAuth } from 'src/composables/core/useAuth'
import { useDataStore } from 'src/stores/data'
import { buildQuotationCaptureChainNodes } from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationPayload'
import { DECLINED } from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationProgress'
import { parsePrItemCodeCsv, supplierRowsOf } from 'src/_resource/Operation/RFQs/composables/useRFQProgress'

const NODE = 'SupplierQuotations'

const text = (value) => String(value ?? '').trim()

// step 1 RFQ + supplier | step 2 quoted lines | step 3 terms and charges
export default (props, { pageState, resourceConfig }) => {
  const dataStore = useDataStore()
  pageState.useNode(NODE)

  const { user } = useAuth()

  const control = (key) => pageState.getControls(key, null, NODE)
  const step = () => pageState.meta?.currentStep || 1
  const form = () => control('Form') || {}

  const rfq = () => dataStore.getRecords('RFQs').find((row) => text(row?.Code) === text(form().RFQCode)) || null

  const supplierRow = () => supplierRowsOf(rfq(), dataStore.getRecords('RFQSuppliers'))
    .find((row) => text(row.SupplierCode) === text(form().SupplierCode)) || null

  const procurement = () => {
    const code = text(rfq()?.ProcurementCode)
    if (!code) return null
    return dataStore.getRecords('Procurements').find((row) => text(row?.Code) === code) || null
  }

  const rfqItemCount = () => {
    const codes = parsePrItemCodeCsv(rfq()?.PurchaseRequisitionItemsCode)
    if (!codes.length) return 0
    const wanted = new Set(codes)
    return dataStore.getRecords('PurchaseRequisitionItems').filter((row) => wanted.has(text(row?.Code))).length
  }

  const lines = () => (Array.isArray(control('Lines')) ? control('Lines') : [])

  return {
    get actions () {
      if (step() === 2) return ['back', 'next']
      if (step() === 3) return ['back', 'submit']
      return ['cancel', 'next']
    },

    submitLabel: 'Save Quotation',

    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    next: () => {
      if (step() === 1) {
        const record = form()
        if (!text(record.RFQCode)) return { valid: false, message: 'Select the RFQ this reply answers.' }
        if (!text(record.SupplierCode)) return { valid: false, message: 'Select the supplier who replied.' }
        if (text(record.ResponseType).toUpperCase() === DECLINED && !text(record.DeclineReason)) {
          return { valid: false, message: 'A decline reason is required.' }
        }
      }
      return undefined
    },

    submit: () => {
      const record = form()
      const result = buildQuotationCaptureChainNodes({
        form: { ...record, ProcurementCode: text(rfq()?.ProcurementCode) || text(record.ProcurementCode) },
        items: lines(),
        rfqItemCount: rfqItemCount(),
        supplierRow: supplierRow(),
        procurement: procurement(),
        actorName: user.value?.name || user.value?.email || ''
      })


      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false

      return { successMsg: applied.successMsg }
    },

    successRoute: 'index'
  }
}
