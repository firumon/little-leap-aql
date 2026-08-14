import { isPlanned } from 'src/_resource/Operation/OutletVisits/composables/useVisitProgress'

/**
 * OutletVisits › ResourceActionEdit — JS modifier (tier 4: resource-level).
 *
 * A settled visit (COMPLETED / POSTPONED / CANCELLED) is a historical record: its
 * outcome, actor and timestamps are workflow stamps, so editing it would rewrite
 * history. The Edit FAB is therefore offered only while the visit is PLANNED.
 *
 * `show` is function-valued so it is re-evaluated per render through `evaluateProp`
 * — a cached boolean would freeze at whatever the record's Progress was on the first
 * resolve and stay stale after an action settles the visit in place.
 */
export default {
  show: (record) => isPlanned(record),
  label: 'Edit Visit'
}
