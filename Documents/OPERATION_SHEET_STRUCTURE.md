# OPERATION Sheet Structure

## Purpose
This document describes the current operation-scope sheet families and their roles.

## Current Operation Resources
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
- `Shipments`
- `ShipmentItems`
- `PortClearance`
- `GoodsReceipts`
- `GoodsReceiptItems`
- `StockMovements`
- `WarehouseStorages`

## Structural Expectations
- operational sheets hold dynamic transaction/process records
- sheets commonly use generated `Code`
- audit/access columns depend on current resource metadata and setup rules
- `WarehouseStorages` acts as the current-location inventory view derived from stock movement behavior

## Notes
- Exact code prefixes and hook/update behavior are owned by runtime/config docs rather than this file.
- Use [MODULE_WORKFLOWS.md](F:/LITTLE%20LEAP/AQL/Documents/MODULE_WORKFLOWS.md) for documented module flow details.

## Maintenance Rule
Update this file when:
- an operation-scope sheet is added, removed, or repurposed
- structural expectations of operation sheets change materially