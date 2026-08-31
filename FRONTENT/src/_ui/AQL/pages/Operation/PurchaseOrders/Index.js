import {
  openPreset,
  receivingPreset,
  completedPreset,
  cancelledPreset
} from 'src/_ui/AQL/composables/Operation/PurchaseOrders/Index/usePurchaseOrderRowPresets'

// Sections run in urgency order: my queue, fulfilment rate, pipeline, ageing, work.
export default {
  sections: [
    'PageHeader',
    'MetricCards',
    'LinearProgress',
    'WorkflowFunnel',
    'AgeingBuckets',
    'FilterInput',
    'ListSwitcher'
  ],
  contents: ['List'],

  PropsListOpen: (props) => openPreset(props.items),
  PropsListReceiving: (props) => receivingPreset(props.items),
  PropsListCompleted: (props) => completedPreset(props.items),
  PropsListCancelled: (props) => cancelledPreset(props.items)
}
