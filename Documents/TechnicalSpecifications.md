# Technical Specifications

## 1) Stack
- Frontend: Quasar (Vue 3 + Vite)
- Backend: Google Apps Script (`doPost`)
- Data: Google Sheets (APP/MASTERS/TRANSACTIONS/REPORTS)

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
- route mapping (`RoutePath`)
- page title/description
- field metadata (`UIFields`)

## 4) CRUD API
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

## 5) Master Sync Strategy (IndexedDB + Delta)
- Master pages are **IDB-first**:
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
4. Redeploy Web App.
