# CONTEXT HANDOFF - AQL

Use this file when starting a new AI agent session.

## 0) Quick Start Instruction for New Context
Tell the AI agent:
1. Read `Documents/CONTEXT_HANDOFF.md` first.
2. Read `Documents/AI_COLLABORATION_PROTOCOL.md` and `Documents/README.md`.
3. **Read `Documents/MULTI_AGENT_PROTOCOL.md`** - this project uses a multi-agent model:
   - **Guide Agent** (Default): Discussion and brainstorming.
   - **Brain Agent:** Creates implementation plans in `PLANS/`.
   - **Build Agent:** Executes approved plans from `PLANS/` (code, terminal, docs).
   - **Solo Agent:** Autonomous planning + building.
4. Check `PLANS/` for any active or pending implementation plans.
5. For any new plan, create it from `PLANS/_TEMPLATE.md`.
6. After planning (Brain), provide handoff prompt: `Build Agent, read PLANS/<plan-file>.md and execute it end-to-end.`
7. For resource metadata tasks, read `Documents/RESOURCE_COLUMNS_GUIDE.md`.
8. For feature-specific work (Reports, etc.), read the relevant section in `Documents/MODULE_WORKFLOWS.md`.
9. Continue work from current implementation status in this handoff.

## 1) Project Identity
- Project: AQL
- Domain: UAE baby product distribution operations
- Goal: End-to-end control from import (China) to warehouse (Ajman) to sales, invoicing, payments, and reports.

## 2) Current Tech Stack
- Frontend: High-fidelity Quasar (Vue 3 + Vite), Pinia, Axios.
- Backend API: Google Apps Script Web App (single endpoint `doPost`).
- Database: Google Sheets split across APP / MASTERS / OPERATIONS / REPORTS files.

## 3) Operating Model (Important)
- Preferred model: Single Apps Script project in APP file.
- APP sheet contains `Resources` registry with `FileID` + `SheetName` for external files.
- API handlers resolve target file/sheet dynamically from `Resources`.
- Do not maintain separate Apps Script projects in external files unless explicitly requested.
- APP now includes a `Config` sheet (Key-Value pairs) as the Source of Truth for deployment-specific settings (file IDs, company branding). FileID resolution chain: `Resource.FileID` → `Config[{Scope}FileID]` → APP file ID. Helpers: `getConfigMap()`, `getAppConfigValue()`, `resolveFileIdForScope()` in `sheetHelpers.gs`.
- `clasp` CLI is configured for GAS deployment. Config files per client are stored in `GAS/clasp-configs/`. Run `cd GAS && clasp push` to deploy. See `Documents/NEW_CLIENT_SETUP_GUIDE.md` Step 2 for details.

## 4) Must-Follow Collaboration Rules
- Keep code + Apps Script + Sheets + docs aligned for every significant change.
- If Sheets change: update structure docs and setup scripts.
- If Apps Script changes: show changed files and run `cd GAS && clasp push` to deploy. Only instruct user for Web App redeployment if API behavior changed.
- If frontend changes: implement directly and update docs.
- Process standard: New plan files must use role + concrete identity in ownership metadata:
  - `Created By: Brain Agent (AgentName)`
  - `Executed By: Build Agent (AgentName | pending)` (remove `| pending` on completion).
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
- Products entity-custom pages delivered (2026-03-31):
  - `FRONTENT/src/pages/Masters/Products/IndexPage.vue` custom index with product + SKU-variant combined search and SKU counts.
  - `FRONTENT/src/pages/Masters/Products/ViewPage.vue` custom view with dynamic SKU columns from `VariantTypes`.
  - `FRONTENT/src/pages/Masters/Products/AddPage.vue` and `EditPage.vue` composite Product + SKU management with variant-aware validation.
  - Shared helper `FRONTENT/src/composables/useProductVariants.js` for variant parsing, required-field validation, and duplicate variant-set detection.
- **Unified Master UI**: Rolled back the Master Entity Page to a standard table-based UI to ensure data visibility and resolve UI duplication issues, while maintaining the `v-if` guard for stability.
- Standardized Frontend UX & PWA Data Contract (Pre-Warehouse):
  - Enforced Quasar-First UI policy across all components.
  - Centralized API Request UX in `callGasApi`: standardizes Loading states and success/error Notifications without requiring manual ad-hoc handling in Vue components.
  - Formalized PWA-SW-IDB-Pinia contract: UI reads from IndexedDB first for instant paint, Service Worker only handles network/cache boundaries, never UI/business logic.
  - Validated server-side Authorization Matrix tracing (Roles > Record Policy > Region).
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
  - `setupMasterSheets()` and `setupAllOperations()` intelligently refactor columns (`app_normalizeSheetSchema`) without dropping business data when headers are redefined.
  - `setupAppSheets()` now auto-runs `syncAppResourcesFromCode(true)` after setup/refactor, so APP resource config stays aligned with code defaults.
  - `app_normalizeSheetSchema` now clears stale data validations before header rebuild to avoid validation/range drift after schema changes.
  - Robustness fix (2026-03-16): `setupAppSheets()` now preserves/validates `Functional`, `PreAction`, and `PostAction` headers; `syncAppResourcesFromCode()` now guards empty-header reads (`getLastColumn() > 0`), uses `Math.max(lastColumn, 1)` safe reads, and auto-expands columns/rows before writing headers or new resource rows (covers heavily trimmed sheets).
  - Required reading: `Documents/SCHEMA_REFACTORING_GUIDE.md`
