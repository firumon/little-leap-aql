/**
 * OutletConsumptionInvoices › MarkPaid contract —
 * `/operation/outlet-consumption-invoices/{code}/_action/mark-paid`.
 *
 * An `_action/:action` route resolves its page key to the ACTION slug normalized through
 * `toPascalCase(actionParam).toLowerCase()` — `mark-paid` resolves to `markpaid`, so this
 * file is `MarkPaid.js` (UI_MODULE_DEVELOPER_GUIDE.md §2.1).
 *
 *   single step   reason + amount + note   →   [ Cancel ] [ Settle Invoice ]
 *
 * ── WHY THIS IS A ROUTE AND NOT A DIALOG ──
 * Money alone can no longer close an invoice that still owes something: a residue of one
 * cent keeps it PARTIALLY_PAID. This route is the ONLY way from there to PAID, so it is the
 * page where the difference gets a name — and the user must see WHAT is being written off
 * before naming it. A dialog could collect the same three fields but could not show the
 * billed / collected / outstanding split beside them, and it could not enforce the rule that
 * `Other` demands an explanation, because the generic action pipeline validates presence
 * only.
 *
 * `SettleBalance` is the HYDRATION POINT (§5.5): an action route's resolver fetches the
 * invoice alone, so the card opens the payments it needs to derive the balance from.
 *
 * `reload: false` — consistent with every other transactional route in the module, so a
 * reader never finds a reload control on a page that is mid-commit (§5.5).
 */
export default {
  sections: ['PageHeader'],
  contents: ['SettleBalance'],

  PropsPageHeader: {
    title: 'Settle Invoice',
    reload: false
  }
}
