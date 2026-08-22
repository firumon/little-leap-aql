import { isEditable } from 'src/_resource/Operation/OutletReturns/composables/useReturnProgress'

/**
 * OutletReturns › ResourceActionEdit — JS modifier (tier C: resource-wide).
 *
 * Hides the Edit FAB on a return that has come to rest. A completed return has had both its
 * tracks reconciled and a cancelled one has had its ledger movement reversed; editing
 * either would rewrite the facts an invoice or a warehouse already acted on.
 *
 * PLACEMENT — the resource tier, not a page folder: the FAB cluster appears on the Index
 * rows' target and on the View page alike, and the gate must hold on both.
 *
 * `show` is FUNCTION-VALUED so `evaluateProp` re-runs it per render (§8.1) — a record that
 * completes while the page is open loses the button without a reload.
 *
 * ── NO OWNERSHIP CLAUSE ──
 * §8.1 pairs state with ownership where an action rewrites what someone else will read as
 * the record owner's own words. That is not this: a return is a shared operational fact,
 * not a personal draft, and correcting a mis-keyed quantity is exactly the job of whoever
 * finds it. `RecordAccessPolicy: OWNER_AND_UPLINE` already bounds who sees the row at all,
 * and the resource's own `update` permission bounds who may write it. Adding an author-only
 * gate here would stop a supervisor fixing an officer's typo.
 *
 * The same `isEditable` drives `Edit/EditLockBanner.vue`, so the button and the banner
 * cannot disagree (§8.6).
 */
export default {
  show: (record) => isEditable(record),
  label: 'Edit'
}