- Frontend master module:
  - Router Entry: `FRONTENT/src/pages/Masters/MasterIndexPage.vue`
  - Generic implementation: `FRONTENT/src/pages/Masters/_common/ListPage.vue` (for list action, via resolver)
  - **3-Tier Section-Level Component Architecture** (all 5 action pages):
    - Generic section resolver composable: `FRONTENT/src/composables/useSectionResolver.js`
    - 20 default section components in `FRONTENT/src/components/Masters/Master*.vue` (4 Index + 5 View + 4 Add + 4 Edit + 3 Action)
    - Reusable card component: `FRONTENT/src/components/Masters/MasterRecordCard.vue`
    - All `_common/` pages are thin orchestration layers (layout + composable wiring).
    - `ListPage.vue` renamed to `IndexPage.vue`; route action `list` → `index`.
  - **3-Tier Resolution** (page-level and section-level):
    - Tier 1 (tenant-custom): `_custom/{CustomUIName}/{Entity}.vue` or `{Entity}{Section}.vue`
    - Tier 2 (entity-custom): `{Entity}/{Action}Page.vue` or `{Entity}/{Section}.vue`
    - Tier 3 (default): `_common/{Action}Page.vue` or `Master{Action}{Section}.vue`
  - **CustomUIName**: `APP.Resources.CustomUIName` column drives per-tenant UI customization. Read in `resourceRegistry.gs`, delivered via auth payload at `config.ui.customUIName`.
  - **Discovery Pattern**: `ActionResolverPage.vue` resolves pages with 3-tier priority using `import.meta.glob` and `useResourceConfig` for `customUIName`.
  - Resource config map: `FRONTENT/src/config/masters.js`
  - Shared service: `FRONTENT/src/services/masterRecords.js`
  - Product store remains aligned: `FRONTENT/src/stores/products.js`
  - Supports list/create/update across Products/Suppliers/Warehouses/WarehouseStorages/Carriers/Ports.
  - Uses IndexedDB-backed incremental sync (`resource-meta`, `resource-records`).
  - Bulk upload page refactor (2026-03-16): `FRONTENT/src/pages/Masters/BulkUploadPage.vue` is now a thin orchestrator using `FRONTENT/src/composables/useBulkUpload.js` and reusable components under `FRONTENT/src/components/Masters/BulkUpload/`. Header-driven row mapping now strictly follows user-provided header list to prevent column misalignment.
  - Frontend registry standard (2026-03-16): reusable UI/state catalogs are now maintained in `FRONTENT/src/components/REGISTRY.md` and `FRONTENT/src/composables/REGISTRY.md`. Frontend tasks that add/change reusable components/composables must update these registries.
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
- PWA & Offline Support:
  - Custom service worker (`custom-service-worker.js`) implemented for caching and offline capabilities.
  - IndexedDB-backed data synchronization for seamless offline UX.
- Resource & Entity Updates:
  - Transitioned architecture to use `SKUs` instead of `ProductVariants`.
  - Configured `APP.Resources` to include mapping for operation resources: Shipments, Port Clearance, Goods Receipts, and Stock Movements.
- Identity & Role Architecture (Updates):
  - Simplified role mapping: `Roles` are now directly assigned to users via `RoleID` in the `Users` sheet, deprecating the `UserRoles` sheet.
  - Built Role-Based Dashboards routing and layouts (redirect based on role logic).
- Frontend Store Architecture:
  - Refactored the `auth` store and related stores to Vue 3 Composition API (Setup Store syntax) for better maintainability.
- Frontend Hardening & Page Prune (Production Baseline Correction):
  - Removed obsolete operation test pages. The app officially operates on `LandingPage.vue`, `LoginPage.vue`, `DashboardIndex.vue`, `MasterEntityPage.vue` (generic rendering for any master list), and `ProfilePage.vue`.
  - **IndexedDB & Performance Hardening**:
    - Fixed critical `IDBTransaction` naming issues and stabilized Service Worker registration to prevent evaluation failures.
    - Implemented dynamic IDB re-initialization: DB is explicitly closed on `logout` and recreated on next `login`.
    - **Optimistic UI Updates**: All Master CRUD operations (Create/Update) now reflect in the UI immediately (<200ms) with background reconciliation.
    - **Cache-First Instant Paint**: MasterEntityPage renders from IndexedDB cache immediately, then silently updates from server. Navigation between same-resource pages no longer wipes data.
    - Added subtle pulsed sync indicator for non-blocking background operations.
  - Removed duplicate ad-hoc notification toasts; single API result mapping handled uniformly by `callGasApi`.
