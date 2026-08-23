import { canEditInvoice } from 'src/_resource/Operation/OutletConsumptionInvoices/composables/useInvoiceWorkflow'

export default {
  // Function-valued so it re-runs per render: an invoice paid while the page is open
  // loses the button without a reload.
  show: (record) => canEditInvoice(record),
  label: 'Edit Invoice'
}
