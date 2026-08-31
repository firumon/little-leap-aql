import { useAuth } from 'src/composables/core/useAuth'
import {
  draftsPreset,
  confirmedPreset,
  grnGeneratedPreset,
  cancelledPreset
} from 'src/_ui/AQL/composables/Operation/POReceivings/Index/useReceivingRowPresets'

// Sections run in urgency order: my queue, GRN rate, pipeline, backlog age, work.
const { user } = useAuth()

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

  PropsListDrafts: (props) => draftsPreset(props.items, user.value?.id),
  PropsListConfirmed: (props) => confirmedPreset(props.items),
  PropsListGrnGenerated: (props) => grnGeneratedPreset(props.items),
  PropsListCancelled: (props) => cancelledPreset(props.items)
}
