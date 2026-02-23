# MASTER Google Sheet Structure (Inbound Foundation)

This document defines the MASTER file structure for the current implementation phase.

## Scope
Current scope supports inbound setup from China to Ajman warehouse.
All master resources now include `AccessRegion` for hierarchical region-based access control.

## 1) Products
Parent entity for sellable items. Each Product defines a model/line and declares which variant dimensions apply to it.

Columns:
- `Code` (Apps Script generated, prefix `LLMP`)
- `Name`
- `VariantTypes` (CSV of applicable variant dimensions, e.g. `Size,Color` or `Size,Material,Color`)
- `AccessRegion` (empty = universe record)
- `Status` (`Active`/`Inactive`)
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## 2) SKUs
Child entity representing the actual sellable SKU. Each variant row belongs to a parent Product and carries up to five dynamic variant values whose semantics are defined by the parent's `VariantTypes` column.

Columns:
- `Code` (Apps Script generated, prefix `LLMSKU` — this is the SKU used in shipments, stock, and sales)
- `ProductCode` (FK -> `Products.Code`)
- `Variant1` (value for `VariantTypes` index 0, e.g. "250ml")
- `Variant2` (value for `VariantTypes` index 1, e.g. "Blue")
- `Variant3` (value for `VariantTypes` index 2, e.g. "Silicone")
- `Variant4`
- `Variant5`
- `Status` (`Active`/`Inactive`)
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

Current API actions (apply to both Products and SKUs):
- Preferred: `action=get/create/update` with `scope=master` and `resource`
- Optional batch read: `action=get`, `scope=master`, `resources=...`
- Legacy compatibility: `master.getRecords`, `master.createRecord`, `master.updateRecord`

## 3) Suppliers
Supplier master (China vendors).

Columns:
- `Code` (`LLMS` prefix)
- `Name`
- `Country`
- `ContactPerson`
- `Phone`
- `Email`
- `AccessRegion`
- `Status`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## 4) Warehouses
Warehouse definitions (including Ajman warehouse).

Columns:
- `Code` (`LLMW` prefix)
- `Name`
- `City`
- `Country`
- `Type`
- `AccessRegion`
- `Status`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## 5) WarehouseLocations
Shelf/bin/location structure for putaway.

Columns:
- `Code` (`LLML` prefix)
- `WarehouseCode`
- `LocationCode`
- `Description`
- `Status`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## 6) Carriers
Transport partner master (port to warehouse movement).

Columns:
- `Code` (`LLMC` prefix)
- `Name`
- `Type`
- `Phone`
- `ContactPerson`
- `AccessRegion`
- `Status`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## 7) Ports
Port master for import/clearance reference.

Columns:
- `Code` (`LLMPT` prefix)
- `Name`
- `Country`
- `PortType`
- `AccessRegion`
- `Status`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## Setup Script (Single Project Model)
Run from APP Apps Script project only:
- `GAS/setupMasterSheets.gs` -> run `setupMasterSheets()`

The function reads APP `Resources` rows and creates/updates each target sheet in the file specified by `FileID` and `SheetName`.
It also normalizes headers, including required `AccessRegion` column for region-scoped visibility.

No separate Apps Script project is required in MASTER file.

## Important
In APP `Resources`, ensure rows exist for:
- `Products`
- `SKUs`
- `Suppliers`
- `Warehouses`
- `WarehouseLocations`
- `Carriers`
- `Ports`

For these rows:
- `FileID` = target spreadsheet file id
- `SheetName` = exact tab name to create/update
- `CodePrefix` = code prefix used for generated codes
- `CodeSequenceLength` = number of digits in sequence part
- `SkipColumns` = 0
- `Audit` = TRUE
