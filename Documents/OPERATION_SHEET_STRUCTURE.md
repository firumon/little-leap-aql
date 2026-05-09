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
- `OutletConsumptions`
- `OutletConsumptionItems`
- `OutletConsumptionInvoices`
- `OutletConsumptionInvoiceItems`
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
| `OutletVisits` | Planned/completed/postponed/cancelled field visit records. | `OutletCode`, `Date`, `Progress`, `Status` | `Status = Active`, `Progress = PLANNED`; valid progress transitions are `PLANNED -> COMPLETED`, `PLANNED -> POSTPONED`, and `PLANNED -> CANCELLED`. Transitions use additional actions and stamp `Progress<Progress>At`, `Progress<Progress>By`, and `Progress<Progress>Comment`; postponed visits create a new planned row without link columns. |
| `OutletRestocks` | Restock request parent document. | `Date`, `OutletCode`, `RequestedUser`, `Progress`, `Status` | `Progress = DRAFT`, `Status = Active`; editable only in `DRAFT` or `REVISION_REQUIRED`; `RequestedUser` and `ApprovedUser` store readable names because full user lookup is not loaded by the frontend. |
| `OutletRestockItems` | Restock request child lines. | `OutletRestockCode`, `SKU`, `Quantity` | unique by `OutletRestockCode + SKU`; `Quantity` must be positive for active request lines; approver fills `StorageAllocationJSON` as lowercase JSON rows like `{ "storage_name": "Red box", "quantity": 3 }`; delivery does not change restock item rows. |
| `OutletDeliveries` | Schedule-then-deliver document against an approved restock. | `OutletRestockCode`, `OutletCode`, `WarehouseCode`, `ScheduledAt`, `ItemsJSON`, `Progress`, `Status` | `Progress = SCHEDULED`, `Status = Active`; `ItemsJSON` contains scheduled `{ sku, storage, qty }` rows. Delivery moves to `DELIVERED`; cancellation moves to `CANCELLED`. |
| `OutletConsumptions` | Outlet stock-count and sold-quantity parent. | `OutletCode`, `Date`, `Username`, `Progress`, `Status` | `Progress` uses `PENDING_INVOICE_GENERATION`, `INVOICE_GENERATED`, `CANCELLED`; optional `OutletVisitCode`; creates negative `OutletMovements`. |
| `OutletConsumptionItems` | Consumption child lines storing final sold qty. | `OutletConsumptionCode`, `SKU`, `Qty` | unique by `OutletConsumptionCode + SKU`; `Qty` defaults to `0`. |
| `OutletConsumptionInvoices` | Consumption invoice headers. | `OutletConsumptionCode`, `Date`, `OutletCode`, `Username`, `Progress`, `Status` | `PriceListCode` is optional and can be resolved from outlet/default price-list assignment; `Progress` uses `PENDING_PAYMENT`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`; amount fields are `Subtotal`, `Discount`, `Tax` and default to `0`. |
| `OutletConsumptionInvoiceItems` | Consumption invoice child line items. | `OutletConsumptionInvoiceCode`, `SKU`, `Qty`, `Price` | unique by `OutletConsumptionInvoiceCode+SKU`; `Qty` defaults to `0`; `Price` defaults to `0`; invoice header `Subtotal = sum(Qty * Price)`. |
| `OutletMovements` | Ledger for positive delivery and negative consumption stock events. | `OutletCode`, `SKU`, `QtyChange`, `ReferenceType`, `ReferenceCode` | `StorageName = _default`, `QtyChange = 0`, `Status = Active`; post-write hook updates SKU-only `OutletStorages`. |
| `OutletStorages` | Derived current outlet stock by outlet/SKU. | `OutletCode`, `SKU`, `Quantity` | unique by `OutletCode + SKU`; `Quantity = 0`; no audit columns; frontend read-only. |

### Outlet Operation Columns
- `OutletVisits`: `Code`, `OutletCode`, `Date`, `Progress`, planned/completed/postponed/cancelled progress stamp/comment columns, `Status`, `AccessRegion`, audit columns.
- `OutletRestocks`: `Code`, `Date`, `OutletCode`, `RequestedUser`, `ApprovedUser`, `Progress`, submit/send-back/approve/reject action stamp/comment columns, `Status`, `AccessRegion`, audit columns.
- `OutletRestockItems`: `Code`, `OutletRestockCode`, `SKU`, `Quantity`, `StorageAllocationJSON`, `Status`, audit columns.
- `OutletDeliveries`: `Code`, `OutletRestockCode`, `OutletCode`, `WarehouseCode`, `ScheduledAt`, `DeliveredAt`, `CancelledAt`, `ScheduledBy`, `DeliveredBy`, `CancelledBy`, `ItemsJSON`, `Progress`, deliver/cancel action stamp columns, `Remarks`, `Status`, `AccessRegion`, audit columns.
- `OutletConsumptions`: `Code`, `OutletCode`, `Date`, `Username`, optional `OutletVisitCode`, `Progress`, progress action audit triplets (`PendingInvoiceGeneration`, `InvoiceGenerated`, `Cancelled`), `Status`, `AccessRegion`, audit columns.
- `OutletConsumptionItems`: `Code`, `OutletConsumptionCode`, `SKU`, `Qty`, `Status`, audit columns.
- `OutletConsumptionInvoices`: `Code`, `OutletConsumptionCode`, `Date`, `OutletCode`, `Username`, `PriceListCode`, `Subtotal`, `Discount`, `Tax`, `Progress`, progress action audit triplets (`PendingPayment`, `PartiallyPaid`, `Paid`, `Cancelled`), `Status`, `AccessRegion`, audit columns.
- `OutletConsumptionInvoiceItems`: `Code`, `OutletConsumptionInvoiceCode`, `SKU`, `Qty`, `Price`, `Status`, audit columns.
- `OutletMovements`: `Code`, `OutletCode`, `StorageName`, `SKU`, `QtyChange`, `ReferenceType`, `ReferenceCode`, `ReferenceItemCode`, `MovementDate`, `Status`, `AccessRegion`, audit columns.
- `OutletStorages`: `Code`, `OutletCode`, `SKU`, `Quantity`.

## Related Master Columns
- `OutletOperatingRules`: `Code`, `OutletCode`, `MaxStockValueLimit`, `VisitFrequencyDays`, `CreditLimit`, `PriceListCode`, `AccessRegion`, `Status`, audit columns.

## Notes
- Exact code prefixes and hook/update behavior are owned by runtime/config docs rather than this file.
- Use [MODULE_WORKFLOWS.md](F:/LITTLE%20LEAP/AQL/Documents/MODULE_WORKFLOWS.md) for documented module flow details.

## Maintenance Rule
Update this file when:
- an operation-scope sheet is added, removed, or repurposed
- structural expectations of operation sheets change materially