- Global post-login eager master sync:
  - `FRONTENT/src/services/masterRecords.js` now exposes `syncAllMasterResources()` for batched cache warmup.
  - Auth login (`FRONTENT/src/stores/auth.js`) triggers this sync in background (non-blocking) immediately after successful login.
  - Batch payload sends per-resource incremental cursors (`lastUpdatedAtByResource`) to `action=get` + `scope=master` + `resources[]`.
  - `GAS/masterApi.gs` `handleMasterGetMultiRecords` now applies cursor per resource and keeps existing access/region policy enforcement via `handleMasterGetRecords`.
- Delta cursor serialization fix (2026-03-15):
  - `FRONTENT/src/services/masterRecords.js` now normalizes single-resource cursor values using numeric-first parsing before request build.
  - Single-resource sync sends `lastUpdatedAt` only when cursor is a valid Unix epoch milliseconds number.
  - This prevents JSON `NaN -> null` payload serialization (seen when cursor came from localStorage as numeric string), restoring incremental delta behavior.
- APP.Config sheet for multi-client deployment support (2026-03-18):
  - New `Config` sheet in APP spreadsheet stores deployment-specific Key-Value settings.
  - `GAS/sheetHelpers.gs` adds `getConfigMap()`, `getAppConfigValue()`, `resolveFileIdForScope()`.
  - FileID resolution is now a 3-tier fallback: `Resource.FileID` → `Config[{Scope}FileID]` → `ss.getId()`.
  - `syncAppResources.gs`, `resourceRegistry.gs`, `reportGenerator.gs`, `appMenu.gs` all use the new fallback chain.
  - Hardcoded `CONFIG.REPORTS_FILE_ID` removed from `Constants.gs`.
  - `setupAppSheets.gs` creates the Config sheet with pre-populated expected keys. It is now the first sheet created and positioned in the APP spreadsheet.
- GAS Audit Refactor Hardening (2026-03-19):
  - **Config cache TTL** reduced from 6h to 5min; added `clearConfigCache()` for manual invalidation.
  - **FileID auto-population removed**: `syncAppResourcesFromCode()` no longer writes resolved FileIDs into blank `Resources.FileID` cells — blank is preserved for config-driven runtime resolution.
  - **`accounts` scope** added to `normalizeResourceScope()` and API dispatcher scope allowlist — accounts resources no longer collapse to `master`.
  - **Progress validation** now applied in `setupOperationSheets.gs` — `progressValidation` arrays were defined but never applied before.
  - **Setup utility deduplication**: Created `GAS/setupSheetUtils.gs` with shared `setup_*` helpers. All 4 setup scripts (`setupAppSheets.gs`, `setupMasterSheets.gs`, `setupOperationSheets.gs`, `setupAccountSheets.gs`) now use these shared helpers. ~420 lines of duplicate code removed.
  - **Admin dialog HTML separation**: Extracted inline HTML/CSS/JS from `appMenu.gs` into `GAS/adminDialog.html` template. Server logic stays in `.gs`, form markup/client JS in `.html`.
  - **Duplicate utility removal**: `appMenu.gs` `findRow` and `hashPasswordMenu` replaced with thin wrappers to shared `findRowByValue` and `hashPassword`.
  - **Error handling**: Added try/catch for JSON.parse in `apiDispatcher.gs`; improved error messages for FileID/SheetName resolution failures in `resourceRegistry.gs`.
  - **Diagnostics**: Added `diagLogResolvedFileIds()` in `sheetHelpers.gs` for troubleshooting FileID resolution per resource.
  - Plan: `PLANS/2026-03-19-gas-audit-refactor-hardening.md`
- Authorization payload/FileID resolution hardening (2026-03-19):
  - Added `getAppSpreadsheet()` in `GAS/sheetHelpers.gs` with fallback chain: `getActiveSpreadsheet()` -> `ScriptProperties.APP_FILE_ID` (`openById`) -> explicit error.
  - Added `setAppFileId()` utility and wired it to both `setupAppSheets()` (auto-store) and menu `AQL > Setup & Refactor > Store APP File ID in Properties`.
  - Replaced doPost-reachable APP sheet access points in `auth.gs` and `resourceRegistry.gs` to use `getAppSpreadsheet()`.
  - Corrected Config default key from `AccountFileID` to `AccountsFileID`.
  - Added execution logging in auth/resource authorization paths (`safeGetRoleResourceAccess`, `buildAuthorizedResourceEntry`) to avoid silent failures.
  - Removed `fileId` from authorized resource payload sent to frontend; kept internal runtime file resolution untouched.
