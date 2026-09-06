import {
  recentPreset,
  invoiceablePreset,
  completedPreset,
  cancelledPreset
} from 'src/_ui/AQL/composables/Operation/OutletConsumptions/Index/useConsumptionRowPresets'

// `InvoiceableOutlets` is a projection view, so it lives in its own `.vue` override.
// Each `Props<Identity>` below is a FUNCTION so it re-reads the active view's live rows.
export default {
  sections: [
    'PageHeader',
    'MetricCards',
    'Gauge',
    'AgeingBuckets',
    'ConsumptionVolume',
    'FilterInput',
    'ListSwitcher'
  ],
  contents: ['List'],

  PropsPageHeader: {
    title: 'Outlet Consumptions',
    subtitle: 'Stock consumptions · count, invoice, restock'
  },

  PropsListRecent: (props) => recentPreset(props.items),
  PropsListInvoiceable: (props) => invoiceablePreset(props.items),
  PropsListCompleted: (props) => completedPreset(props.items),
  PropsListCancelled: (props) => cancelledPreset(props.items)
}
