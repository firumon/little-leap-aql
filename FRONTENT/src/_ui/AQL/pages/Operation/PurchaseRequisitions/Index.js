import { useAuth } from 'src/composables/core/useAuth'
import {
  draftsPreset,
  pendingApprovalPreset,
  needsRevisionPreset,
  approvedPreset,
  rfqProcessedPreset,
  rejectedPreset
} from 'src/_ui/AQL/composables/Operation/PurchaseRequisitions/Index/usePurchaseRequisitionRowPresets'

// Sections run in urgency order: my queue, pipeline health, backlog age, then the work.
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
  PropsListPendingApproval: (props) => pendingApprovalPreset(props.items),
  PropsListNeedsRevision: (props) => needsRevisionPreset(props.items),
  PropsListApproved: (props) => approvedPreset(props.items),
  PropsListRfqProcessed: (props) => rfqProcessedPreset(props.items),
  PropsListRejected: (props) => rejectedPreset(props.items)
}
