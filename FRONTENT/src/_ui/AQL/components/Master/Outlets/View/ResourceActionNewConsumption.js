/**
 * Outlets › View › ResourceActionNewConsumption — JS modifier (tier CP: resource + page).
 *
 * Opens the consumption wizard with this outlet already chosen.
 *
 * ── WHY A HANDLER AND NOT JUST THE SHEET'S `navigate` BLOCK ──
 * The sheet's navigate config carries a target, a scope and a resource slug, but no query —
 * so on its own it opens the consumption wizard with no outlet chosen, and the user has to pick
 * the outlet whose page they just came from. `handler` REPLACES the container's click
 * behaviour outright (UI_ACTION_SYSTEM.md §3.4), which is the sanctioned way to add the
 * preselection without widening the config schema for one resource's sake.
 *
 * `outletCode` is the query key every outlet Add flow already reads — restock, consumption,
 * invoice and payment all seed from that one name. Inventing a second spelling here would
 * silently open an unseeded wizard that LOOKS correct.
 *
 * Eligibility is NOT re-derived here. Whether this item appears at all is decided by
 * `useAdditionalActions` from the sheet's permissions and `visibleWhen` (§8.6); this file
 * only decides where a click goes.
 */
export default {
  handler: ({ record, nav }) => {
    const code = String(record?.Code ?? record?.code ?? '').trim()
    nav.goTo('add', {
      scope: 'operation',
      resourceSlug: 'outlet-consumptions',
      query: code ? { outletCode: code } : {}
    })
  }
}
