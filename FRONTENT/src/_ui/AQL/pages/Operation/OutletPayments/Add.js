import {
  buildOutletPaymentInitNodes,
  canCollectInvoicePayment
} from 'src/_ui/AQL/composables/Operation/OutletPayments/Add/useOutletPaymentAddContext'

export default {
  sections: ['PageHeader'],
  contents: [
    'SelectOutlet',
    'SelectInvoices',
    'PayingAmount',
    'AutoApproveToggle',
    'InvoiceAllocation',
    'ModeReference'
  ],

  permissions: {
    SelectInvoices: ['OutletConsumptionInvoices'],
    AutoApproveToggle: ['OutletConsumptionInvoices:collectPayment'],
    InvoiceAllocation: ['OutletConsumptionInvoices:collectPayment']
  },

  PropsSelectOutlet: {
    suggestLimit: 7
  },

  PropsPageHeader: {
    title: 'Record Payment',
    reload: false
  },

  ready ({ pageState }) {
    pageState.resetForResource('OutletPayments')
    pageState.applyNodes(buildOutletPaymentInitNodes())
    pageState.setControls('AutoApprove', canCollectInvoicePayment())
  }
}
