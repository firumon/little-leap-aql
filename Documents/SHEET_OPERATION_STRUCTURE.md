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
- `Outlet-Visits`
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
- Outlet restock allocation is stored on `OutletRestockItems` rows; `OutletDeliveries` stores a CSV of ORI codes in `OutletRestockItemCodes`. Delivery item completion posts outlet stock.

## Outlet Operation Resources

| Resource | Role | Required Columns | Defaults / Constraints |
|---|---|---|---|
| `Outlet-Visits` | Planned/completed/postponed/cancelled field visit records. | `OutletCode`, `Date`, `Progress`, `Status` | `Status = Active`, `Progress = PLANNED`; valid progress transitions are `PLANNED -> COMPLETED`, `PLANNED -> POSTPONED`, and `PLANNED -> CANCELLED`. Transitions use additional actions and stamp `Progress<Progress>At`, `Progress<Progress>By`, and `Progress<Progress>Comment`; postponed visits create a new planned row without link columns. `RespondDate` (`datetime`) is left blank at creation and stamped `YYYY-MM-DD HH:mm:ss` by the Complete, Postpone and Cancel actions, giving one outcome-independent "when did this visit get resolved" column. |
| `OutletRestocks` | Restock request parent document. | `Date`, `OutletCode`, `RequestedUser`, `Progress`, `Status` | `Progress = DRAFT`, `Status = Active`; editable only in `DRAFT` or `REVISION_REQUIRED`; `RequestedUser` and `ApprovedUser` store readable names because full user lookup is not loaded by the frontend. |
| `OutletRestockItems` | Atomic requested, allocated, or delivered restock units. | `OutletRestockCode`, `WarehouseCode`, `SKU`, `StorageName`, `Quantity`, `Progress`, `Status` | creator rows start `PENDING` with blank warehouse/storage; approvers set row-level warehouse/storage and `ALLOCATED`; delivery marks rows `DELIVERED`; partial allocation creates additional PENDING ORSI rows. |
| `OutletDeliveries` | Multi-outlet delivery header. | `Date`, `UserName`, `OutletRestockItemCodes`, `Progress`, `Status` | `Progress = DRAFT`, `Status = Active`; `OutletRestockItemCodes` holds a CSV of ORI codes; progress moves to `IN_TRANSIT`, `COMPLETED`, or `CANCELLED`. |
| `OutletConsumptions` | Outlet stock-count and sold-quantity parent. | `OutletCode`, `Date`, `Username`, `Progress`, `Status` | `Progress` uses `PENDING_INVOICE_GENERATION`, `INVOICE_GENERATED`, `CANCELLED`; optional `OutletVisitCode`; creates negative `OutletMovements`. |
| `OutletConsumptionItems` | Consumption child lines storing final sold qty. | `OutletConsumptionCode`, `SKU`, `Qty` | unique by `OutletConsumptionCode + SKU`; `Qty` defaults to `0`. |
| `OutletConsumptionInvoices` | Consumption invoice headers. | `OutletConsumptionCode`, `Date`, `OutletCode`, `Username`, `Progress`, `Status` | `PriceListCode` is optional and can be resolved from outlet/default price-list assignment; `Progress` uses `PENDING_PAYMENT`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`; amount fields are `Subtotal`, `Discount`, `Tax` and default to `0`; `DueDate` (`date`) is the payment due date, normally `Date + OutletOperatingRules.InvoiceDueDays`. |
| `OutletConsumptionInvoiceItems` | Consumption invoice child line items. | `OutletConsumptionInvoiceCode`, `SKU`, `Qty`, `Price` | unique by `OutletConsumptionInvoiceCode+SKU`; `Qty` defaults to `0`; `Price` defaults to `0`; invoice header `Subtotal = sum(Qty * Price)`. |
| `OutletMovements` | Ledger for positive delivery and negative consumption stock events. | `OutletCode`, `SKU`, `QtyChange`, `ReferenceType`, `ReferenceCode` | `StorageName = _default`, `QtyChange = 0`, `Status = Active`; post-write hook updates SKU-only `OutletStorages`. |
| `OutletStorages` | Derived current outlet stock by outlet/SKU. | `OutletCode`, `SKU`, `Quantity` | unique by `OutletCode + SKU`; `Quantity = 0`; no audit columns; frontend read-only. |

### Outlet Operation Columns
- `Outlet-Visits`: `Code`, `OutletCode`, `Date`, `RespondDate`, `Progress`, planned/completed/postponed/cancelled progress stamp/comment columns, `Status`, `AccessRegion`, audit columns.
- `OutletRestocks`: `Code`, `Date`, `OutletCode`, `RequestedUser`, `ApprovedUser`, `Progress`, submit/send-back/approve/reject/deliver action stamp/comment columns, `Status`, `AccessRegion`, audit columns.
- `OutletRestockItems`: `Code`, `OutletRestockCode`, `WarehouseCode`, `SKU`, `StorageName`, `Quantity`, `Progress`, allocated/delivered progress stamp/comment columns, `Status`, `AccessRegion`, audit columns.
- `OutletDeliveries`: `Code`, `Date`, `UserName`, `OutletRestockItemCodes` (CSV of ORI codes), `Progress`, in-transit/completed progress stamp/comment columns, cancel audit fields, `Status`, `AccessRegion`, audit columns.
- `OutletConsumptions`: `Code`, `OutletCode`, `Date`, `Username`, optional `OutletVisitCode`, `Progress`, progress action audit triplets (`PendingInvoiceGeneration`, `InvoiceGenerated`, `Cancelled`), `Status`, `AccessRegion`, audit columns.
- `OutletConsumptionItems`: `Code`, `OutletConsumptionCode`, `SKU`, `Qty`, `Status`, audit columns.
- `OutletConsumptionInvoices`: `Code`, `OutletConsumptionCode`, `Date`, `DueDate`, `OutletCode`, `Username`, `PriceListCode`, `Subtotal`, `Discount`, `Tax`, `Progress`, progress action audit triplets (`PendingPayment`, `PartiallyPaid`, `Paid`, `Cancelled`), `Status`, `AccessRegion`, audit columns.
- `OutletConsumptionInvoiceItems`: `Code`, `OutletConsumptionInvoiceCode`, `SKU`, `Qty`, `Price`, `Status`, audit columns.
- `OutletMovements`: `Code`, `OutletCode`, `StorageName`, `SKU`, `QtyChange`, `ReferenceType`, `ReferenceCode`, `ReferenceItemCode`, `MovementDate`, `Status`, `AccessRegion`, audit columns.
- `OutletStorages`: `Code`, `OutletCode`, `SKU`, `Quantity`.

## Related Master Columns
- `OutletOperatingRules`: `Code`, `OutletCode`, `MaxStockValueLimit`, `VisitFrequencyDays`, `InvoiceDueDays` (default `30`), `CreditLimit`, `PriceListCode`, `AccessRegion`, `Status`, audit columns.

> [!IMPORTANT]
> **Inserting a column mid-sheet is a two-place change.** The report and view
> templates read these sheets through bounded `IMPORTRANGE` ranges
> (`OutletVisits!A2:R` / `A2:W`, `OutletConsumptionInvoices!A2:AB`,
> `OutletOperatingRules!B2:G`) and address fields by fixed ordinal
> (`INDEX(raw, 0, 18)`, `CHOOSECOLS(row, 5)`), so every column added, removed or
> re-slotted shifts the templates that read past it. Whenever you change the
> header order of a sheet referenced from `Sheet Formulas/`, widen the range AND
> re-number every ordinal in each affected template, then update
> `Sheet Formulas/Reports/INDEX.md`. Adding a column at the END is the only
> change that leaves existing ordinals untouched.

## Notes
- Exact code prefixes and hook/update behavior are owned by runtime/config docs rather than this file.
- Use [WORKFLOW_OUTLET_OPERATIONS.md / WORKFLOW_PROCUREMENT.md](F:/LITTLE%20LEAP/AQL/Documents/WORKFLOW_OUTLET_OPERATIONS.md / WORKFLOW_PROCUREMENT.md) for documented module flow details.

## Maintenance Rule
Update this file when:
- an operation-scope sheet is added, removed, or repurposed
- structural expectations of operation sheets change materially
