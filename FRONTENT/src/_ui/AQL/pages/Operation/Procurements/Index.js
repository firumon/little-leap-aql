import {
  inFlightPreset,
  settledPreset
} from 'src/_ui/AQL/composables/Operation/Procurements/Index/useProcurementRowPresets'

// The lifecycle board: how many are moving, where they sit, how long they have sat.
export default {
  sections: ['PageHeader', 'MetricCards', 'WorkflowFunnel', 'AgeingBuckets', 'FilterInput', 'ListSwitcher'],
  contents: ['List'],

  PropsListInFlight: (props) => inFlightPreset(props.items),
  PropsListCompleted: (props) => settledPreset(props.items),
  PropsListCancelled: (props) => settledPreset(props.items)
}
