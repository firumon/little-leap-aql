// The sheet's `visibleWhen` can only test the parent row. Reallocate also needs the
// child lines, so `show` is a function and is re-read on every render.
const text = (value) => String(value ?? '').trim()

const asRow = (value) => (value && typeof value === 'object' ? value : {})

const REALLOCATABLE = ['APPROVED', 'PARTIALLY_DELIVERED']

// A line with no Progress is PENDING: it only earns a state once it is acted on.
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
  show: (record) => REALLOCATABLE.includes(text(record?.Progress)) && hasPendingItems(record),
  label: 'Reallocate Pending Items'
}
