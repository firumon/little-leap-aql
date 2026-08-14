/**
 * OutletRestocks › Approve contract — `/operation/outlet-restocks/{code}/_action/approve`.
 *
 * An `_action/:action` route resolves its canonical page key to the ACTION NAME,
 * so this file is `Approve.js` (not `action.js`) and a placeholder beneath it may
 * resolve under the `approve/` page tier — `.../OutletRestocks/Approve/*`
 * (UI_MODULE_DEVELOPER_GUIDE.md §2.1). `PageAction` and `FormActionReject` live there,
 * because the sticky bar IS approval-specific.
 *
 * The four content cards do NOT. They sit one level up at the RESOURCE tier
 * (`.../OutletRestocks/*.vue`) so that `Reallocate.js` resolves the very same
 * files: reallocating leftovers on a PARTIALLY_DELIVERED request is the same
 * decision as allocating at approval time, and two copies would drift. Anything
 * genuinely approve-only belongs in `Approve/`, which outranks the resource tier.
 *
 * Two steps, both driven from the sticky bar by `Approve/PageAction.js` so the
 * content cards stay pure inputs with no navigation of their own:
 *
 *   step 1  warehouse + per-SKU allocation  →  [ Cancel ] [ Reject ] [ Continue ]
 *   step 2  review allocated + remainders   →  [ Back   ] [ Reject ] [ Approve  ]
 *
 * The step each card belongs to is declared HERE rather than hardcoded in the
 * card, so the flow can be re-ordered from the contract alone
 * (UI_PAGE_AND_SECTION_SYSTEM.md §1.4.1).
 *
 * There is no `Update` content: an approval does not edit the request's fields,
 * it decides where its stock comes from. `WarehouseAndLocation` hydrates the
 * record into pageState in `Update`'s place, via `useRestockApproval`.
 */
export default {
  sections: ['PageHeader'],
  contents: [
    'WarehouseAndLocation',
    'ItemAllocating',
    'ReviewAllocating',
    'ReviewPending'
  ],
  PropsPageHeader: {
    title: 'Approve Restock',
    reload: false
  },
  PropsWarehouseAndLocation: { step: 1 },
  PropsItemAllocating: { step: 1 },
  PropsReviewAllocating: { step: 2 },
  PropsReviewPending: { step: 2 }
}
