/**
 * OutletRestocks › Approve contract — `/operation/outlet-restocks/{code}/_action/approve`.
 *
 * An `_action/:action` route resolves its canonical page key to the ACTION NAME,
 * so this file is `Approve.js` (not `action.js`) and every placeholder beneath it
 * resolves under the `approve/` page tier — `.../OutletRestocks/Approve/*`
 * (AQL_CUSTOM_UI_GUIDE §2.1).
 *
 * Two steps, both driven from the sticky bar by `Approve/PageAction.js` so the
 * content cards stay pure inputs with no navigation of their own:
 *
 *   step 1  warehouse + per-SKU allocation  →  [ Cancel ] [ Reject ] [ Continue ]
 *   step 2  review allocated + remainders   →  [ Back   ] [ Reject ] [ Approve  ]
 *
 * The step each card belongs to is declared HERE rather than hardcoded in the
 * card, so the flow can be re-ordered from the contract alone
 * (AQL_PAGE_AND_SECTION_SYSTEM.md §1.4.1).
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
