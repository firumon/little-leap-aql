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

### Permission model
- `RolePermissions.Actions` drives permission (CSV actions like `Read,Write,Update,Delete,Approve`).
- Resource-level auth is aggregated across all user roles.
- Record-level access enforced via `Resources.RecordAccessPolicy` + designation hierarchy.

## 3) Resource-Driven Runtime

`APP.Resources` is backend + frontend control plane.

Backend uses it for:
- file/sheet routing
- code generation config
- schema defaults/validation config
- audit behavior (`Audit`)
- record-level policy

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

### Apps Script Runtime File Ownership
- `GAS/apiDispatcher.gs`: owns `doPost`, request parsing/JSON response helpers, and protected action routing.
- `GAS/auth.gs`: owns authentication/profile logic (`login`, token validation, profile update handlers, authorized resources payload).
- `GAS/sheetHelpers.gs`: shared sheet utilities (`getSheetHeaders`, `getHeaderIndexMap`, `findRowByValue`, `getRowAsObject`).

## 5) Master Sync Strategy (IndexedDB + Delta)
- Master pages are **IDB-first**:
  - Read cached rows from `resource-records` immediately for fast paint.
  - Read `resource-meta.lastSyncAt` as sync cursor.
- Network sync is **interval-gated**:
  - Re-entering a master page within sync interval uses cache without calling Apps Script.
  - Manual refresh forces a network sync.
- Delta request behavior:
  - If resource headers contain `UpdatedAt`, frontend sends `lastUpdatedAt` and server returns only changed rows.
  - Delta rows are upserted into IDB.
- Full-sync fallback:
  - If `UpdatedAt` is not present, frontend falls back to periodic full-sync (not on every visit).
- Requirement for reliable delta:
  - Master sheets should include audit columns and resource metadata should keep `Resources.Audit=TRUE`, so `UpdatedAt` is maintained on write/update.

## 6) Deployment Notes
1. Update APP sheet headers as documented.
2. Paste GAS files into APP Apps Script.
3. Run `setupAppSheets()` (for new/clean setup).
4. Redeploy Web App.
