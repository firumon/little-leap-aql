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
- `POReceivings`
- `POReceivingItems`
- `POFulfillments`
- `Shipments`
- `ShipmentItems`
- `PortClearance`
- `GoodsReceipts`
- `GoodsReceiptItems`
- `StockMovements`
- `WarehouseStorages`
- `OutletVisits`
- `OutletRestocks`
- `OutletRestockItems`
- `OutletDeliveries`
- `OutletConsumption`
- `OutletConsumptionItems`
- `OutletMovements`
- `OutletStorages`

## Structural Expectations
- operational sheets hold dynamic transaction/process records
- sheets commonly use generated `Code`
- audit/access columns depend on current resource metadata and setup rules
- `WarehouseStorages` acts as the current-location inventory view derived from stock movement behavior
- `POReceivings` is the editable inspection layer between `PurchaseOrders` and finalized `GoodsReceipts`; it stores direct `ProcurementCode` context and `POReceivingItems` stores entered inspection quantities only
- `GoodsReceipts` and `GoodsReceiptItems` are finalized GRN resources; `GoodsReceiptItems.Qty` stores accepted quantity only
- `StockMovements` is the inventory ledger for direct stock entry and GRN stock posting; `WarehouseStorages` is updated from its post-write hook
- `OutletMovements` is the outlet stock ledger; `OutletStorages` is the derived SKU-only current balance and must not be edited directly by frontend pages
- `OutletDeliveries.ItemsJSON` stores scheduled delivery snapshots; scheduling reserves warehouse stock, delivery posts outlet stock, and cancellation reverses the warehouse reservation

## Outlet Operation Resources

| Resource | Role | Required Columns | Defaults / Constraints |
|---|---|---|---|
| `OutletVisits` | Planned/completed/postponed/cancelled field visit records. | `OutletCode`, `Date`, `Status` | `Status = PLANNED`; valid transitions are `PLANNED -> COMPLETED`, `PLANNED -> POSTPONED`, and `PLANNED -> CANCELLED`. Transitions use additional actions and stamp `Status<Status>At`, `Status<Status>By`, and `Status<Status>Comment`; postponed visits create a new planned row without link columns. |
| `OutletRestocks` | Restock request parent document. | `Date`, `OutletCode`, `RequestedUser`, `Progress`, `Status` | `Progress = DRAFT`, `Status = Active`; editable only in `DRAFT` or `REVISION_REQUIRED`; `RequestedUser` and `ApprovedUser` store readable names because full user lookup is not loaded by the frontend. |
| `OutletRestockItems` | Restock request child lines. | `OutletRestockCode`, `SKU`, `Quantity` | unique by `OutletRestockCode + SKU`; `Quantity` must be positive for active request lines; approver fills `StorageAllocationJSON` as lowercase JSON rows like `{ "storage_name": "Red box", "quantity": 3 }`; delivery does not change restock item rows. |
| `OutletDeliveries` | Schedule-then-deliver document against an approved restock. | `OutletRestockCode`, `OutletCode`, `WarehouseCode`, `ScheduledAt`, `ItemsJSON`, `Progress`, `Status` | `Progress = SCHEDULED`, `Status = Active`; `ItemsJSON` contains scheduled `{ sku, storage, qty }` rows. Delivery moves to `DELIVERED`; cancellation moves to `CANCELLED`. |
| `OutletConsumption` | Confirmed outlet consumption parent. | `OutletCode`, `ConsumptionDate`, `RecordedByUserCode`, `Progress`, `Status` | `Progress = CONFIRMED`, `Status = Active`; independent of visits and creates negative `OutletMovements`. |
| `OutletConsumptionItems` | Consumption child lines. | `OutletConsumptionCode`, `SKU`, `ConsumedQty` | unique by `OutletConsumptionCode + SKU`; `ConsumedQty` defaults to `0`. |
| `OutletMovements` | Ledger for positive delivery and negative consumption stock events. | `OutletCode`, `SKU`, `QtyChange`, `ReferenceType`, `ReferenceCode` | `StorageName = _default`, `QtyChange = 0`, `Status = Active`; post-write hook updates SKU-only `OutletStorages`. |
| `OutletStorages` | Derived current outlet stock by outlet/SKU. | `OutletCode`, `SKU`, `Quantity` | unique by `OutletCode + SKU`; `Quantity = 0`; no audit columns; frontend read-only. |

### Outlet Operation Columns
- `OutletVisits`: `Code`, `OutletCode`, `Date`, `Status`, planned/completed/postponed/cancelled status stamp/comment columns, audit columns.
- `OutletRestocks`: `Code`, `Date`, `OutletCode`, `RequestedUser`, `ApprovedUser`, `Progress`, submit/send-back/approve/reject action stamp/comment columns, `Status`, `AccessRegion`, audit columns.
- `OutletRestockItems`: `Code`, `OutletRestockCode`, `SKU`, `Quantity`, `StorageAllocationJSON`, `Status`, audit columns.
- `OutletDeliveries`: `Code`, `OutletRestockCode`, `OutletCode`, `WarehouseCode`, `ScheduledAt`, `DeliveredAt`, `CancelledAt`, `ScheduledBy`, `DeliveredBy`, `CancelledBy`, `ItemsJSON`, `Progress`, deliver/cancel action stamp columns, `Remarks`, `Status`, `AccessRegion`, audit columns.
- `OutletConsumption`: `Code`, `OutletCode`, `ConsumptionDate`, `RecordedByUserCode`, `Progress`, `Remarks`, `Status`, `AccessRegion`, audit columns.
- `OutletConsumptionItems`: `Code`, `OutletConsumptionCode`, `SKU`, `ConsumedQty`, `Remarks`, `Status`, audit columns.
- `OutletMovements`: `Code`, `OutletCode`, `StorageName`, `SKU`, `QtyChange`, `ReferenceType`, `ReferenceCode`, `ReferenceItemCode`, `MovementDate`, `Status`, `AccessRegion`, audit columns.
- `OutletStorages`: `Code`, `OutletCode`, `SKU`, `Quantity`.

## Notes
- Exact code prefixes and hook/update behavior are owned by runtime/config docs rather than this file.
- Use [MODULE_WORKFLOWS.md](F:/LITTLE%20LEAP/AQL/Documents/MODULE_WORKFLOWS.md) for documented module flow details.

## Maintenance Rule
Update this file when:
- an operation-scope sheet is added, removed, or repurposed
- structural expectations of operation sheets change materially
