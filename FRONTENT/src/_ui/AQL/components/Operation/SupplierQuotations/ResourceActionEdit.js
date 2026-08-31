import { isEditable } from 'src/_resource/Operation/SupplierQuotations/composables/useSupplierQuotationProgress'

// A quotation is revisable only while nobody has acted on it.
export default {
  show: (record) => isEditable(record),
  label: 'Revise Quotation'
}
