import { toDateTime24 } from 'src/utils/dateHelpers'
import { useAuth } from 'src/composables/core/useAuth'
import { restockEditableProgress } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockProgress'

/**
 * OutletRestocks › Edit › PageAction — JS modifier (tier 1: resource + page).
 *
 * The Edit page is a single view, not a wizard, so the bar is the plain pair:
 *
 *   [ Cancel ]  [ Resubmit / Save Draft ]
 *
 * `Resubmit` rather than `Save`, because that is what saving an edited restock
 * actually does: the only reason a request is editable is that it came back for
 * revision, and sending it on is the point of the page. `Save Draft` is the
 * secondary intent set by `EditSubmitOptions.vue`'s toggle, which offers it only
 * on a DRAFT — same pairing the Add wizard's `SubmitOptions.vue` offers on its
 * final step. `submitLabel` is a
 * getter for the same reason `Add/PageAction.js` uses one — `useActionResolver`
 * merges this factory's result inside a `computed`, so a getter is re-read on
 * recompute while a literal would latch whatever was true at resolve time
 * (AQL_ACTION_SYSTEM.md §1.3).
 *
 * Only `submit` is intercepted; `cancel` goes to the list rather than the
 * dispatcher's `goBack()`, since abandoning an edit should not replay whatever
 * history brought the user here.
 *
 * `Date`, `ProgressSubmittedAt` and `ProgressSubmittedBy` are stamped HERE, under
 * the hood, never exposed as form fields — the same rule the Add wizard follows,
 * so a resubmission cannot be back-dated or attributed to someone else. A draft
 * is not a submission, so it gets neither stamp — the same reasoning
 * `Add/PageAction.js` applies: leaving them empty is what lets a later real
 * submit record when it actually happened.
 */
export default (props, { pageState, resourceConfig }) => {
  const parent = pageState.useNode('OutletRestocks')
  const itemEntries = parent.children('OutletRestockItems')
  // Safe outside setup: `useAuth` only reaches Pinia stores and statically
  // imported Quasar plugins — it calls no `inject()`. `user` stays a computed,
  // so reading it at submit time gives the live session user.
  const { user } = useAuth()

  const isDraft = () => pageState.getControlField('OutletRestocks', 'isDraft') === true
  const items = () => itemEntries.value.filter((entry) => entry._action !== 'deactivate')

  // Same invariant the Add wizard enforces: an edit that zeroes every line is a
  // cancellation, and cancelling is a workflow action, not a save.
  function validateItems () {
    const lines = items()
    if (!lines.length || !lines.some((entry) => Number(entry.data.Quantity) > 0)) {
      return { valid: false, message: 'Add at least one item with a quantity greater than zero.' }
    }
    return null
  }

  return {
    actions: ['cancel', 'submit'],

    get submitLabel () { return isDraft() ? 'Save Draft' : 'Resubmit' },

    cancel: (name, { nav }) => {
      nav.goTo('index')
      return false
    },

    submit: () => {
      const invalid = validateItems()
      if (invalid) return invalid
      if (!restockEditableProgress(parent.record.value.Progress)) {
        return { valid: false, message: 'Only restock requests in Draft or Revision Required state can be edited.' }
      }
      if (!resourceConfig?.allowed('update')) {
        return { valid: false, message: 'You are not allowed to edit this restock request.' }
      }

      const draft = isDraft()

      // The comment is already on the node (written by `EditSubmitOptions`), so
      // it rides along in the payload; Progress plus the submission stamps are
      // decided here. It is never REQUIRED: a resubmission is a workflow fact,
      // and stamping who/when must not hinge on whether the user had anything to
      // say about it.
      pageState.setFields('OutletRestocks', {
        Progress: draft ? 'DRAFT' : 'PENDING_APPROVAL',
        ...(draft ? {} : {
          Date: new Date().toISOString().slice(0, 10),
          ProgressSubmittedAt: toDateTime24(new Date()),
          ProgressSubmittedBy: user.value?.name || user.value?.email || ''
        })
      })

      return { successMsg: draft ? 'Restock request saved as draft.' : 'Restock request resubmitted.' }
    }
  }
}
