import { useAuth } from 'src/composables/core/useAuth'
import {
  draftsPreset,
  awaitingApprovalPreset,
  needsRevisionPreset,
  approvedPreset,
  partiallyDeliveredPreset,
  pendingCompletionPreset,
  deliveredPreset,
  rejectedPreset
} from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockProgress'

/**
 * OutletRestocks › Index — page contract (tier CP: resource + page specific).
 *
 * The page answers three questions in descending order of urgency, and the section stack
 * is that order: what needs me now (`MetricCards`), how is the pipeline doing
 * (`LinearProgress`, `WorkflowFunnel`), how bad is the backlog (`AgeingBuckets`), then
 * the work itself (`FilterInput`, `ListSwitcher`, `List`). Every one of those sections
 * hides itself when it has nothing to say, so a tenant with no restocks yet sees a bare
 * list rather than a wall of zeroes.
 *
 * The eight list views are configured here as `Props<Identity>` blocks rather than as
 * standalone `List<View>.js` modifier files. A per-view override only needs its own file
 * when it brings a template (`ListPendingCompletion.vue`) or a component-valued prop
 * (`ListDrafts.js` / `ListPendingApproval.js` / `ListNeedsRevision.js` mount
 * `RestockActionButtons` as `btn`); a plain prop bag belongs in the page contract, where
 * the whole page's list behaviour reads in one place. See AQL_CUSTOM_UI_GUIDE.md §8.4.
 *
 * Each block is a FUNCTION, so it is evaluated with the live props bag on every read and
 * receives the active view's already-filtered `items` — which is what lets it re-sort
 * them. A static object could not see the rows, and a JS modifier (resolved once, then
 * cached) would freeze them at whatever the store held on first render.
 *
 * The four settled views (Approved, Delivered, Rejected, PartiallyDelivered) carry no
 * `btn`, so no row action cluster mounts and `contents/List.vue`'s default click handler
 * opens the View page.
 *
 * `useAuth()` is called at MODULE level, which is safe here for the same reason it is in
 * `ResourceActionEdit.js`: it only reaches Pinia stores and calls no `inject()`. `user`
 * stays a computed, so the blocks below read the LIVE session user at render time rather
 * than whoever was signed in when this module was first imported.
 */
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

  // The one view that is scoped to a PERSON rather than to a state — see `draftsPreset`.
  PropsListDrafts: (props) => draftsPreset(props.items, user.value?.id),
  PropsListPendingApproval: (props) => awaitingApprovalPreset(props.items),
  PropsListNeedsRevision: (props) => needsRevisionPreset(props.items),
  PropsListApproved: (props) => approvedPreset(props.items),
  PropsListPartiallyDelivered: (props) => partiallyDeliveredPreset(props.items),
  PropsListPendingCompletion: (props) => pendingCompletionPreset(props.items),
  PropsListDelivered: (props) => deliveredPreset(props.items),
  PropsListRejected: (props) => rejectedPreset(props.items)
}
