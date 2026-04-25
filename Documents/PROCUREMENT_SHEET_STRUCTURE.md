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

## Canonical Detail Owners
- Workflow detail: [GROUND_OPERATIONS_WORKFLOW.md](F:/LITTLE%20LEAP/AQL/Documents/GROUND_OPERATIONS_WORKFLOW.md)
- Resource metadata rules: [RESOURCE_COLUMNS_GUIDE.md](F:/LITTLE%20LEAP/AQL/Documents/RESOURCE_COLUMNS_GUIDE.md)

## Maintenance Rule
Update this file when:
- a procurement sheet is added, removed, or repurposed
- procurement structure expectations change materially
