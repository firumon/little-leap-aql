# PROCUREMENT Sheet Structure

## Purpose
This document describes the procurement-related sheet families used for purchasing workflow.

## Current Procurement Resources
- `Procurements`
- `PurchaseRequisitions`
- `PurchaseRequisitionItems`
- `RFQs`
- `RFQSuppliers`
- `SupplierQuotations`
- `SupplierQuotationItems`
- `PurchaseOrders`
- `PurchaseOrderItems`
- `POFulfillments`

## Structural Expectations
- parent/child workflow sheets are used across the procurement process
- workflow/progress tracking may require action/progress columns depending on current configuration

## RFQ Supplier Assignment/Send Lifecycle
- **Assignment**: Suppliers are selected for an RFQ and rows are created in `RFQSuppliers` with `Progress = ASSIGNED`.
- **Mark As Sent**: Assigned suppliers are dispatched. `Progress` becomes `SENT` and `SentDate` is stamped with today.
- **Workflow Advancement**: Once all active `RFQSuppliers` rows for an RFQ are no longer in `ASSIGNED` state (i.e. they are sent or beyond), the parent `Procurements` record advances to `RFQ_SENT_TO_SUPPLIERS`. If a supplier quotation is captured before manual dispatch, the quotation save performs this same `ASSIGNED` -> `SENT` transition before marking the supplier as responded.
- **Close Action**: RFQs support a `Close` AdditionalAction from `SENT` to `CLOSED`. PO creation may offer this action when active PO quantities exactly cover all RFQ item quantities. Closing an RFQ prevents it from appearing in future Supplier Quotation creation.

## Supplier Quotation Response Capture
- **Header Sheet**: `SupplierQuotations` stores normalized supplier responses with `Code`, `ProcurementCode`, `RFQCode`, `SupplierCode`, `ResponseType`, response/term fields, `AllowPartialPO`, `SupplierQuotationReference`, controlled `ExtraChargesBreakup` JSON, `TotalAmount`, `Progress`, reject tracking columns, response recording columns, `Status`, `AccessRegion`, and audit columns.
- **Item Sheet**: `SupplierQuotationItems` stores quoted line rows with `SupplierQuotationCode`, `PurchaseRequisitionItemCode`, `SKU`, `Description`, `Quantity`, `UnitPrice`, `TotalPrice`, item lead/delivery fields, `Remarks`, `Status`, and audit columns.
- **Response Types**: `QUOTED` requires all RFQ purchase requisition items to have quote data; `PARTIAL` permits missing item rows; `DECLINED` requires a decline reason and does not require item rows.
- **First Save Workflow**: The first saved quotation response marks the matching `RFQSuppliers` row as `RESPONDED`. If the matching row is still `ASSIGNED`, it first stamps blank `SentDate`, moves the row to `SENT`, advances the linked `Procurements` row from `RFQ_GENERATED` to `RFQ_SENT_TO_SUPPLIERS` when applicable, then marks the row `RESPONDED`. It advances the linked `Procurements` row from `RFQ_SENT_TO_SUPPLIERS` to `QUOTATIONS_RECEIVED`. Later quotation edits do not repeat those workflow updates, but the view page allows editing `AllowPartialPO` and `SupplierQuotationReference`.
- **Reject Action**: `SupplierQuotations` supports a `Reject` additional action only from `RECEIVED`; it sets `Progress = REJECTED` and records `ProgressRejectedComment`, `ProgressRejectedAt`, and `ProgressRejectedBy`.

## Purchase Order
- **Header Sheet**: `PurchaseOrders` stores `Code`, `ProcurementCode`, `SupplierQuotationCode`, `SupplierCode`, `PODate`, `ShipToWarehouseCode`, `Progress`, progress tracking triplets for `Sent`, `Acknowledged`, `Accepted`, and `Cancelled`, then `Currency`, `SubtotalAmount`, `ExtraChargesBreakup`, `TotalAmount`, `Remarks`, `Status`, `AccessRegion`, audit columns.
- **Item Sheet**: `PurchaseOrderItems` stores `Code`, `PurchaseOrderCode`, `SupplierQuotationItemCode`, `SKU`, `Description`, `UOM`, `QuotedQuantity`, `OrderedQuantity`, `UnitPrice`, `SupplierItemCode`, `Remarks`, `Status`, audit columns.
- **Purchase Order Features**: `AllowPartialPO` decides if users can partially order. Remaining quantities compute in frontend from `SupplierQuotationItems.Quantity - SUM(PurchaseOrderItems.OrderedQuantity)`. Closed POs consume ordered quantity, Cancelled do not. Generates via standard generic APIs. Progress is tracked via `AdditionalActions`. Creating a PO updates the source quotation to `ACCEPTED` and can close the source RFQ through confirmation when RFQ quantities are fully covered. Confirmed RFQ close records `ProgressClosedComment` as `<user_name>/system: "Complete purchase order created, hence closing RFQ"` with action audit fields. Cancelling a PO marks matching `RFQSuppliers` as `CANCELLED`; if no other active non-cancelled PO exists for a `PO_ISSUED` procurement, the procurement returns to `QUOTATIONS_RECEIVED`. If the RFQ was `CLOSED`, it returns to `SENT` and clears `ProgressClosedComment`.

## Canonical Detail Owners
- Workflow detail: [GROUND_OPERATIONS_WORKFLOW.md](F:/LITTLE%20LEAP/AQL/Documents/GROUND_OPERATIONS_WORKFLOW.md)
- Resource metadata rules: [RESOURCE_COLUMNS_GUIDE.md](F:/LITTLE%20LEAP/AQL/Documents/RESOURCE_COLUMNS_GUIDE.md)

## Maintenance Rule
Update this file when:
- a procurement sheet is added, removed, or repurposed
- procurement structure expectations change materially
