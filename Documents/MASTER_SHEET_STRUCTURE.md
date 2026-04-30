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

## Outlet Master Resources

### `Outlets`
- **Scope**: `master`.
- **Code**: generated with prefix `OUT` and sequence length `5`.
- **Primary key**: `Code`.
- **Required columns**: `Name`.
- **Unique columns**: `Name`.
- **Default values**: `Status = Active`, `Country = UAE`.
- **Columns**: `Code`, `Name`, `ContactPerson`, `Phone`, `Email`, `Country`, `Province`, `City`, `CommunicationAddress`, `AccessRegion`, `Status`, `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`.
- **Relationships**: referenced by outlet operation resources through `OutletCode`.

### `OutletOperatingRules`
- **Scope**: `master`.
- **Code**: generated with prefix `OOR` and sequence length `5`.
- **Primary key**: `Code`.
- **Required columns**: `OutletCode`.
- **Unique composite columns**: `OutletCode`.
- **Default values**: `Status = Active`, `MaxStockValueLimit = 0`, `VisitFrequencyDays = 14`, `CreditLimit = 0`.
- **Columns**: `Code`, `OutletCode`, `MaxStockValueLimit`, `VisitFrequencyDays`, `CreditLimit`, `AccessRegion`, `Status`, `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`.
- **Relationships**: rule rows are child-like master data for `Outlets`.

## Notes
- Exact code prefixes and metadata-driven validation rules are owned by runtime configuration, not by this document.
- For detailed resource metadata rules, use [RESOURCE_COLUMNS_GUIDE.md](F:/LITTLE%20LEAP/AQL/Documents/RESOURCE_COLUMNS_GUIDE.md)

## Maintenance Rule
Update this file when:
- a master-scope sheet is added, removed, or repurposed
- the structural expectations of master sheets change materially
