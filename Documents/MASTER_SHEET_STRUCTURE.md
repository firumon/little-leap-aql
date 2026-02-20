# MASTER Google Sheet Structure (Inbound Foundation)

This document defines the MASTER file structure for the current implementation phase.

## Scope
Current scope supports inbound setup from China to Ajman warehouse.

## 1) Products
Primary source of sellable items.

Columns:
- `Code` (Apps Script generated using `Resources.CodePrefix`)
- `Name`
- `SKU`
- `Status` (`Active`/`Inactive`)
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

Current API actions:
- Generic (all master resources):
  - Preferred: `action=get/create/update` with `scope=master` and `resource`
  - Optional batch read: `action=get`, `scope=master`, `resources=...`
- Legacy compatibility: `master.getRecords`, `master.createRecord`, `master.updateRecord`
- Compatibility (Products): `master.getProducts`, `master.createProduct`, `master.updateProduct`

Master `get` data contract:
- Request requires `resource` (for example `Products`, `Suppliers`, `Warehouses`, `WarehouseLocations`, `Carriers`, `Ports`).
- Request can use `resources` (comma string or array) to fetch multiple resources in one call.
- Request can include `lastUpdatedAt` for incremental sync.
- Response returns compact `rows` (array-of-arrays in sheet header order) and `meta.lastSyncAt`.

## 2) Suppliers
Supplier master (China vendors).

Columns:
- `Code` (`LLMS` prefix)
- `Name`
- `Country`
- `ContactPerson`
- `Phone`
- `Email`
- `Status`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## 3) Warehouses
Warehouse definitions (including Ajman warehouse).

Columns:
- `Code` (`LLMW` prefix)
- `Name`
- `City`
- `Country`
- `Type`
- `Status`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## 4) WarehouseLocations
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

## 5) Carriers
Transport partner master (port to warehouse movement).

Columns:
- `Code` (`LLMC` prefix)
- `Name`
- `Type`
- `Phone`
- `ContactPerson`
- `Status`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## 6) Ports
Port master for import/clearance reference.

Columns:
- `Code` (`LLMPT` prefix)
- `Name`
- `Country`
- `PortType`
- `Status`
- `CreatedAt`
- `UpdatedAt`
- `CreatedBy`
- `UpdatedBy`

## Setup Script (Single Project Model)
Run from APP Apps Script project only:
- `GAS/setupMasterSheets.gs` -> run `setupMasterSheets()`

The function reads APP `Resources` rows and creates/updates each target sheet in the file specified by `FileID` and `SheetName`.

No separate Apps Script project is required in MASTER file.

## Important
In APP `Resources`, ensure rows exist for:
- `Products`
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
