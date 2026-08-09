/**
 * OutletRestocks › progress vocabulary.
 *
 * The progress states a restock request can be in, and the predicates that
 * decide what is safe to do with it. Resource-specific workflow rules belong
 * here (under `_ui/`), so the pages and components never re-derive "can this be
 * edited?" from booleans scattered across the feature.
 *
 * Named PURE exports — importable from a page contract or a JS modifier; the
 * composable wrapper exists for setup-context callers (AQL_CUSTOM_UI_GUIDE §2.2).
 */

// A restock may be edited only while it is a Draft or has come back for
// Revision Required. Every other state (Pending Approval, Approved, Rejected,
// …) is a settled workflow stamp: editing it would rewrite what approvers
// already saw or decided.
export function restockEditableProgress (progress) {
  return progress === 'DRAFT' || progress === 'REVISION_REQUIRED'
}

// Composable shape for setup-context callers. Same function, one import.
export function useRestockProgress () {
  return { restockEditableProgress }
}