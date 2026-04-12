# PROCUREMENT Sheet Structure

## Purpose
This document describes the procurement-related sheet families used for purchasing workflow.

## Current Procurement Resources
- `Procurements`
- `PurchaseRequisitions`
- `PurchaseRequisitionItems`
- `RFQs`
- `RFQItems`
- `RFQSuppliers`
- `SupplierQuotations`
- `SupplierQuotationItems`
- `PurchaseOrders`
- `PurchaseOrderItems`
- `POFulfillments`

## Structural Expectations
- parent/child workflow sheets are used across the procurement process
- workflow/progress tracking may require action/progress columns depending on current configuration

## Canonical Detail Owners
- Workflow detail: [GROUND_OPERATIONS_WORKFLOW.md](F:/LITTLE%20LEAP/AQL/Documents/GROUND_OPERATIONS_WORKFLOW.md)
- Resource metadata rules: [RESOURCE_COLUMNS_GUIDE.md](F:/LITTLE%20LEAP/AQL/Documents/RESOURCE_COLUMNS_GUIDE.md)

## Maintenance Rule
Update this file when:
- a procurement sheet is added, removed, or repurposed
- procurement structure expectations change materially
