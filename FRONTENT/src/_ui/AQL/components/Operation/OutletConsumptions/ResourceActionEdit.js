/**
 * OutletConsumptions › ResourceActionEdit — JS modifier (tier 3: resource-wide).
 *
 * Suppresses the Edit FAB on EVERY page of this resource.
 *
 * A consumption is an immutable record of what was physically on a shelf at one moment.
 * Editing one would rewrite a measurement after the fact — silently changing what an
 * invoice was raised against, what stock was deducted from the outlet ledger, and what an
 * approver already read on a restock derived from it. None of those downstream effects is
 * rewritten by editing the parent row, so an Edit page could only ever produce a record
 * that disagrees with its own consequences.
 *
 * The supported correction is a NEW audit: recount the shelf and record what is actually
 * there now. That is also why `buildConsumptionCancellationNodes` deliberately writes no reversing
 * stock movements — cancelling an audit does not un-observe it.
 *
 * PLACED AT THE RESOURCE TIER (§3.1), not per page, because the rule is a property of the
 * resource rather than of any one screen: a later page added to this module inherits the
 * lock by existing, instead of having to remember it.
 *
 * `show` is declared as a plain `false` rather than a function. §3.3's "return a
 * function-valued prop" rule exists for values that must TRACK the record; this one is
 * invariant — no state of any consumption ever makes it editable — so a literal is
 * correct and a closure would imply a condition that does not exist.
 *
 * There is no matching backend permission to remove: `canUpdate` still governs the
 * programmatic update path that the submit handlers legitimately use to stamp Progress
 * columns. This suppresses the user-facing entry point only, which is the thing that would
 * otherwise offer an edit form nobody should fill in.
 */
export default {
  show: false
}
