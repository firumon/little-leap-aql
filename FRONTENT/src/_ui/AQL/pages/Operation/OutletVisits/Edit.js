/**
 * OutletVisits › Edit — page JS modifier (tier CP: resource + page specific).
 *
 * A visit is only editable while it is still PLANNED, and only its schedule is
 * editable: Date and ProgressPlannedComment. Everything else on the row is either
 * identity (OutletCode — moving a visit to another outlet is a new visit, not an
 * edit) or a workflow stamp written by the Cancel/Postpone/Complete actions.
 *
 * The PLANNED gate is enforced in two places, deliberately:
 *   1. `_ui/.../OutletVisits/ResourceActionEdit.js` hides the Edit FAB, so a settled
 *      visit offers no route here.
 *   2. `_ui/.../OutletVisits/Edit/FormActionSubmit.js` disables Save, so pasting the
 *      `_edit` URL for a settled visit cannot write either.
 *
 * Only (2) is load-bearing; (1) is what makes the rule visible instead of a dead end.
 */
export default {
  sections: ['PageHeader'],
  contents: ['Update'],

  // Spread flat onto the `Update` content by useContentResolver — see
  // UI_PAGE_AND_SECTION_SYSTEM.md §1.4.1.
  PropsUpdate: {
    // `fields` fixes both the SET and the ORDER of the inputs.
    fields: ['Date', 'ProgressPlannedComment'],
    // ProgressPlannedComment ends in 'Comment', so Update's default
    // `workflowFields: 'hide'` strips it. `showFields` is the highest-precedence
    // visibility switch and re-admits that one field without turning every
    // workflow-stamp column on.
    showFields: ['ProgressPlannedComment'],
    withChildren: false,
    fieldProps: {
      Date: { required: true, label: 'Visit Date' },
      ProgressPlannedComment: { label: 'Planned Comment' }
    }
  }
}
