# CONTEXT HANDOFF - Little Leap AQL

Use this file when starting a new Codex context window.

## 0) Quick Start Instruction for New Context
Tell Codex:
1. Read `Documents/CONTEXT_HANDOFF.md` first.
2. Then read `Documents/AI_COLLABORATION_PROTOCOL.md` and `Documents/README.md`.
3. For resource metadata tasks, read `Documents/RESOURCE_COLUMNS_GUIDE.md`.
4. Continue work from current implementation status in this handoff.

## 1) Project Identity
- Project: Little Leap AQL
- Domain: UAE baby product distribution operations
- Goal: End-to-end control from import (China) to warehouse (Ajman) to sales, invoicing, payments, and reports.

## 2) Current Tech Stack
- Frontend: Quasar (Vue 3 + Vite), Pinia, Axios
- Backend API: Google Apps Script Web App (single endpoint `doPost`)
- Database: Google Sheets split across APP / MASTERS / TRANSACTIONS / REPORTS files

## 3) Operating Model (Important)
- Preferred model: Single Apps Script project in APP file.
- APP sheet contains `Resources` registry with `FileID` + `SheetName` for external files.
- API handlers resolve target file/sheet dynamically from `Resources`.
- Do not maintain separate Apps Script projects in external files unless explicitly requested.

## 4) Must-Follow Collaboration Rules
- Keep code + Apps Script + Sheets + docs aligned for every significant change.
- If Sheets change: update structure docs and setup scripts.
- If Apps Script changes: show changed files and tell user what to copy-paste and redeploy.
- If frontend changes: implement directly and update docs.
- Source of this rule: `Documents/AI_COLLABORATION_PROTOCOL.md`.

## 5) Ground Operations Reality (Business Flow)
Primary commercial heartbeat:
1. Distribute products to outlets.
2. Track outlet sales periodically.
3. Collect outlet payments on strict intervals.
4. Approve and execute outlet refill.
5. Raise purchase orders to suppliers before stock-out risk.

Supporting inbound enabler flow:
1. Products manufactured in China.
2. Shipment imported to UAE port.
3. Port clearance done by owner/team.
4. Goods moved to Ajman warehouse (self/carrier).
5. Unbox and verify quantities.
6. Record variance/damage.
7. Putaway to shelf/bin locations.
8. Update stock by SKU/location.

Reference: `Documents/GROUND_OPERATIONS_WORKFLOW.md`

## 6) Current Implementation Status
### Completed
- Access Region hierarchy foundation:
  - New APP sheet `AccessRegions` (`Code`, `Name`, `Parent`) for region tree modeling.
  - `Users` now includes `AccessRegion` (empty = universe access).
  - `GAS/accessRegion.gs` added for subtree expansion + code validation.
  - `masterApi.gs` enforces region scope in read/create/update when row has `AccessRegion`.
  - `AccessRegion` is assigned on create and remains immutable on update.
  - `setupMasterSheets()` now includes `AccessRegion` column in all current master sheets.
- Resource metadata-driven master schema/runtime:
  - `masterApi.gs` no longer uses hardcoded master schema maps.
  - Required/unique/default schema now resolved from APP `Resources`.
- Multi-role + designation identity foundation:
  - `Users` supports `DesignationID`.
  - `Users.Roles` stores active role IDs as CSV.
  - Login/profile payload includes `designation` + `roles`.
  - Login/profile payload now includes `accessRegion` scope object.
- Record-level policy foundation from APP `Resources`:
  - `RecordAccessPolicy` (`ALL/OWNER/OWNER_GROUP/OWNER_AND_UPLINE`)
  - `OwnerUserField` used to evaluate ownership.
- Frontend master UI/menu is APP-driven:
  - Main menu master entries come from authorized resource metadata (`ui` payload).
  - Master routes moved to dynamic `/masters/:resourceSlug`.
  - Master entity page resolves resource config from authorized resources instead of static `masters.js`.
  - Profile now shows designation and multi-role names.
- Auth/profile APIs with token validation and row-context optimization:
  - `login`, `getProfile`, `updateAvatar`, `updateName`, `updateEmail`, `updatePassword`
- Role-based resource bootstrap on auth:
  - `login` now returns authorized resources (from `RolePermissions`) with permissions + headers using a standardized frontend contract shape
  - `getAuthorizedResources` protected action added for refresh/reload
  - Resource authorization loading is resilient per resource (one bad `FileID/SheetName` does not collapse full payload)
- Common `doPost` dispatcher in APP script:
  - `GAS/apiDispatcher.gs` owns API routing and protected action dispatch.
  - `GAS/auth.gs` now keeps authentication/profile logic only.
  - `GAS/sheetHelpers.gs` provides shared sheet utility helpers.
- Resource-driven access foundation:
  - `GAS/resourceRegistry.gs`
- Master API foundation:
  - `master.health`
  - Preferred generic verbs: `get/create/update` with `scope=master` and `resource`
  - Multi-resource fetch supported via `resources` (comma string or array)
  - Compatibility wrappers for Products and other current master entities
- Schema Refactoring & Synchronization Engine:
  - `AQL > Setup & Refactor` menu added to Google Sheets for 1-click schema syncs.
  - `GAS/syncAppResources.gs` is now the code-level source of truth for the `APP.Resources` registry. Users don't need to manually type columns into `APP.Resources`.
  - `setupMasterSheets()` and `setupTransactionSheets()` intelligently refactor columns (`app_normalizeSheetSchema`) without dropping business data when headers are redefined.
  - Required reading: `Documents/SCHEMA_REFACTORING_GUIDE.md`
