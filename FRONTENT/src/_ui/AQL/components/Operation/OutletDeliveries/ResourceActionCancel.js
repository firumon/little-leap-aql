import { itemRowsForCodes } from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryRows'
import {
  canCancel,
  isDraft,
  orsisForDelivery
} from 'src/_resource/Operation/OutletDeliveries/composables/useDeliveryProgress'

/**
 * OutletDeliveries › ResourceActionCancel — JS modifier (tier C: resource-wide).
 *
 * ── WHY THIS FILE EXISTS ──
 * The sheet-level `visibleWhen` can test `Progress eq DRAFT`, and that is only HALF the
 * rule. A draft run whose first stop has already been delivered can no longer be cancelled:
 * those units are on a shelf and the ledger says so, and no cancellation un-hands-over
 * goods. That second half is a fact about `OutletRestockItems` rows joined through a CSV,
 * which no single-column `visibleWhen` can express (§8.1).
 *
 * Without this gate the FAB would offer "Cancel Delivery" on a part-delivered draft and the
 * submit would veto — a button that exists only to refuse.
 *
 * ── FAILING CLOSED IS THE POINT ──
 * `canCancel` returns `false` when it is handed no rows, which is exactly right while the
 * item sheet is still loading: offering an irreversible-looking action before its
 * precondition can be checked is worse than showing it a moment late.
 *
 * The rows come from the Layer 2 accessor (`useDeliveryRows`), which reads the cache without
 * a component setup — `useRecord` could not be used here, because it calls `useQuasar()`.
 * The rows are read and handed to Layer 2; no rule is decided locally.
 *
 * FUNCTION-VALUED so `evaluateProp` re-runs it per render — a driver delivering the first
 * stop while this page is open removes the button without a reload.
 */
export default {
  show: (record) => {
    if (!isDraft(record)) return false
    // A manifest carrying nothing has nothing handed over, so it is cancellable — but
    // `canCancel` needs an array to answer at all, so the empty case is passed explicitly.
    const rows = itemRowsForCodes(orsisForDelivery(record))
    return canCancel(record, rows)
  },
  label: 'Cancel Delivery'
}
