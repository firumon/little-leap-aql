import { itemRowsForCodes } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryRows'
import {
  canComplete,
  isInTransit,
  orsisForDelivery
} from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

/**
 * OutletDeliveries › ResourceActionMarkComplete — JS modifier (tier C: resource-wide).
 *
 * ── WHY THIS FILE EXISTS ──
 * The sheet-level `visibleWhen` can test `Progress eq IN_TRANSIT`, and that is not the
 * question. Completing a run requires that EVERY line on it is already delivered — a fact
 * that lives on `OutletRestockItems`, an entirely different resource, joined through a CSV.
 * No single-column `visibleWhen` can express that, so the real gate is this function-valued
 * `show` reading the domain predicate (§8.1's "a sheet-level `visibleWhen` may not be
 * enough").
 *
 * Without it the FAB would offer "Complete Delivery" on every in-transit run, including ones
 * with half their load still on the van — and the submit would then veto, which is the
 * failure mode §8.1 exists to avoid: a button that exists only to refuse.
 *
 * ── AND WHY THAT MATTERS MORE HERE THAN ELSEWHERE ──
 * This route is a SAFETY NET: delivery auto-closes a finished run, so on healthy data the
 * action should never appear. Its appearing is the signal that a manifest needs a human.
 * A gate that showed it constantly would destroy exactly that signal.
 *
 * The rows come from the Layer 2 accessor (`useDeliveryRows`), which reads the cache without
 * a component setup — `useRecord` could not be used here, because it calls `useQuasar()`.
 * The rows are read and handed to Layer 2; no rule is decided locally.
 *
 * FUNCTION-VALUED so `evaluateProp` re-runs it per render — the last delivery landing while
 * the page is open removes the button without a reload.
 */
export default {
  show: (record) => {
    if (!isInTransit(record)) return false
    // Only this manifest's rows — the predicate measures delivered-against-total over them.
    // Empty means the item sheet has not loaded yet, so this FAILS CLOSED rather than
    // letting `canComplete` judge a run it cannot see.
    const rows = itemRowsForCodes(orsisForDelivery(record))
    if (!rows.length) return false
    return canComplete(record, rows)
  },
  label: 'Complete Delivery'
}