- **GAS Backend Performance Optimization — Two-Tier Caching & Permanent Metadata Store (2026-03-20)**:
  - Implemented request-scoped global variable caching for `getAppSpreadsheet()`, `getResourceRegistryContext()`, and `getRolePermissionsContext()`.
  - Created a high-performance `getResourceConfigMap()` with cross-execution persistence via `CacheService` (5-min TTL) and **Permanent Metadata Store** (hidden `Metadata` sheet).
  - Permanent Store eliminates the "cold-start" delay (25s -> 8s) by caching resource configs and sheet headers indefinitely in the APP file.
  - Added a bulk-loading roles cache (`getRolesCache()`) with `CacheService` persistence.
  - Optimized `handleMasterBulkRecords()` in `masterApi.gs` to batch new-row inserts into a single `setValues()` RPC.
  - Fixed `accessRegion.gs` to use the cached `getAppSpreadsheet()` helper.
  - Updated `scripts/deploy-gas.js` to support custom deployment descriptions and ensure `ANYONE` access.
  - Final Performance: Login reduced from ~25s to ~8s; Multi-resource sync reduced from ~3min to ~9s.
  - Plan: `PLANS/2026-03-20-gas-performance-optimization.md`.

- **Filtered List Views — APP.Resources.ListViews (2026-04-01)**:
  - New `ListViews` JSON column in `APP.Resources` for filter-driven list view configurations per resource.
  - `GAS/setupAppSheets.gs` and `GAS/syncAppResources.gs` include `ListViews` in schema (additive, non-destructive).
  - `GAS/resourceRegistry.gs` parses `ListViews` with mode semantics and exposes in auth payload as `entry.ui.listViews` + `entry.ui.listViewsMode`.
  - **AQL Menu > Manage Lists**: Sheet UI dialog (`GAS/listViewsManager.html`) for managing list view configs per resource. Supports nested AND/OR filter groups, user-friendly operator labels, `$now` token, and validation.
  - Empty-state admin control in Manage Lists: select + Update (Fallback => blank cell, Off => `[]`).
  - GAS server functions: `app_showListViewsManagerDialog()`, `app_getListViewsManagerData()`, `app_saveResourceListViews()` in `GAS/appMenu.gs`.
  - Frontend composable: `FRONTENT/src/composables/useListViews.js` — evaluates filter trees, applies mode semantics (`auto` / `off` / `custom`), computes per-view counts (ignoring search), local-state switching (URL sync optional but currently disabled).
  - Frontend component: `FRONTENT/src/components/Masters/MasterListViewSwitcher.vue` — chip bar with outlined/filled toggle, counts, color coding.
  - Integrated into `FRONTENT/src/pages/Masters/_common/IndexPage.vue` (default index) and `FRONTENT/src/pages/Masters/Products/IndexPage.vue` (custom Products index).
  - Status badge removed from `MasterRecordCard.vue` and Products index cards.
  - Mode behavior: blank `ListViews` cell => auto mode; `[]` => off mode (hide switcher); non-empty array => custom override mode.
  - Supported operators: `eq`, `neq`, `in`, `not_in`, `gt`, `gte`, `lt`, `lte`, `contains`.
  - Plan: `PLANS/2026-04-01-filtered-list-views.md`.

- **TTL-based Master Sync Queue (2026-04-01)**:
  - `FRONTENT/src/services/masterRecords.js` now uses resource TTL-aware scheduling instead of immediate background fetch on every cache-hit page visit.
  - Scope TTLs are loaded from `APP.Config` keys: `MasterSyncTTL`, `AccountsSyncTTL`, `OperationsSyncTTL` (fallback defaults: `900/60/300` seconds).
  - Login/profile auth payload now includes full `appConfig` (all `APP.Config` key-value pairs) for frontend runtime use.
  - Cache-hit navigations enqueue sync by `nextEligibleSyncAt`; cold resources (no Pinia/IDB hydration yet) trigger immediate queue flush with a batched delta request.
  - Queue flush uses `action=get` + `scope=master` + `resources[]` + `lastUpdatedAtByResource` to reduce request count.
  - Legacy interval-based per-resource sync loop in `FRONTENT/src/App.vue` was removed to prevent duplicate background network traffic.

- **Menu Column Consolidation (2026-04-03)**:
  - Consolidated 8 separate menu columns (`MenuGroup`, `MenuOrder`, `MenuLabel`, `MenuIcon`, `RoutePath`, `PageTitle`, `PageDescription`, `ShowInMenu`) into a single `Menu` JSON column in `APP.Resources`.
  - `GAS/syncAppResources.gs`: Each resource now has a single `Menu` key containing a JSON object with `group`, `order`, `label`, `icon`, `route`, `pageTitle`, `pageDescription`, `show`.
  - `GAS/setupAppSheets.gs`: Resources sheet schema uses single `Menu` column header instead of 8.
  - `GAS/resourceRegistry.gs`: Parses `Menu` JSON for normalized sidebar config used by auth payload builders.
  - `GAS/appMenu.gs`: Admin dialog still shows individual form fields; `mapResource()` composes them into `Menu` JSON on save, `getResourceDetails()` parses `Menu` JSON back into individual fields on load.
