import {
  receivedPreset,
  acceptedPreset,
  rejectedPreset
} from 'src/_ui/AQL/composables/Operation/SupplierQuotations/Index/useQuotationRowPresets'

// Sections run in urgency order: my queue, acceptance rate, pipeline, backlog age, work.
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

  PropsListReceived: (props) => receivedPreset(props.items),
  PropsListAccepted: (props) => acceptedPreset(props.items),
  PropsListRejected: (props) => rejectedPreset(props.items)
}
