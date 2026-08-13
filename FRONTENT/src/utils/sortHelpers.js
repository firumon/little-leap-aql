/**
 * Shared, resource-agnostic sorting helpers.
 *
 * Lives in `src/utils/` rather than beside any one feature because sorting a list of
 * sheet rows by a date column is not resource knowledge — every list view in the app
 * wants the same semantics. A `_ui/` composable importing another `_ui` composable to
 * borrow a sort would be a cross-resource dependency (ARCHITECTURE RULES §5); importing
 * it from here is not.
 *
 * Every helper is PURE and may be called from a page contract or a JS modifier, neither
 * of which has a component setup context.
 */

import { parseAnyDate } from 'src/utils/dateHelpers'

/**
 * Sorts rows by a date-ish column without copying the rows.
 *
 * `[...items].sort()` builds a new ARRAY but carries the element references through, so
 * the enriched records keep their non-enumerable relation getters (`$outlet`, `_Parents`).
 * A `{ ...row }` copy here would silently strip them — see
 * AQL_PAGE_AND_SECTION_SYSTEM.md §1.3.3.
 *
 * Values are read through `parseAnyDate`, so both storage shapes AQL sheets use (epoch
 * milliseconds in audit columns, ISO strings in business date columns) sort together.
 *
 * Unparseable dates SINK TO THE END in both directions rather than riding NaN comparison
 * semantics, which would scatter them unpredictably through the list.
 *
 * `column` may be a READER as well as a key. A workflow row's "when did this last
 * move?" often is not one column — it is whichever stamp the row's current state wrote,
 * with a fallback for rows whose stamp was never filled in. Sorting by a single column
 * there puts every unstamped row at the end regardless of how old it actually is, which
 * contradicts the age the same rows display. Passing the same reader to both keeps the
 * order and the labels telling one story.
 *
 * @param {Array<Object>} items
 * @param {string|function(Object): *} column - the row key holding the date, or a
 *        function returning the value to sort by.
 * @param {'asc'|'desc'} [direction='asc']
 * @returns {Array<Object>} a new array; the row objects themselves are untouched.
 */
export function sortByDate (items, column, direction = 'asc') {
  const rows = Array.isArray(items) ? items : []
  const sign = direction === 'desc' ? -1 : 1
  const read = typeof column === 'function' ? column : (row) => row?.[column]

  return [...rows].sort((a, b) => {
    const left = parseAnyDate(read(a))
    const right = parseAnyDate(read(b))
    if (!left && !right) return 0
    if (!left) return 1
    if (!right) return -1
    return sign * (left - right)
  })
}