- **Menu Column Array + Multi-item Entries (2026-04-06)**:
  - `APP.Resources.Menu` now stores a JSON **array** (`[{...}, {...}]`), letting a single resource expose multiple sidebar menu entries and route guards.
  - `GAS/resourceRegistry.gs` normalizes `menu` entries into `config.menus` and delivers them as `entry.ui.menus`; configuration-level helpers now treat the first entry as the primary CRUD view.
  - `GAS/appMenu.gs` only edits the first array item in the admin dialog while preserving `_menuArrayFull`; `mapResource()` writes `[editedItem, ...rest]`.
  - Frontend sidebar (MainLayout), router guard, `useMenuAccess`, `useResourceConfig`, and CRUD headers now iterate `ui.menus`, match routes to the correct entry, and evaluate `menuAccess` per item so multiple items can share one resource�s permissions.
  - `Documents/RESOURCE_COLUMNS_GUIDE.md` and `Documents/APP_SHEET_STRUCTURE.md` document the array format; login payload now names the field `ui.menus` to signal the change.
  - Frontend files updated: `MainLayout.vue`, `router/index.js`, `useResourceConfig.js`, `useCompositeForm.js`, `ResourcePageShell.vue`, `MasterListHeader.vue`, `MasterAddHeader.vue`, `MasterEditHeader.vue`, `MasterAddChildren.vue`, `MasterEditChildren.vue`, `MasterViewChildren.vue`.
  - Plan: `PLANS/2026-04-03-menu-column-consolidation.md`.

- **AppOptions Infrastructure (2026-04-05)**:
  - New `AppOptions` sheet in the APP spreadsheet stores named option lists for use across forms. Sheet layout: horizontal rows � Column A = option group key, B onwards = selectable values. No header row.
  - Seed data managed in `GAS/Constants.gs` as `APP_OPTIONS_SEED` (single source of truth). `setupAppSheets()` seeds missing option groups on first run, never overwrites admin-edited rows.
  - Initial option group: `StockMovementReferenceType` ? `['GRN', 'DirectEntry', 'StockAdjustment']`. Dropdown validation applied to `StockMovements.ReferenceType` by `setupOperationSheets()`.
  - New `GAS/appOptions.gs` provides `getAppOptions()` which reads the sheet and returns `{ key: [values] }`. Called by `handleLogin()` in `auth.gs`.
  - Login payload now includes `appOptions` key alongside `appConfig`. Stored in Pinia auth store and localStorage. Frontend access: `authStore.appOptionsMap['StockMovementReferenceType']`.
  - **Adding new option groups**: Add key + values to `APP_OPTIONS_SEED` in `Constants.gs`, add matching `referenceTypeValidation` (or appropriate schema key) in the relevant setup script, run `clasp push`, re-run setup menu actions, re-login.
  - Plan: `PLANS/synchronous-churning-riddle.md`.

- **Warehouse > Manage Stock feature + WarehouseStorages hook + Login Response doc (2026-04-06)**:
  - New `GAS/stockMovements.gs` � `applyStockMovementToWarehouseStorages()` hook that upserts `WarehouseStorages` on every `StockMovements` insert. Closes the gap where `WarehouseStorages` was documented as "automatically managed" but no code path existed.
  - `GAS/masterApi.gs` � hook wired into `handleMasterCreateRecord` post-insert for `StockMovements` resource. Added `rowArrayToObject()` helper.
  - `GAS/syncAppResources.gs` � `StockMovements` now carries two menu entries: `/operations/stock-movements` and `/operations/manage-stock` (Warehouse group).
  - Frontend: `ManageStockPage.vue`, `ManageStockContextStep.vue`, `ManageStockEditGrid.vue`, `StockMovementRow.vue`, `useStockMovements.js`. Type-agnostic: movement types driven by `appOptions.StockMovementReferenceType` � new types need only an `APP.AppOptions` row.
  - `Documents/LOGIN_RESPONSE.md` created � canonical login payload spec with all fields, generators, file:line refs, and maintenance rule.
  - `CLAUDE.md`, `AGENTS.md` � Login Response Documentation Maintenance Rule added.
  - Plan: `PLANS/2026-04-05-warehouse-manage-stock-and-login-response-doc.md`.

- **Manage Stock UX + Sidebar Taxonomy Refactor (2026-04-06)**:
  - Manage Stock context step no longer asks storage in step 1; storage is captured per SKU row in step 2.
  - `useStockMovements.loadStoragesForWarehouse()` now reads `WarehouseStorages` through operation-scope API call with non-blocking/no-error-toast options for background hydration.
  - Stock movement rows now submit row-level `StorageName` (`StockMovementRow` includes per-row storage picker + same Delta/New Qty dual binding).
  - Sidebar menu taxonomy in `GAS/syncAppResources.gs` shifted toward business groups:
    - `Product`: `Manage Products`, `Manage Stock`
    - `Warehouse`: `Manage Warehouses`, `Manage Stock`, `Stock Movements`, `Warehouse Storages`, `Port Clearance`, `Goods Receipts`
    - `Procurement`: `Purchase Requisitions`, `RFQs`, `Supplier Quotations`, `Purchase Orders`, `Shipments`
  - `Procurements` menu entry is retained as hidden (`show: false`) registry row.
  - Plan: `PLANS/2026-04-06-manage-stock-ux-and-menu-taxonomy-refactor.md`.
