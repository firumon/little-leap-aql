# Resource Registry & Multi-File Access Architecture

APP `Resources` is the runtime registry used by GAS to resolve where each resource lives and how it behaves.

## Scope Values
Valid scope values for `Resources.Scope`:
- `master` (default) — Master data entities (Products, SKUs, Suppliers, etc.)
- `operation` — Operational/transactional entities (Shipments, Procurements, etc.)
- `accounts` — Financial/accounting entities (Assets, Liabilities, Revenue, etc.)
- `report` — Report templates and configurations
- `system` — System-level resources

Scope is normalized at runtime by `normalizeResourceScope()` in `resourceRegistry.gs`. Unrecognized values default to `master`.

## FileID Resolution
`FileID` in `Resources` is **optional**. When blank, the system resolves the target file dynamically using the fallback chain:

1. `Resource.FileID` (if present in the Resources row)
2. `Config[{Scope}FileID]` (e.g., `MasterFileID`, `OperationFileID`, `AccountsFileID`)
3. APP file ID (`getAppSpreadsheet().getId()`)

This design supports multi-file deployments where scope-level file IDs are set once in `APP.Config` rather than per-resource. Only override `FileID` at the resource level when a specific resource must live in a different file than its scope default.

`getAppSpreadsheet()` resolution chain:
1. `SpreadsheetApp.getActiveSpreadsheet()`
2. `SpreadsheetApp.openById(ScriptProperties.APP_FILE_ID)` when active spreadsheet is unavailable (web app context)
3. Throw a clear error if both are unavailable

`APP_FILE_ID` is stored in Script Properties by `setAppFileId()` and is automatically refreshed by `setupAppSheets()`. It can also be set from menu: `AQL > Setup & Refactor > Store APP File ID in Properties`.

**Diagnostics**: Run `diagLogResolvedFileIds()` from the Script Editor to log the resolved file ID for every resource row.

## Required `Resources` columns
- `Name`
- `Scope`
- `IsActive`
- `FileID` (optional — blank = config-driven resolution)
- `SheetName`
- `CodePrefix`
- `CodeSequenceLength`
- ``
- `Audit`
- `RequiredHeaders`
- `UniqueHeaders`
- `UniqueCompositeHeaders`
- `DefaultValues`
- `RecordAccessPolicy`
- `OwnerUserField`
- `AdditionalActions`
- `Menu`
- `UIFields`
- `IncludeInAuthorizationPayload`

**Note:** The actual layout of these columns in the sheet is now managed centrally by `GAS/syncAppResources.gs`. Developers should modify `APP_RESOURCES_CODE_CONFIG` inside that file and use the `AQL > Setup & Refactor > Sync APP.Resources from Code` menu to push changes safely to the sheet.

For full per-column meaning, accepted values, and examples, see:
- `documents/RESOURCE_COLUMNS_GUIDE.md`

## Permission model
- User roles are read from `Users.Roles` CSV.
- `RolePermissions` has `RoleID, Resource, Actions`.
- CRUD flags are inferred from `Actions` (Read/Write/Update/Delete).
- Extra actions (Approve/Reject/etc.) are also read from `Actions`.
- Region boundary is evaluated separately from `Users.AccessRegion` and `AccessRegions` hierarchy.
- **Menu visibility control**: `entry.ui.menus` is an array of sidebar entries whose optional `menuAccess` rules drive filtering/route guards. The frontend matches the current route to the corresponding entry and evaluates its rule, while MainLayout filters every entry independently. Supports single-resource permission checks and cross-resource AND/OR logic. Fallback: `canRead` on the resource if a rule is absent.

## Runtime flow
1. Request hits APP `doPost`.
2. Token resolves user + roles.
3. Permission checked from `RolePermissions.Actions`.
4. Resource config resolved from `Resources`.
5. Target file/sheet opened by resolved FileID (fallback chain) + `SheetName`.
6. CRUD/validation/audit behavior follows metadata from `Resources`.
7. Generic CRUD dispatch supports `master`, `operation`, and `accounts` scopes.