- Frontend master module:
  - Generic page: `FRONTENT/src/pages/Masters/MasterEntityPage.vue`
  - Resource config map: `FRONTENT/src/config/masters.js`
  - Shared service: `FRONTENT/src/services/masterRecords.js`
  - Product store remains aligned: `FRONTENT/src/stores/products.js`
  - Supports list/create/update across Products/Suppliers/Warehouses/WarehouseLocations/Carriers/Ports.
  - Uses IndexedDB-backed incremental sync (`resource-meta`, `resource-records`).
  - Role-based UI filter active:
    - Sidebar master menu shows only resources with `permissions.canRead = true`
    - Route guard blocks direct URL access when role lacks resource read permission
- Frontend API transport centralization:
  - `FRONTENT/src/config/api.js`
  - `FRONTENT/src/services/apiClient.js`
  - `FRONTENT/src/services/gasApi.js`
  - `products` store no longer depends on `auth` store for generic API calls.
- MASTER setup script:
  - `GAS/setupMasterSheets.gs`
  - Reads APP `Resources` and creates/updates target sheets.

### Key behavior now
- Code is generated in Apps Script (not by sheet formula).
- Code generation uses `Resources.CodePrefix` + `Resources.CodeSequenceLength`.
- Initial resource schema (headers) is delivered in login payload based on role permissions.
- Login resource payload is sorted by `ui.menuOrder` then `name` for stable frontend menu/order behavior.
- User scope payload now includes:
  - `accessRegion.code`
  - `accessRegion.isUniverse`
  - `accessRegion.accessibleCodes`
- Frontend authorization behavior:
  - UI visibility uses `authorizedResources` from login payload.
  - Routing enforces authorized resource match via `resources[].ui.routePath` (and optional `meta.requiredResource` fallback).
- Master list fetch can use compact transport:
  - API verb style can be generic:
    - `action=get`, `scope=master`, `resource=...` (or `resources=...`)
    - `action=create/update`, `scope=master`, `resource=...`
  - Server sends `rows` (array of arrays) without JSON field keys.
  - Frontend converts arrays to objects using cached headers.
- Incremental sync cursor flow is active for all configured master resources:
  - Request uses `lastUpdatedAt`.
  - Response uses `meta.lastSyncAt`.
  - Frontend merges delta rows into IndexedDB.
  - Master pages are cache-first; revisits serve from IDB without API call when cache exists.
  - Network sync runs on manual refresh (or initial empty cache).
  - Products master data is also hydrated into Pinia for cross-page name/code lookups.

## 7) Required Resources Columns (APP file)
`Resources` must include:
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

Column meaning and value guidance:
- `Documents/RESOURCE_COLUMNS_GUIDE.md`

Other APP requirements:
- `Users` must include `AccessRegion`.
- APP must include `AccessRegions` sheet with columns `Code`, `Name`, `Parent`.

## 8) Master Resources and Prefixes
Recommended values:
- Products: `CodePrefix=LLMP`, `CodeSequenceLength=5`
- Suppliers: `CodePrefix=LLMS`, `CodeSequenceLength=3`
- Warehouses: `CodePrefix=LLMW`, `CodeSequenceLength=3`
- WarehouseLocations: `CodePrefix=LLML`, `CodeSequenceLength=4`
- Carriers: `CodePrefix=LLMC`, `CodeSequenceLength=4`
- Ports: `CodePrefix=LLMPT`, `CodeSequenceLength=3`

## 9) Current MASTER Schema (Step-1 Foundation)
Sheets:
- Products
- Suppliers
- Warehouses
- WarehouseLocations
- Carriers
- Ports

References:
- `Documents/MASTER_SHEET_STRUCTURE.md`
- `Documents/APP_SHEET_STRUCTURE.md`

## 10) Frontend Routes Implemented
- `/dashboard`
- `/profile`
- `/masters/products`
- `/masters/suppliers`
- `/masters/warehouses`
- `/masters/warehouse-locations`
- `/masters/carriers`
- `/masters/ports`



## 12) Manual Actions User Usually Needs
When Apps Script changes:
1. Copy updated `.gs` files to APP Apps Script project.
2. Save and deploy new Web App version if API behavior changed.

When setup scripts are added/changed:
1. Ensure `Resources` rows are correct.
2. Run setup function (for example `setupMasterSheets()`).

## 13) Primary Docs Map
- Docs index: `Documents/README.md`
- Collaboration rules: `Documents/AI_COLLABORATION_PROTOCOL.md`
- Resource architecture: `Documents/RESOURCE_REGISTRY_ARCHITECTURE.md`
- Resource column definitions: `Documents/RESOURCE_COLUMNS_GUIDE.md`
- Technical details: `Documents/TechnicalSpecifications.md`
- Ground workflow: `Documents/GROUND_OPERATIONS_WORKFLOW.md`
- APP structure: `Documents/APP_SHEET_STRUCTURE.md`
- MASTER structure: `Documents/MASTER_SHEET_STRUCTURE.md`

## 14) Note to Future Codex Sessions
Do not start implementation blindly.
Always read this file and protocol docs first, then continue from current status with aligned updates to code + Apps Script + docs.

## 15) Mandatory Handoff Maintenance Rule
For every significant implementation update, future Codex sessions must also update this file (`Documents/CONTEXT_HANDOFF.md`) before closing the task.

Significant updates include:
- New architecture/runtime decisions
- New/changed setup scripts
- New API action groups or conventions
- New sheet structure standards
- Major frontend module additions
- Important process/protocol changes for collaborators

Expected behavior for future joiners:
1. Read this file first.
2. Implement requested changes.
3. Update related technical/business docs.
4. Update this handoff with latest status and decisions so the next context can continue without re-discovery.
