/**
 * OutletRestocks › MarkDelivered contract — `/operation/outlet-restocks/{code}/_action/mark-delivered`.
 *
 * An `_action/:action` route resolves its canonical page key to the ACTION slug,
 * normalized through `toPascalCase(actionParam).toLowerCase()` — so the
 * `mark-delivered` route resolves to `markdelivered`, this file is
 * `MarkDelivered.js` (not `action.js`, and never `mark-delivered.js`), and every
 * placeholder beneath it resolves under the `MarkDelivered/` page tier
 * (UI_MODULE_DEVELOPER_GUIDE.md §2.1).
 *
 * Two steps, both driven from the sticky bar by `MarkDelivered/PageAction.js` so
 * the content cards stay pure inputs with no navigation of their own:
 *
 *   step 1  pick the items that arrived   →  [ Cancel ] [ Continue        ]
 *   step 2  review + GRN note             →  [ Back   ] [ Confirm Delivery ]
 *
 * The step each card belongs to is declared HERE rather than hardcoded in the
 * card, so the flow can be re-ordered from the contract alone
 * (UI_PAGE_AND_SECTION_SYSTEM.md §1.4.1).
 *
 * There is no `Update` content: confirming a delivery does not edit the request's
 * fields, it records which allocated lines arrived. `SelectDeliveryItems`
 * hydrates the record into pageState in `Update`'s place, via `useRestockDelivery`.
 */
export default {
  sections: ['PageHeader'],
  contents: [
    'SelectDeliveryItems',
    'ReviewDelivery'
  ],
  PropsPageHeader: {
    title: 'Confirm Delivery',
    reload: false
  },
  PropsSelectDeliveryItems: { step: 1 },
  PropsReviewDelivery: { step: 2 }
}
