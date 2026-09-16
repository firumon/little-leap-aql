import { buildQuotationUpdateChainNodes } from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationPayload'
import { isEditable } from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationProgress'
import { parsePrItemCodeCsv } from 'src/_resource/Operation/RFQs/composables/useRFQProgress'
import { useRFQResource } from 'src/_resource/Operation/RFQs/composables/useRFQResource'
import { usePurchaseRequisitionResource } from 'src/_resource/Operation/PurchaseRequisitions/composables/usePurchaseRequisitionResource'

const NODE = 'SupplierQuotations'

const text = (value) => String(value ?? '').trim()

// [ Cancel ] [ Save Quotation ]
export default (props, { pageState, resourceRecord }) => {
  pageState.useNode(NODE)

  const { getRFQ } = useRFQResource()
  const { requisitionItemsByCodes } = usePurchaseRequisitionResource()

  const control = (key) => pageState.getControls(key, null, NODE)
  const form = () => control('Form') || {}

  const quotation = () => {
    const row = resourceRecord?.record?.value
    return text(row?.Code) ? row : null
  }

  const rfqItemCount = () => {
    const rfq = getRFQ(form().RFQCode)
    const codes = parsePrItemCodeCsv(rfq?.PurchaseRequisitionItemsCode)
    if (!codes.length) return 0
    return requisitionItemsByCodes(codes).length
  }

  return {
    actions: ['cancel', 'submit'],
    submitLabel: 'Save Quotation',

    cancel: (name, { nav }) => {
      nav.goTo('view')
      return false
    },

    submit: () => {
      const record = quotation()
      if (!record) return { valid: false, message: 'This quotation could not be loaded.' }
      if (!isEditable(record)) {
        return { valid: false, message: 'This quotation has been decided and can no longer be revised.' }
      }

      const result = buildQuotationUpdateChainNodes({
        quotation: record,
        form: form(),
        items: Array.isArray(control('Lines')) ? control('Lines') : [],
        rfqItemCount: rfqItemCount()
      })


      const applied = pageState.applyNodes(result)
      if (applied.valid === false) return false

      return { successMsg: applied.successMsg }
    },

    successRoute: 'view'
  }
}
