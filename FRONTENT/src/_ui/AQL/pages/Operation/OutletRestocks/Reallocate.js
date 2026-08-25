/**
 * OutletRestocks › Reallocate contract — `/operation/outlet-restocks/{code}/_action/reallocate`.
 *
 * An `_action/:action` route resolves its canonical page key to the ACTION NAME,
 * so this file is `Reallocate.js` (not `action.js`) and every placeholder beneath
 * it resolves under the `reallocate/` page tier —
 * `.../OutletRestocks/Reallocate/*` (UI_MODULE_DEVELOPER_GUIDE.md §2.1).
 *
 * Where `Approve` decides a request's fate, this page picks up one that has
 * already been decided. A PARTIALLY_DELIVERED request has some lines DELIVERED
 * and some still PENDING — never allocated, because there was no stock for them
 * at approval time. This is where those leftovers get their warehouse once stock
 * is back on the shelf.
 *
 * The request itself is NOT re-approved and does not move: the parent stays
 * PARTIALLY_DELIVERED and only its child lines (plus the stock movements they
 * imply) are written. That is why there is no Reject here and no approval
 * permission on the submit gate — see `Reallocate/PageAction.js`.
 *
 * Two steps, both driven from the sticky bar by `Reallocate/PageAction.js` so the
 * content cards stay pure inputs with no navigation of their own:
 *
 *   step 1  warehouse + per-SKU allocation  →  [ Cancel ] [ Continue      ]
 *   step 2  review allocated + remainders   →  [ Back   ] [ Allocate Stock ]
 *
 * The four content cards are the APPROVAL page's, reused verbatim. They sit at
 * the resource tier (`.../OutletRestocks/{Card}.vue`) rather than under
 * `Approve/`, precisely so both contracts resolve the same files — naming them
 * here is all it takes, with no copies and no renames. They already filter for
 * PENDING lines and render nothing when there are none, which is exactly the
 * behaviour this page needs.
 *
 * The step each card belongs to is declared HERE rather than hardcoded in the
 * card, so the flow can be re-ordered from the contract alone
 * (UI_PAGE_AND_SECTION_SYSTEM.md §1.4.1).
 *
 * There is no `Update` content: reallocating does not edit the request's fields,
 * it decides where the remaining stock comes from. `WarehouseAndLocation`
 * hydrates the record into pageState in `Update`'s place, via
 * `useRestockApproval`.
 */
export default {
  sections: ['PageHeader'],
  contents: [
    'WarehouseAndLocation',
    'ItemAllocating',
    'ReviewAllocating',
    'ReviewPending'
  ],

  // Declarative gating (useContentResolver / useSectionResolver). Each entry names the
  // registered action its route or its foreign resource actually needs; anything not
  // listed renders unconditionally, exactly as before.
  permissions: {
    WarehouseAndLocation: ['OutletRestocks:reallocate:$Code'],
    ItemAllocating: ['OutletRestocks:reallocate:$Code'],
    ReviewAllocating: ['OutletRestocks:reallocate:$Code', 'StockMovements:create'],
    ReviewPending: ['OutletRestocks:reallocate:$Code']
  },
  PropsPageHeader: {
    title: 'Reallocate Stock',
    reload: false
  },
  PropsWarehouseAndLocation: { step: 1 },
  PropsItemAllocating: { step: 1 },
  PropsReviewAllocating: { step: 2 },
  PropsReviewPending: { step: 2 }
}
