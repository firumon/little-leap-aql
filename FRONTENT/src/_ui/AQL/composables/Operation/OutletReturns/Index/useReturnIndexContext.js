import { computed, inject } from 'vue'
import { useResourceNav } from 'src/composables/resources/useResourceNav'
import { useAQLConfig } from 'src/_ui/AQL/composables/useAQLConfig'
import {
  outletName,
  skuName,
  quantityAndItem,
  dateAndUser
} from 'src/_ui/AQL/composables/Operation/OutletReturns/Index/useReturnRowPresets'

/**
 * OutletReturns › Index — the relay behind the three QUEUE list views.
 *
 * ── WHY THREE VIEWS ARE COMPONENTS AND TWO ARE PROP BLOCKS ──
 * `useListViews` auto-generates this resource's views from the `Progress` column: one view
 * per state, each filtering `Progress eq <state>`. For `Completed` and `Cancelled` that IS
 * the membership rule, so those two stay plain `PropsList<View>` blocks in the contract and
 * render the resolver's own already-filtered rows.
 *
 * The other three do not agree with it:
 *
 *   Submitted                     everything not completed and not cancelled — which
 *                                 includes the two LEGACY holding states the consumption
 *                                 path writes, and a `Progress eq SUBMITTED` filter hides
 *                                 every one of them.
 *   Awaiting Invoice Adjustment   required-and-not-done on the COMMERCIAL flag columns.
 *   Awaiting Warehouse Receipt    required-and-not-done on the PHYSICAL flag columns.
 *
 * The last two are questions about the two track flag PAIRS, not about the workflow state
 * at all: a return sitting in `SUBMITTED` with an unpaid credit belongs in the credit queue,
 * and a return with BOTH tracks open belongs in BOTH queues — which no single-valued
 * `Progress` filter can ever express. A view whose rows arrive pre-filtered by that rule can
 * only narrow it further, never widen it, so those three views render from the FULL record
 * set through this relay instead.
 *
 * Reading the unfiltered rows means the framework's own search never reaches them either,
 * so `filterReturns` applies the same live keyword — the identical arrangement the Outlets
 * index uses for its six summary views.
 *
 * The ONLY `inject()` caller behind those three components (§6.1).
 */

const text = (value) => (value == null ? '' : String(value).trim())

export function useReturnIndexContext () {
  const resourceRecord = inject('resourceRecord', null)
  const nav = useResourceNav()
  const ui = useAQLConfig()

  /**
   * Every return row, BEFORE the active view's filter.
   *
   * `records` rather than `filteredRecords` is the whole point: see the docblock. Rows are
   * already enriched (`$outlet`, `$sku.$product`), so the presets project them directly.
   */
  const records = computed(() => resourceRecord?.records?.value || [])

  const filterTerm = computed(() =>
    String(resourceRecord?.filterTerm?.value ?? '').trim().toLowerCase())

  return {
    ui,
    records,
    filterTerm,
    pending: computed(() => !!resourceRecord?.loading?.value),

    /**
     * Narrow rows by the live keyword.
     *
     * Matched against WHAT THE ROW SHOWS — the three lines the preset renders — plus the
     * code, so searching for something visible on screen finds it and searching for a
     * return code still works. Called by each view on the rows it was about to render, so
     * only the ACTIVE view pays for a keystroke; the other two are not mounted.
     */
    filterReturns: (rows) => {
      const keyword = filterTerm.value
      const list = Array.isArray(rows) ? rows : []
      if (!keyword) return list
      return list.filter((row) => [
        text(row?.Code),
        dateAndUser(row),
        outletName(row),
        quantityAndItem(row),
        skuName(row)
      ].join(' ').toLowerCase().includes(keyword))
    },

    /** Row tap opens the return — the same destination the default list click has. */
    openReturn: (code) => {
      const target = text(code)
      if (target) nav.goTo('view', { code: target })
    }
  }
}
