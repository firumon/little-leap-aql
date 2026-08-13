import RestockActionButtons from './RestockActionButtons.vue'

/**
 * OutletRestocks › Index › "Awaiting Approval" view — JS modifier.
 *
 * Mounts the row action cluster; every other prop for this view is `PropsListPendingApproval`
 * in the page contract. See `ListDrafts.js` for why the two are split that way.
 *
 * Approve / Request Revision / Reject all reach the row from here. WHICH of them a given
 * user sees is `useAdditionalActions`' decision, not this file's — an approver gets the
 * full set, a requester browsing their own submitted request gets none and the cluster
 * renders nothing.
 */
export default {
  btn: RestockActionButtons
}