- **Scope Normalization + Multi-Level Menu Tree + Compact Stock Grid (2026-04-06)**:
  - **Critical bug fix**: `resolveMasterResourceNames()` in `GAS/masterApi.gs` was hardcoded to `getResourcesByScope('master')`, causing "Unsupported master resource" errors for operation-scope resources (e.g., saving StockMovements). Now reads `payload.scope` and resolves supported resources by the actual requested scope.
  - **Scope alias normalization**: `normalizeResourceScope()` in `GAS/resourceRegistry.gs` now handles plural aliases: `operations` → `operation`, `masters` → `master`, `reports` → `report`.
  - **`groupPath` menu field**: All 33 resources in `GAS/syncAppResources.gs` now include `groupPath: string[]` in each menu item object. `GAS/resourceRegistry.gs` normalizes it (falls back to `[group]` for backward compat) and delivers it in the auth payload as `menus[*].groupPath`.
  - **Business taxonomy applied via `groupPath`**: Masters (`['Masters', 'Product']`, `['Masters', 'Warehouse']`, `['Masters', 'Procurement']`, `['Masters', 'Logistics']`), Operations (`['Operations', 'Procurement']`, `['Operations', 'Warehouse']`), Accounts (`['Accounts']`).
  - **N-level sidebar tree renderer**: `FRONTENT/src/layouts/MainLayout/MainLayout.vue` `visibleResourceMenuGroups` now builds a recursive tree from `groupPath` arrays. New `FRONTENT/src/components/MenuTreeNode.vue` recursive component handles N-level group nesting with `q-expansion-item` for groups and `q-item` for leaves.
  - **Compact Manage Stock grid**: Removed "Product" and "Note" columns from the stock entry table. Product name shown as a secondary line under SKU. Storage field narrowed to 120-180px max. Input widths trimmed to 80px. No horizontal scroll on standard desktop widths.
  - Plan: `PLANS/2026-04-06-scope-normalization-and-multilevel-menu-tree.md`.

- **Standalone Wizard Resource Removal + StockMovements Dual-Menu Ownership (2026-04-06)**:
  - Removed the standalone warehouse wizard resource definition from `GAS/syncAppResources.gs`.
  - `StockMovements.Menu` now owns both sidebar entries: "Stock Movements" and "Manage Stock".
  - Access for both routes is controlled by `StockMovements` permissions (`APP.RolePermissions`), not a separate resource.

- **Menu Access Control via `menuAccess` Rules (2026-04-03)**:
   - Added permission-based menu visibility control using `menuAccess` field inside the `Menu` JSON column.
   - `GAS/syncAppResources.gs`: Code-level source of truth for `menuAccess` rules (e.g., `menuAccess: { require: 'canWrite' }`).
   - `GAS/resourceRegistry.gs`: Parses and delivers menu-access rules in `entry.ui.menus[*].menuAccess` in auth payload.
   - `FRONTENT/src/composables/useMenuAccess.js`: Reusable composable that evaluates `menuAccess` rules against user permissions. Supports: absent (fallback `canRead`), single resource (`require`), cross-resource AND (`all`), cross-resource OR (`any`).
   - `FRONTENT/src/layouts/MainLayout/MainLayout.vue`: Uses `evaluateMenuAccess()` to filter sidebar menu items instead of hardcoded `canRead` check. Removed `readableResources` computed property.
   - `FRONTENT/src/router/index.js`: Added inline `evaluateMenuAccessInline()` function (non-composable) to guard route access using same logic.
   - `menuAccess` schema documented in `RESOURCE_COLUMNS_GUIDE.md` with examples for all 4 cases.
   - Full workflow documented in `MODULE_WORKFLOWS.md` section 4.
   - Test case: Products resource configured with `menuAccess: { require: 'canWrite' }` in `syncAppResources.gs`.
   - Plan: `PLANS/2026-04-03-menu-access-control.md`.

### Key behavior now
- Code is generated in Apps Script (not by sheet formula).
- Code generation uses `Resources.CodePrefix` + `Resources.CodeSequenceLength`.
- Initial resource schema (headers) is delivered in login payload based on role permissions.
- Login resource payload is sorted by the minimum value among `ui.menus[*].order`, then `name` for stable frontend menu/order behavior.
- User scope payload now includes:
  - `accessRegion.code`
  - `accessRegion.isUniverse`
  - `accessRegion.accessibleCodes`
- Frontend authorization behavior:
  - UI visibility uses `authorizedResources` from login payload.
  - Routing enforces authorized resource match via `resources[].ui.menus[*].route` (and optional `meta.requiredResource` fallback).
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
  - Master pages are cache-first; revisits serve from IDB instantly without blocking UI.
  - Optimistic UI: Create/Update operations close dialogs immediately and update local items while syncing in background.
  - IDB Lifecycle: IndexedDB is completely purged on logout and recreated on login to ensure clean state and security across user sessions.
