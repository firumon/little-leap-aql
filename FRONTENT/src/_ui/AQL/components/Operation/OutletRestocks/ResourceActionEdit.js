import { restockEditableProgress } from 'src/_ui/AQL/composables/Operation/OutletRestocks/useRestockProgress'

/**
 * OutletRestocks › ResourceActionEdit — JS modifier (tier 4: resource-level).
 *
 * A restock request may be revised only while it is a DRAFT or has come back for
 * REVISION_REQUIRED. In every other state the request is a settled workflow stamp,
 * so the Edit FAB is offered only in those two states.
 *
 * `show` is function-valued so it is re-evaluated per render through `evaluateProp`
 * — a cached boolean would freeze at whatever the record's Progress was on the first
 * resolve and stay stale after a workflow action moves the request in place.
 */
export default {
  show: (record) => restockEditableProgress(record?.Progress),
  label: 'Edit Restock'
}