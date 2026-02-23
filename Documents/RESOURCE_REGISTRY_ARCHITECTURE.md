# Resource Registry & Multi-File Access Architecture

APP `Resources` is the runtime registry used by GAS to resolve where each resource lives and how it behaves.

## Required `Resources` columns
- `Name`
- `Scope`
- `IsActive`
- `FileID`
- `SheetName`
- `CodePrefix`
- `CodeSequenceLength`
- `SkipColumns`
- `Audit`
- `RequiredHeaders`
- `UniqueHeaders`
- `UniqueCompositeHeaders`
- `DefaultValues`
- `RecordAccessPolicy`
- `OwnerUserField`
- `AdditionalActions`
- `MenuGroup`
- `MenuOrder`
- `MenuLabel`
- `MenuIcon`
- `RoutePath`
- `PageTitle`
- `PageDescription`
- `UIFields`
- `ShowInMenu`
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

## Runtime flow
1. Request hits APP `doPost`.
2. Token resolves user + roles.
3. Permission checked from `RolePermissions.Actions`.
4. Resource config resolved from `Resources`.
5. Target file/sheet opened by `FileID` + `SheetName`.
6. CRUD/validation/audit behavior follows metadata from `Resources`.
