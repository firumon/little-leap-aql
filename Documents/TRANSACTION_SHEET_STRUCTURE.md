# TRANSACTION Google Sheet Structure

This document defines the TRANSACTION file structure for the inbound distribution flow. These sheets store dynamic, high-volume records.

## Scope
Current scope supports Shipments, Port Clearance, and Goods Receipt Notes (GRN). All transaction resources follow the same region-based access control and audit rules as master data.

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
- `VariantCode` (FK -> `SKUs.Code`)
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
- `VariantCode` (FK -> `SKUs.Code`)
- `LocationCode` (FK -> `WarehouseLocations.Code`, target shelf/bin)
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
- `LocationCode`
- `VariantCode`
- `QtyChange` (Numeric, can be negative for dispatch/sales)
- `ReferenceType` (e.g., 'GRN', 'Dispatch', 'Adjustment')
- `ReferenceCode` (FK to the source document, e.g., GRNCode)
- `AccessRegion`
- `Status`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## Setup Script
Run from APP Apps Script project only:
- `GAS/setupTransactionSheets.gs` -> run `setupTransactionSheets()`

## Important
In APP `Resources`, ensure rows exist for:
- `Shipments` (Scope: `transaction`)
- `ShipmentItems` (Scope: `transaction`)
- `PortClearance` (Scope: `transaction`)
- `GoodsReceipts` (Scope: `transaction`)
- `GoodsReceiptItems` (Scope: `transaction`)
- `StockMovements` (Scope: `transaction`)

For these rows:
- `FileID` = target TRANSACTIONS spreadsheet file id
- `SheetName` = exact tab name to create/update
- `CodePrefix` = code prefix used for generated codes
- `CodeSequenceLength` = number of digits in sequence part (e.g., 6)
- `Audit` = TRUE
