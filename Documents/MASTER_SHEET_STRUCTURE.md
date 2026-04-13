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

## Structural Expectations
- each master sheet has a generated `Code`
- resource-specific business columns vary by sheet
- audit/access columns depend on current resource metadata and setup rules

## Notes
- Exact code prefixes and metadata-driven validation rules are owned by runtime configuration, not by this document.
- For detailed resource metadata rules, use [RESOURCE_COLUMNS_GUIDE.md](F:/LITTLE%20LEAP/AQL/Documents/RESOURCE_COLUMNS_GUIDE.md)

## Maintenance Rule
Update this file when:
- a master-scope sheet is added, removed, or repurposed
- the structural expectations of master sheets change materially
