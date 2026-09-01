# MASTER Sheet Structure

## Purpose
This document describes the current master-scope sheet families and their roles.

## Current Master Resources
- `Products`
- `SKUs`
- `Suppliers`
- `Warehouses`
- `Ports`
- `Carriers`
- `UOMs`
- `Outlets`
- `OutletOperatingRules`

## Structural Expectations
- each master sheet has a generated `Code`
- resource-specific business columns vary by sheet
- `Suppliers` includes `Name`, `Country`, `Province`, `City`, `CommunicationAddress`, `ContactPerson`, `Phone`, `Email`, `AccessRegion`, and `Status`
- `Outlets` stores customer/retail locations used by outlet visits, restocks, deliveries, consumption, movements, and stock balances
- `OutletOperatingRules` stores outlet-level operating limits and visit/credit defaults
- audit/access columns depend on current resource metadata and setup rules

## Warehouse Master Resources

### `Warehouses`
- **Scope**: `master`.
- **Code**: generated with prefix `WH` and sequence length `3`.
- **Primary key**: `Code`.
- **Required columns**: `Name`, `Status`.
- **Unique columns**: `Name`.
- **Default values**: `Status = Active`, `Country = UAE`, `Type = Main`.
- **Columns**: `Code`, `Name`, `Province`, `Area`, `City`, `Country`, `Type`, `Licence`, `AccessRegion`, `Status`, `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`.
- **Relationships**: holds warehouse stock records in `WarehouseStorages` and stock transactions in `StockMovements`.

## Outlet Master Resources

### `Outlets`
- **Scope**: `master`.
- **Code**: generated with prefix `OUT` and sequence length `5`.
- **Primary key**: `Code`.
- **Required columns**: `Name`.
- **Unique columns**: `Name`.
- **Default values**: `Status = Active`, `Country = UAE`.
- **Columns**: `Code`, `Name`, `ContactPerson`, `Phone`, `Email`, `Country`, `Province`, `Area`, `City`, `CommunicationAddress`, `ShippingAddress`, `BillingAddress`, `MapLocationLink`, `Picture`, `Picture2`, `Picture3`, `Licence`, `TaxRegistrationNumber`, `TaxRegistrationName`, `AccessRegion`, `Status`, `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`.
- **Relationships**: referenced by outlet operation resources through `OutletCode`.

### `OutletOperatingRules`
- **Scope**: `master`.
- **Code**: generated with prefix `OOR` and sequence length `5`.
- **Primary key**: `Code`.
- **Required columns**: `OutletCode`.
- **Unique composite columns**: `OutletCode`.
- **Default values**: `Status = Active`, `MaxStockValueLimit = 0`, `VisitFrequencyDays = 14`, `CreditLimit = 0`, `InvoiceDueDays = 30`.
- **Columns**: `Code`, `OutletCode`, `MaxStockValueLimit`, `VisitFrequencyDays`, `InvoiceDueDays`, `CreditLimit`, `PriceListCode`, `AccessRegion`, `Status`, `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`.
- **`InvoiceDueDays`**: days added to `OutletConsumptionInvoices.Date` to derive that invoice's `DueDate`. Defaults to `30`. Sits at relative column 4 of the `Outlet` sheet view's `OutletOperatingRules!B2:G` import — that range and its `VLOOKUP` indexes were widened when this column was added.
- **Relationships**: rule rows are child-like master data for `Outlets`.

## Notes
- Exact code prefixes and metadata-driven validation rules are owned by runtime configuration, not by this document.
- For detailed resource metadata rules, use [SCHEMA_RESOURCE_COLUMNS.md](F:/LITTLE%20LEAP/AQL/Documents/SCHEMA_RESOURCE_COLUMNS.md)

## Maintenance Rule
Update this file when:
- a master-scope sheet is added, removed, or repurposed
- the structural expectations of master sheets change materially
