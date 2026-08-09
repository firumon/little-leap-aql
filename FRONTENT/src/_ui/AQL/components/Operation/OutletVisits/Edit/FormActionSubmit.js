import { isPlanned } from 'src/_ui/AQL/composables/Operation/OutletVisits/useVisitProgress'

/**
 * OutletVisits › Edit › FormActionSubmit — JS modifier (tier 2: resource + page).
 *
 * The hard half of the "editable only while PLANNED" rule. Hiding the Edit FAB
 * (ResourceActionEdit.js) removes the route; this removes the write, so pasting the
 * `_edit` URL for a settled visit cannot save.
 *
 * `disabled` is function-valued so `evaluateProp` re-runs it per render against the
 * live record, rather than latching the value at first resolve.
 */
export default {
  disabled: (record) => !isPlanned(record),
  label: 'Save Visit'
}
