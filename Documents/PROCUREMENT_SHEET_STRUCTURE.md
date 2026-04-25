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
- **Workflow Advancement**: Once all active `RFQSuppliers` rows for an RFQ are no longer in `ASSIGNED` state (i.e. they are sent or beyond), the parent `Procurements` record advances to `RFQ_SENT_TO_SUPPLIERS`.

## Supplier Quotation Response Capture
- **Header Sheet**: `SupplierQuotations` stores normalized supplier responses with `Code`, `ProcurementCode`, `RFQCode`, `SupplierCode`, `ResponseType`, response/term fields, controlled `ExtraChargesBreakup` JSON, `TotalAmount`, `Progress`, reject tracking columns, response recording columns, `Status`, `AccessRegion`, and audit columns.
- **Item Sheet**: `SupplierQuotationItems` stores quoted line rows with `SupplierQuotationCode`, `PurchaseRequisitionItemCode`, `SKU`, `Description`, `Quantity`, `UnitPrice`, `TotalPrice`, item lead/delivery fields, `Remarks`, `Status`, and audit columns.
- **Response Types**: `QUOTED` requires all RFQ purchase requisition items to have quote data; `PARTIAL` permits missing item rows; `DECLINED` requires a decline reason and does not require item rows.
- **First Save Workflow**: The first saved quotation response marks the matching `RFQSuppliers` row as `RESPONDED` and advances the linked `Procurements` row from `RFQ_SENT_TO_SUPPLIERS` to `QUOTATIONS_RECEIVED`. Later quotation edits do not repeat those workflow updates.
- **Reject Action**: `SupplierQuotations` supports a `Reject` additional action only from `RECEIVED`; it sets `Progress = REJECTED` and records `ProgressRejectedComment`, `ProgressRejectedAt`, and `ProgressRejectedBy`.
- **Deferred Work**: Comparison/scoring, PO generation, alternate-item handling, RFQ snapshot columns, and stored calculated flags such as `IsQuoted` are intentionally outside this module.

## Canonical Detail Owners
- Workflow detail: [GROUND_OPERATIONS_WORKFLOW.md](F:/LITTLE%20LEAP/AQL/Documents/GROUND_OPERATIONS_WORKFLOW.md)
- Resource metadata rules: [RESOURCE_COLUMNS_GUIDE.md](F:/LITTLE%20LEAP/AQL/Documents/RESOURCE_COLUMNS_GUIDE.md)

## Maintenance Rule
Update this file when:
- a procurement sheet is added, removed, or repurposed
- procurement structure expectations change materially