- Eager cache warmup on login:
  - One background `getMulti` request fetches all authorized master resources after login.
  - Master pages opened after login usually render from IDB instantly without the first-page 10s wait.
  - Auth store now exposes `isGlobalSyncing` for optional top-level sync indicators.
- GAS backend master-sync performance optimization (2026-03-14):
  - `GAS/resourceRegistry.gs` now uses request-level memory caches for `SpreadsheetApp.openById` and `getSheetByName` (`_resource_file_cache`, `_resource_sheet_cache`).
  - `GAS/auth.gs` now preloads and caches `Users` and `Designations` lookup maps per execution (`_users_context_cache`, `_designations_cache`).
  - `GAS/masterApi.gs` now reuses already-loaded headers during list responses and short-circuits row checks when `RecordAccessPolicy=ALL` and no scoped region check is needed.
  - `getUserById` now resolves from in-memory user maps, reducing repeated User sheet scans during `getMulti`.
- Registry sync-cursor optimization (2026-03-14):
  - `APP.Resources` schema now includes `LastDataUpdatedAt` (Unix epoch milliseconds) and no longer uses `SkipColumns`.
  - `GAS/resourceRegistry.gs` exposes `updateResourceSyncCursor(resourceName)` to update `LastDataUpdatedAt` after successful write operations.
  - `GAS/masterApi.gs` now updates this cursor after `create/update`, and `handleMasterGetRecords` can return immediately with zero rows when client cursor is current, before full data-range scans.
- Audit timestamp contract:
  - `CreatedAt` and `UpdatedAt` are now stored as Unix epoch milliseconds (number).
  - `lastUpdatedAt` delta cursor should also use Unix epoch milliseconds.
  - Server date parser expects Unix timestamp inputs (number or numeric string); native `Date` objects are still tolerated when passed by Google runtime.

## 7) APP.Resources Columns
Required columns (managed by `syncAppResources.gs`):
- `Name`, `Scope`, `ParentResource`, `IsActive`, `FileID`, `SheetName`
- `CodePrefix`, `CodeSequenceLength`, `LastDataUpdatedAt`, `Audit`
- `RequiredHeaders`, `UniqueHeaders`, `UniqueCompositeHeaders`, `DefaultValues`
- `RecordAccessPolicy`, `OwnerUserField`, `AdditionalActions`
- `Menu` (JSON: group, order, label, icon, route, pageTitle, pageDescription, show)
- `UIFields`, `IncludeInAuthorizationPayload`, `Reports`, `CustomUIName`

Column meaning and value guidance: `Documents/RESOURCE_COLUMNS_GUIDE.md`

Other APP requirements:
- `Users` must include `AccessRegion`.
- APP must include `AccessRegions` sheet with columns `Code`, `Name`, `Parent`.

## 8) Resource Code Prefixes (from syncAppResources.gs)
These are the actual values used by the code-level source of truth (`GAS/syncAppResources.gs`):

MASTER:
- Products: `CodePrefix=PRD`, `CodeSequenceLength=5`
- SKUs: `CodePrefix=SKU`, `CodeSequenceLength=6`
- Suppliers: `CodePrefix=SUP`, `CodeSequenceLength=4`
- Warehouses: `CodePrefix=WH`, `CodeSequenceLength=3`
- WarehouseStorages: `CodePrefix=LOC`, `CodeSequenceLength=5`
- Carriers: `CodePrefix=CARR`, `CodeSequenceLength=4`
- Ports: `CodePrefix=PORT`, `CodeSequenceLength=3`

OPERATION (Inbound):
- Shipments: `CodePrefix=SHP`, `CodeSequenceLength=6`
- ShipmentItems: `CodePrefix=SHPI`, `CodeSequenceLength=6`
- PortClearance: `CodePrefix=CLR`, `CodeSequenceLength=5`
- GoodsReceipts: `CodePrefix=GRN`, `CodeSequenceLength=6`
- GoodsReceiptItems: `CodePrefix=GRNI`, `CodeSequenceLength=6`
- StockMovements: `CodePrefix=STKMOV`, `CodeSequenceLength=7`

OPERATION (Procurement):
- Procurements: `CodePrefix=PRC`, `CodeSequenceLength=5`
- PurchaseRequisitions: `CodePrefix=PR`, `CodeSequenceLength=6`
- PurchaseRequisitionItems: `CodePrefix=PRI`, `CodeSequenceLength=6`
- RFQs: `CodePrefix=RFQ`, `CodeSequenceLength=5`
- RFQItems: `CodePrefix=RFQI`, `CodeSequenceLength=6`
- RFQSuppliers: `CodePrefix=RFQS`, `CodeSequenceLength=6`
- SupplierQuotations: `CodePrefix=SQ`, `CodeSequenceLength=5`
- SupplierQuotationItems: `CodePrefix=SQI`, `CodeSequenceLength=6`
- PurchaseOrders: `CodePrefix=PO`, `CodeSequenceLength=5`
- PurchaseOrderItems: `CodePrefix=POI`, `CodeSequenceLength=6`
- POFulfillments: `CodePrefix=POF`, `CodeSequenceLength=6`

