import { useAuth } from 'src/composables/core/useAuth'
import {
  draftsPreset,
  sentPreset,
  closedPreset,
  cancelledPreset
} from 'src/_ui/AQL/composables/Operation/RFQs/Index/useRFQRowPresets'

// Sections run in urgency order: my queue, response rate, pipeline, deadline age, work.
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
  PropsListSent: (props) => sentPreset(props.items),
  PropsListClosed: (props) => closedPreset(props.items),
  PropsListCancelled: (props) => cancelledPreset(props.items)
}
