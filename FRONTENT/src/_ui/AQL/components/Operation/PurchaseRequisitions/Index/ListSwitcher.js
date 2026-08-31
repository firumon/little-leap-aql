import { listSwitcherModifier } from 'src/_ui/AQL/composables/Operation/useListSwitcherGating'

// Drafts and revisions belong to the requester; the approval queue belongs to approvers.
export default listSwitcherModifier('PurchaseRequisitions', {
  Drafts: { any: ['create'] },
  PendingApproval: { any: ['approve'] },
  NeedsRevision: { any: ['create'] }
})