ACCOUNTS:
- ChartOfAccounts: `CodePrefix=COA`, `CodeSequenceLength=4`
- EntryTemplates: `CodePrefix=ETPL`, `CodeSequenceLength=4`
- Assets: `CodePrefix=AST`, `CodeSequenceLength=6`
- Liabilities: `CodePrefix=LIA`, `CodeSequenceLength=6`
- Equity: `CodePrefix=EQT`, `CodeSequenceLength=6`
- Revenue: `CodePrefix=REV`, `CodeSequenceLength=6`
- Expenses: `CodePrefix=EXP`, `CodeSequenceLength=6`

## 9) Current Schema Sheets
MASTER Sheets:
- Products
- SKUs
- Suppliers
- Warehouses
- WarehouseStorages
- Carriers
- Ports

OPERATION Sheets (Inbound):
- Shipments
- ShipmentItems
- PortClearance
- GoodsReceipts
- GoodsReceiptItems
- StockMovements

OPERATION Sheets (Procurement):
- Procurements
- PurchaseRequisitions
- PurchaseRequisitionItems
- RFQs
- RFQItems
- RFQSuppliers
- SupplierQuotations
- SupplierQuotationItems
- PurchaseOrders
- PurchaseOrderItems
- POFulfillments

ACCOUNTS Sheets:
- ChartOfAccounts (scope: master)
- EntryTemplates (scope: master)
- Assets (scope: accounts)
- Liabilities (scope: accounts)
- Equity (scope: accounts)
- Revenue (scope: accounts)
- Expenses (scope: accounts)

References:
- `Documents/MASTER_SHEET_STRUCTURE.md`
- `Documents/OPERATION_SHEET_STRUCTURE.md`
- `Documents/PROCUREMENT_SHEET_STRUCTURE.md`
- `Documents/ACCOUNTS_SHEET_STRUCTURE.md`
- `Documents/APP_SHEET_STRUCTURE.md`

## 10) Frontend Routes Implemented
- `/landing` (AuthPage/LandingPage.vue)
- `/login` (AuthPage/LoginPage.vue)
- `/dashboard` (Dashboard/DashboardIndex.vue)
- `/profile` (ProfilePage/ProfilePage.vue)
- `/masters/:resourceSlug` (Masters/MasterEntityPage.vue)


## 11) Manual Actions User Usually Needs
When Apps Script changes:
1. The agent runs `cd GAS && clasp push` automatically — no manual copy-paste needed.
2. **User action only if** API behavior changed (new actions, changed response shape): Create a new Web App deployment version in Apps Script IDE (Deploy > New deployment).

When setup scripts are added/changed:
1. User runs the relevant menu action from AQL 🚀 menu in the APP spreadsheet.
2. Verify `Resources` rows are correct in the APP sheet.

## 12) Primary Docs Map
- Docs index: `Documents/README.md`
- Collaboration rules: `Documents/AI_COLLABORATION_PROTOCOL.md`
- **Multi-Agent protocol: `Documents/MULTI_AGENT_PROTOCOL.md`**
- **Active implementation plans: `PLANS/`**
- **Module Workflows: `Documents/MODULE_WORKFLOWS.md`** — end-to-end flow docs per feature (Reports, etc.). Read the relevant section before working on any documented module.
- Resource architecture: `Documents/RESOURCE_REGISTRY_ARCHITECTURE.md`
- Resource column definitions: `Documents/RESOURCE_COLUMNS_GUIDE.md`
- Technical details: `Documents/TECHNICAL_SPECIFICATIONS.md`
- Ground workflow: `Documents/GROUND_OPERATIONS_WORKFLOW.md`
- APP structure: `Documents/APP_SHEET_STRUCTURE.md`
- MASTER structure: `Documents/MASTER_SHEET_STRUCTURE.md`
- Client Setup Guide: `Documents/NEW_CLIENT_SETUP_GUIDE.md`

## 13) Note to Future AI Sessions
Do not start implementation blindly.
Always read this file and protocol docs first, then continue from current status with aligned updates to code + Apps Script + docs.

## 14) Mandatory Handoff Maintenance Rule
For every significant implementation update, AI agents must also update this file (`Documents/CONTEXT_HANDOFF.md`) before closing the task.

Significant updates include:
- New architecture/runtime decisions
- New/changed setup scripts
- New API action groups or conventions
- New sheet structure standards
- Major frontend module additions
- Important process/protocol changes for collaborators
- **Any change to a module workflow** (Reports, Bulk Upload, etc.) — update the relevant section in `Documents/MODULE_WORKFLOWS.md` to reflect the new flow, files, config, or behavior

Expected behavior for future joiners:
1. Read this file first.
2. Implement requested changes.
3. Update related technical/business docs.
4. Update this handoff with latest status and decisions so the next context can continue without re-discovery.


