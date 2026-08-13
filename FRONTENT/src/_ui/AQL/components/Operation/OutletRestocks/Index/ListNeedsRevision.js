import RestockActionButtons from './RestockActionButtons.vue'

/**
 * OutletRestocks › Index › "Needs Revision" view — JS modifier.
 *
 * Mounts the row action cluster; every other prop for this view is `PropsListNeedsRevision`
 * in the page contract. See `ListDrafts.js` for why the two are split that way.
 *
 * A row here offers Edit (the revision) and Resubmit (the reply), which is the whole
 * revise-and-resubmit cycle without leaving the list. Both are ownership-gated on the
 * requester — the reviewer asked THEM for changes.
 */
export default {
  btn: RestockActionButtons
}
