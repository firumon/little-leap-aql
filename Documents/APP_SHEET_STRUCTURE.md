# Little Leap AQL - APP Google Sheet Structure

This document defines the **APP** Google Sheet as the control plane for authentication, authorization, and resource metadata used by both GAS backend and frontend runtime.

## Core Sheets

### 1) Users
Purpose: User identity and auth record.

Columns:
- `UserID` (PK, `U####`)
- `Name`
- `Email`
- `PasswordHash`
- `DesignationID` (FK -> `Designations.DesignationID`)
- `Roles` (CSV RoleIDs, example: `R0001,R0003`)
- `AccessRegion` (FK -> `AccessRegions.Code`, empty = universe/all regions)
- `Status` (`Active`/`Inactive`)
- `Avatar`
- `ApiKey`

### 2) AccessRegions
Purpose: Hierarchical data-access boundary model.

Columns:
- `Code` (PK, format: country 3-letter prefix + 3-digit sequence, example: `UAE001`, `QTR001`)
- `Name`
- `Parent` (optional FK -> `AccessRegions.Code`)

Notes:
- Empty `Users.AccessRegion` means universe access (no region restriction).
- Non-empty `Users.AccessRegion` grants access to that region + all descendants.
- Records with empty `AccessRegion` are treated as universe records.

### 3) Designations
Purpose: Organization designation and hierarchy model for record-level access.

Columns:
- `DesignationID` (PK, `D####`)
- `Name`
- `HierarchyLevel` (`1` = topmost)
- `Status`
- `Description`

### 4) Roles
Purpose: Functional roles.

Columns:
- `RoleID` (PK, `R####`)
- `Name`
- `Description`

### 5) RolePermissions
Purpose: Role-to-resource permissions and non-CRUD actions.

Columns:
- `RoleID` (FK)
- `Resource` (FK -> `Resources.Name`)
- `Actions` (CSV, example: `Read,Write,Update,Delete,Approve,Reject`)

### 6) Resources
Purpose: Single metadata registry for backend CRUD rules and frontend menu/page/field rendering.

Detailed per-column meaning and sample values:
- `documents/RESOURCE_COLUMNS_GUIDE.md`

Columns (in order):
- `Name`
- `Scope` (`master|transaction|report|system`)
- `ParentResource` (Optional FK -> parent `Resources.Name`)
- `IsActive`
- `FileID`
- `SheetName`
- `CodePrefix`
- `CodeSequenceLength`
- `SkipColumns`
- `Audit` (if true: manage `CreatedAt,UpdatedAt,CreatedBy,UpdatedBy`)
- `RequiredHeaders` (CSV)
- `UniqueHeaders` (CSV)
- `UniqueCompositeHeaders` (`A+B;C+D` or JSON)
- `DefaultValues` (JSON object)
- `RecordAccessPolicy` (`ALL|OWNER|OWNER_GROUP|OWNER_AND_UPLINE`)
- `OwnerUserField` (usually `CreatedBy`)
- `AdditionalActions` (CSV)
- `MenuGroup`
- `MenuOrder`
- `MenuLabel`
- `MenuIcon`
- `RoutePath`
- `PageTitle`
- `PageDescription`
- `UIFields` (JSON array)
- `ShowInMenu`
- `IncludeInAuthorizationPayload`

## Setup Script
Use `GAS/setupAppSheets.gs` (`setupAppSheets()`) to create these sheets.
For existing APP files, run `upgradeAppSheetsForAccessRegions()` to add `Users.AccessRegion` and create `AccessRegions` if missing.
