# Technical Specifications

## 1) Stack
- Frontend: Quasar (Vue 3 + Vite)
- Backend: Google Apps Script (`doPost`)
- Data: Google Sheets (APP/MASTERS/OPERATIONS/REPORTS)

## 2) Identity & Access

### Authentication
- Users are authenticated from `APP.Users`.
- Passwords are SHA-256 hashes.
- Login stores UUID token in `Users.ApiKey`.

### Identity model
- One designation per user (`Users.DesignationID`).
- Multiple roles per user via CSV (`Users.Roles`).
- Region scope per user via `Users.AccessRegion` (empty means universe access).

### Permission model
- `RolePermissions.Actions` drives permission (CSV actions like `Read,Write,Update,Delete,Approve`).
- Resource-level auth is aggregated across all user roles.
- Record-level access enforced via `Resources.RecordAccessPolicy` + designation hierarchy.
- Region-level access enforced via `AccessRegions` hierarchy:
  - User with `AccessRegion=X` can access `X` + descendants.
  - User with empty `AccessRegion` can access all regions.
  - Record with empty `AccessRegion` is globally accessible.

## 3) Resource-Driven Runtime

`APP.Resources` is backend + frontend control plane.

Backend uses it for:
- file/sheet routing
- code generation config
- schema defaults/validation config
- audit behavior (`Audit`)
- record-level policy
- region-level filtering (`AccessRegion`)

Frontend uses it for:
- menu visibility and order
- route mapping (`RoutePath`) /masters/:resourceSlug
- page title/description
- field metadata (`UIFields`)

### Master Discovery Pattern (Generic vs. Custom)
The system uses an **Automatic Discovery Pattern** to resolve UI for master resources:
1. **Dispatcher**: `MasterIndexPage.vue` acts as the router entry point.
2. **Naming Convention**: Slugs are converted to PascalCase (e.g., `/masters/price-lists` -> `PriceListsPage.vue`).
3. **Implicit Loading**:
   - If a custom `{Entity}Page.vue` exists in `src/pages/Masters/`, it is automatically used.
   - If no custom file is found, it falls back to the generic `MasterEntityPage.vue`.
4. **Component Composition**: Custom pages can import and embed `MasterEntityPage` to retain standard CRUD functionality while adding specialized UI components or logic.

## 4) Single Channel CRUD API & UX Contract
- **Centralized Endpoint**: All API communication occurs via the centralized utility (`callGasApi`) to enforce standard behavior.
- **Request UX Lifecycle:**
  - Automatic `loading` state propagation to components.
  - Uniform `$q.notify` toasts on mutation success (save/delete).
  - Normalized error interception and consistent error dialog/toast notification across the application.
  - Direct, ad-hoc API posts or ad-hoc loaders in pages are strictly prohibited. 
- Generic verbs:
  - `{ action: "get", scope: "master", resource }`
  - `{ action: "create", scope: "master", resource, record }`
  - `{ action: "update", scope: "master", resource, code, record }`
- For region-aware resources, `record.AccessRegion` is allowed:
  - Scoped users can only write within assigned subtree.
  - Empty `record.AccessRegion` is auto-filled with user scope root for scoped users.
  - `AccessRegion` is immutable after create (update requests cannot change it).

### Apps Script Runtime File Ownership
- `GAS/apiDispatcher.gs`: owns `doPost`, request parsing/JSON response helpers, and protected action routing.
- `GAS/auth.gs`: owns authentication/profile logic (`login`, token validation, profile update handlers, authorized resources payload).
- `GAS/sheetHelpers.gs`: shared sheet utilities (`getSheetHeaders`, `getHeaderIndexMap`, `findRowByValue`, `getRowAsObject`).

## 5) PWA-SW-IDB-Pinia Data Contract
A single app-wide data agreement governs offline and incremental sync functionality:
- **Service Worker Boundary:** The SW intercepts network requests, manages background syncs, and handles raw precaching logic. It DOES NOT manage UI state or component logic.
- Master, Operation, and Warehouse pages are **IDB-first**:
  - Read cached rows from `resource-records` immediately for fast paint.
  - Read `resource-meta.lastSyncAt` as sync cursor.
- Re-entering a master page uses local cache by default and does not call Apps Script when cache exists.
- Network sync happens when:
  - User explicitly triggers refresh (force sync), or
  - No cached rows exist yet for the resource.
- Delta request behavior:
  - Frontend sends `lastUpdatedAt` whenever `resource-meta.lastSyncAt` is available.
  - Server returns only changed rows when `UpdatedAt` is present in resource headers.
  - Delta rows are upserted into IDB.
- Timestamp format contract:
  - `CreatedAt` and `UpdatedAt` are written by GAS as Unix epoch milliseconds.
  - `lastUpdatedAt` must be sent as Unix epoch milliseconds for delta filtering.
  - Runtime parser expects Unix timestamp input (number or numeric string).
- Full-sync fallback:
  - If no sync cursor exists yet, request is full sync.
  - If `UpdatedAt` is not present, server naturally returns full rows for subsequent sync calls.
- Requirement for reliable delta:
  - Master sheets should include audit columns and resource metadata should keep `Resources.Audit=TRUE`, so `UpdatedAt` is maintained on write/update.

### Pinia Master Cache (Products)
- Product master rows are hydrated into Pinia (`products` store) when Products master data is loaded.
- This allows non-master pages (for example invoice lines) to map product code/id to product name without extra API calls.

## 6) Deployment Notes
1. Update APP sheet headers as documented.
2. Paste GAS files into APP Apps Script.
3. Run `setupAppSheets()` (for new/clean setup).
4. `setupAppSheets()` now triggers `syncAppResourcesFromCode(true)` automatically after setup/refactor to align `APP.Resources` with code defaults.
5. Redeploy Web App.
