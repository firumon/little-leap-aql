# OPERATION Google Sheet Structure

This document defines the OPERATION file structure for the inbound distribution flow. These sheets store dynamic, high-volume records.

## Scope
Current scope supports Shipments, Port Clearance, and Goods Receipt Notes (GRN). All operation resources follow the same region-based access control and audit rules as master data.

## 1) Shipments (Header)
Tracks the overarching inbound sea freight shipments from suppliers to UAE.

Columns:
- `Code` (Apps Script generated, prefix `LLMSH`)
- `SupplierCode` (FK -> `Suppliers.Code`)
- `ETD` (Estimated Time of Departure)
- `ETA` (Estimated Time of Arrival)
- `Status` (Draft, InTransit, Arrived, Cleared, Received)
- `CarrierCode` (FK -> `Carriers.Code`, optional until port clearance)
- `PortCode` (FK -> `Ports.Code`)
- `AccessRegion`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## 2) ShipmentItems (Lines)
Tracks the expected variant items contained within a Shipment.

Columns:
- `Code` (Apps Script generated, prefix `LLMSI`)
- `ShipmentCode` (FK -> `Shipments.Code`)
- `SKU` (FK -> `SKUs.Code`)
- `ExpectedQty` (Numeric)
- `Status`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## 3) PortClearance
Tracks the customs and duty details for an arrived shipment before it moves to the warehouse.

Columns:
- `Code` (Apps Script generated, prefix `LLMPC`)
- `ShipmentCode` (FK -> `Shipments.Code`)
- `ClearanceDate`
- `CustomsStatus` (Pending, InProgress, Cleared, Held)
- `DutyAmount` (Numeric)
- `AccessRegion`
- `Status`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## 4) GoodsReceipts (GRN Header)
Records the actual arrival of goods at the warehouse against a cleared shipment.

Columns:
- `Code` (Apps Script generated, prefix `LLMGRN`)
- `ShipmentCode` (FK -> `Shipments.Code`)
- `ReceivedDate`
- `WarehouseCode` (FK -> `Warehouses.Code`)
- `Status` (Draft, Verified, Accepted)
- `AccessRegion`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## 5) GoodsReceiptItems (GRN Lines)
Records the line-item exact physical counts during unboxing.

Columns:
- `Code` (Apps Script generated, prefix `LLMGRI`)
- `GRNCode` (FK -> `GoodsReceipts.Code`)
- `SKU` (FK -> `SKUs.Code`)
- `StorageName` (target shelf/bin)
- `ExpectedQty` (Numeric)
- `ReceivedQty` (Numeric)
- `DamagedQty` (Numeric)
- `AcceptedQty` (Numeric)
- `Status`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## 6) StockMovements (Ledger)
The immutable ledger of all inventory adjustments. A completed GRN generates positive stock movements.

Columns:
- `Code` (Apps Script generated, prefix `LLMSM`)
- `WarehouseCode`
- `StorageName`
- `SKU`
- `QtyChange` (Numeric, can be negative for dispatch/sales)
- `ReferenceType` — values sourced from `AppOptions` sheet key `StockMovementReferenceType`. Current values: `GRN`, `DirectEntry`, `StockAdjustment`. Sheet dropdown validation is applied by `setupOperationSheets()`. New values are added by updating `APP_OPTIONS_SEED` in `Constants.gs` and re-running setup.
- `ReferenceCode` (FK to the source document, e.g., GRNCode)
- `AccessRegion`
- `Status`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## 7) WarehouseStorages (Real-time Inventory)
Real-time updated inventory locations. Automatically maintained as a materialized summary of `StockMovements`.

**How it is updated:** `handleMasterCreateRecord` in `GAS/masterApi.gs` calls `applyStockMovementToWarehouseStorages()` (defined in `GAS/stockMovements.gs`) immediately after writing every `StockMovements` row. The hook upserts the matching `(WarehouseCode, StorageName, SKU)` row — creating it if absent, incrementing `Quantity` if present.

**Manual editing:** Do not edit `Quantity` directly. If drift occurs, rebuild by summing all `StockMovements.QtyChange` for each `(WarehouseCode, StorageName, SKU)` tuple.

**Trigger chain:** `StockMovements` create → `applyStockMovementToWarehouseStorages()` → upsert `WarehouseStorages`. Non-throwing: if the summary update fails, the ledger row is already committed and the error is only logged.

Columns:
- `Code` (`LLML` prefix)
- `WarehouseCode`
- `StorageName`
- `SKU`
- `Quantity`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## Setup Script
Run from APP Apps Script project only:
- `GAS/setupOperationSheets.gs` -> run `setupOperationSheets()`

## Important
In APP `Resources`, ensure rows exist for:
- `Shipments` (Scope: `operation`)
- `ShipmentItems` (Scope: `operation`)
- `PortClearance` (Scope: `operation`)
- `GoodsReceipts` (Scope: `operation`)
- `GoodsReceiptItems` (Scope: `operation`)
- `StockMovements` (Scope: `operation`)
- `WarehouseStorages` (Scope: `operation`)

For these rows:
- `FileID` = target OPERATIONS spreadsheet file id
- `SheetName` = exact tab name to create/update
- `CodePrefix` = code prefix used for generated codes
- `CodeSequenceLength` = number of digits in sequence part (e.g., 6)
- `Audit` = TRUE
