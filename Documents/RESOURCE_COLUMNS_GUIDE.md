# APP.Resources Columns Guide

## Purpose
This document is the canonical meaning reference for `APP.Resources` columns.

## Key Points
- one row = one resource
- resource names should remain stable once routes/permissions depend on them
- JSON columns must contain valid JSON when populated
- blank values may be meaningful for some metadata fields depending on runtime rules

## Important Column Areas
- identity and placement
  - `Name`, `Scope`, `ParentResource`, `IsActive`, `FileID`, `SheetName`
- code/audit/sync
  - `CodePrefix`, `CodeSequenceLength`, `LastDataUpdatedAt`, `Audit`
- validation/defaults
  - `RequiredHeaders`, `UniqueHeaders`, `UniqueCompositeHeaders`, `DefaultValues`
- access and actions
  - `RecordAccessPolicy`, `OwnerUserField`, `AdditionalActions`
- UI/runtime metadata
  - `Menu`, `UIFields`, `IncludeInAuthorizationPayload`, `Functional`, `PreAction`, `PostAction`, `Reports`, `ListViews`, `CustomUIName`

## Usage Notes
- `FileID` may be blank when scope-level resolution is intended.
- `Menu` and other UI metadata should be treated as runtime configuration, not casual prose.
- Progress/action-tracking columns in target sheets must stay aligned with workflow/action design.

## Scope Characteristics
- `master`: Standard CRUD with auto-generated codes, audit columns, full sync.
- `operation`: Transactional records with auto-generated year-scoped codes (e.g., PR26000001), audit columns, full sync.
- `accounts`: Financial/accounting records, similar to operation scope.
- `report`: Read-only aggregated data, no CRUD operations.
- `view`: Read-only formula-driven sheets, no CRUD operations, no audit, no code generation, returns all non-empty rows without pagination.

## Canonical Detail Owners
- APP control-plane context: [APP_SHEET_STRUCTURE.md](F:/LITTLE%20LEAP/AQL/Documents/APP_SHEET_STRUCTURE.md)
- Registry/runtime behavior: [RESOURCE_REGISTRY_ARCHITECTURE.md](F:/LITTLE%20LEAP/AQL/Documents/RESOURCE_REGISTRY_ARCHITECTURE.md)
- Module workflow behavior: [MODULE_WORKFLOWS.md](F:/LITTLE%20LEAP/AQL/Documents/MODULE_WORKFLOWS.md)

## Maintenance Rule
Update this file when:
- a `Resources` column is added, removed, renamed, or repurposed
- accepted values or semantics of a column change
- runtime expectations for metadata fields change materially
