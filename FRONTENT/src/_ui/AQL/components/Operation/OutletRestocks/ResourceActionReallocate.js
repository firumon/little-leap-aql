/**
 * OutletRestocks › ResourceActionReallocate — JS modifier (tier 4: resource-level).
 *
 * The sheet's `visibleWhen` already narrows this action to PARTIALLY_DELIVERED,
 * but that is a test on ONE COLUMN of the parent row and cannot ask the question
 * that actually matters here: are there any PENDING lines left to allocate?
 *
 * A PARTIALLY_DELIVERED request whose remaining lines are all ALLOCATED (awaiting
 * a second delivery run) has nothing to reallocate — offering the action there
 * walks the user into an empty allocation list and a `next` handler that vetoes
 * them straight back out. So the child rows are read here, which a `visibleWhen`
 * expression has no way to reach.
 *
 * `$OutletRestockItems` is the enriched record's relation getter: NON-ENUMERABLE
 * by design, so it is invisible to a spread but perfectly readable by name
 * (AQL_CUSTOM_UI_GUIDE §5.3). That is exactly why this cannot be a value bag —
 * the list has to be read off the live record, per render.
 *
 * `show` is function-valued so it is re-evaluated per render through
 * `evaluateProp`. A cached boolean would latch at first resolve and keep offering
 * the action after an allocation has settled the last PENDING line.
 */
const text = (value) => String(value ?? '').trim()

// `$OutletRestockItems` can carry `null` for a row whose Code has not landed yet
// — the same enrichment quirk `useRestockApproval.js` documents on `asRow`. A
// null must degrade to an empty object rather than being waved through one guard
// and dereferenced by the next.
const asRow = (value) => (value && typeof value === 'object' ? value : {})

// Unset Progress means PENDING: a line is created without one and only earns a
// state when it is allocated, delivered or cancelled.
function hasPendingItems (record) {
  const rows = record?.$OutletRestockItems
  if (!Array.isArray(rows)) return false
  return rows
    .map(asRow)
    .some((row) => text(row.Code) &&
      text(row.Status || 'Active') === 'Active' &&
      (text(row.Progress) || 'PENDING') === 'PENDING')
}

export default {
  show: (record) => text(record?.Progress) === 'PARTIALLY_DELIVERED' && hasPendingItems(record),
  label: 'Reallocate Pending Items'
}
