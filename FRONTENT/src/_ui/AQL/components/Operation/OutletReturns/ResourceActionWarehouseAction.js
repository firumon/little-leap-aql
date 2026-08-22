import { canConfirmWarehouseAction } from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

/**
 * OutletReturns › ResourceActionWarehouseAction — JS modifier (tier C: resource-wide).
 *
 * ── WHY THIS FILE EXISTS ──
 * The sheet-level `visibleWhen` on this action tests ONE column —
 * `WarehouseActionCompleted eq FALSE` — and that is not the question. A return whose stock
 * never left the shelf also has `WarehouseActionCompleted = FALSE`, forever, because there
 * was never a warehouse action to complete. The sheet gate would therefore offer "Confirm
 * Warehouse Action" on every return that carries no physical track at all.
 *
 * Eligibility genuinely depends on two columns together, which `visibleWhen` cannot express,
 * so the real gate is this function-valued `show` reading the domain predicate
 * (UI_MODULE_DEVELOPER_GUIDE.md §8.1). The sheet gate stays as the coarse first filter; this
 * narrows it to the truth.
 *
 * `canConfirmWarehouseAction` is the same predicate `WarehouseActionCard.vue` renders its
 * lock banner from and `WarehouseAction/PageAction.js` re-checks on submit — three
 * consumers, one rule, so the button, the banner and the veto cannot disagree (§8.6).
 *
 * FUNCTION-VALUED so `evaluateProp` re-runs it per render: a return confirmed by another
 * operator while this page is open loses the button without a reload.
 */
export default {
  show: (record) => canConfirmWarehouseAction(record),
  label: 'Confirm Warehouse Action'
}
