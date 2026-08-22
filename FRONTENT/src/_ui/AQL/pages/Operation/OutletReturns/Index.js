import {
  submittedPreset,
  awaitingInvoicePreset,
  awaitingWarehousePreset,
  completedPreset,
  cancelledPreset
} from 'src/_ui/AQL/composables/Operation/OutletReturns/Index/useReturnRowPresets'

export default {
  sections: [
    'PageHeader',
    'MetricCards',
    'WorkflowFunnel',
    'FilterInput',
    'ListSwitcher'
  ],
  contents: ['List'],

  PropsPageHeader: {
    title: 'Outlet Returns'
  },

  PropsSection: (pageProps) => ({ gutter: pageProps.gutter }),

  // Block names must match the sheet's ListViews `name` values or the row shape is ignored.
  PropsListSubmitted: (props) => submittedPreset(props.items),
  PropsListAwaitingInvoiceAdjustment: (props) => awaitingInvoicePreset(props.items),
  PropsListAwaitingWarehouseReceipt: (props) => awaitingWarehousePreset(props.items),
  PropsListCompleted: (props) => completedPreset(props.items),
  PropsListCancelled: (props) => cancelledPreset(props.items)
}
