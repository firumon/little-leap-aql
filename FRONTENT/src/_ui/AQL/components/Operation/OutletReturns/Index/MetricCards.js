import {
  isActiveRow,
  isOpen,
  invoiceAdjustmentRequired,
  invoiceAdjustmentDone,
  warehouseActionRequired,
  warehouseActionCompleted
} from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

/**
 * OutletReturns › Index › MetricCards — JS modifier (tier CP: resource + page).
 *
 * Four counts, each an OPEN QUEUE SOMEONE OWNS, so every card answers "is there work for
 * me right now?". Completed and cancelled totals are history and belong to the funnel
 * below, which shows them in proportion rather than as a number to be proud of
 * (§9.2's actionable-queue constraint).
 *
 * The four are deliberately NOT four slices of one number. "Unresolved" is the headline;
 * the two beneath it name WHICH track is holding those returns open, which is the fact
 * that decides who has to act — an invoice backlog is a finance job, a warehouse backlog is
 * a logistics one. The two can overlap (a return may owe both), so they do not sum to the
 * headline, and they are not presented as if they did. The fourth counts OUTLETS rather
 * than rows, because a hundred returns across two outlets is a different day's work from a
 * hundred across forty.
 *
 * ── WHY `isOpen` AND NOT `Progress === SUBMITTED` ──
 * Live data holds unresolved returns in three non-terminal states, not one: the
 * consumption path has always written the legacy `AWAITING_WAREHOUSE_RECEIPT`. Counting
 * the literal would under-report every return a consumption ever raised. See
 * `LEGACY_STATES` in the vocabulary file.
 *
 * `items` is FUNCTION-VALUED because a JS modifier is invoked ONCE, at resolve time, and
 * its return is cached by `useSectionResolver`. A plain array would freeze at whatever the
 * store held on that first tick — usually empty, since the page resolves its sections
 * before the fetch settles. The closure re-runs on every render, so the counts track the
 * store.
 *
 * Counted from `records` (every row this user may see), NOT `filteredRecords`: these cards
 * are the reason to switch views, so they must not change when a view is switched (§9.2
 * rule 4).
 *
 * ── ON THE SHARED ROW GATE ──
 * `isActiveRow` is this resource's whole eligibility predicate, applied identically by
 * every widget on the page (§9.2 rule 3). There is no owner-scoping clause of the kind
 * `OutletRestocks` needs: a return has no DRAFT state, so there is no half-finished row
 * that would leak one person's unsubmitted work into another's count.
 */
export default function (props, { resourceRecord }) {
  return {
    items: () => {
      const records = resourceRecord?.records?.value
      if (!records || !records.length) return []

      let unresolved = 0
      let awaitingInvoice = 0
      let awaitingWarehouse = 0
      const outlets = new Set()

      for (const row of records) {
        if (!isActiveRow(row)) continue
        if (!isOpen(row)) continue

        unresolved++

        if (invoiceAdjustmentRequired(row) && !invoiceAdjustmentDone(row)) awaitingInvoice++
        if (warehouseActionRequired(row) && !warehouseActionCompleted(row)) awaitingWarehouse++

        const outletCode = String(row?.OutletCode ?? '').trim()
        if (outletCode) outlets.add(outletCode)
      }

      // The all-or-nothing guard, and the widget's last statement before the return
      // (§9.2 rule 2). A single live figure keeps the whole set on screen — the zeroes
      // beside it are then real context rather than noise.
      if (!unresolved && !awaitingInvoice && !awaitingWarehouse && !outlets.size) return []

      return [
        { label: 'Unresolved Returns', number: unresolved, color: 'warning' },
        { label: 'Awaiting Invoice Credit', number: awaitingInvoice, color: 'info' },
        { label: 'Awaiting Warehouse', number: awaitingWarehouse, color: 'purple' },
        { label: 'Outlets Affected', number: outlets.size, color: 'primary' }
      ]
    }
  }
}
