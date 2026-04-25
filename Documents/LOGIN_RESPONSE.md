# Login Response — Canonical Specification

This document is the authoritative reference for the payload returned by `handleLogin()` in `GAS/auth.gs`.

---

## Maintenance Rule

> **Any change to the login response — adding/removing/renaming a top-level field, changing a generator function, changing a source sheet/column, adding or modifying an `APP.Config` key or `AppOptions` group, or changing a frontend storage location — MUST update `Documents/LOGIN_RESPONSE.md` in the same task. This is enforced the same way as the Menu Admin Guide Maintenance Rule in `CLAUDE.md`.**

---

## 1. Envelope Shape

```json
{
  "success": true,
  "requestId": "string (uuid)",
  "action": "login",
  "error": null,
  "message": "",
  "data": {
    "resources": {},
    "result": {
      "token": "string (uuid)",
      "user": { },
      "resources": [],
      "appConfig": { },
      "appOptions": { }
    },
    "artifacts": {}
  },
  "meta": {
    "serverTime": 0,
    "version": "v1"
  }
}
```

---

## 2. Top-Level Field Reference

| Field | Source | Generator (file:line) | Purpose | Frontend storage | Refresh trigger |
|---|---|---|---|---|---|
| `success` | Computed | `GAS/auth.gs:116` | Login success flag | Not persisted | Per request |
| `data.result.token` | `APP.Users.ApiKey` | `GAS/auth.gs:111` — `Utilities.getUuid()` | Session identifier written to `Users.ApiKey` | `localStorage.token` + Pinia `authStore.token` | Re-login only |
| `data.result.user` | `APP.Users` + `APP.Roles` + `APP.Designations` | `GAS/auth.gs:119` → `buildAuthUserPayload()` `GAS/auth.gs:205` | Authenticated user identity, roles, access region | `localStorage.user` + Pinia `authStore.user` | Re-login only |
| `data.result.resources` | `APP.Resources` + `APP.RolePermissions` | `GAS/auth.gs:120` → `getLoginAuthorizedResources()` `GAS/auth.gs:196` → `safeGetRoleResourceAccess()` `GAS/auth.gs:236` → `buildAuthorizedResourceEntry()` `GAS/resourceRegistry.gs:482` | Menu items, permissions, UI config per resource the user can access | `localStorage.resources` + Pinia `authStore.resources` | Re-login or admin runs **AQL 🚀 > Resources > Clear Resource Config Cache** |
| `data.result.appConfig` | `APP.Config` | `GAS/auth.gs:121` → `getLoginAppConfig()` `GAS/auth.gs:164` | Deployment-scoped settings (sync TTLs, file IDs, branding) | `localStorage.appConfig` + Pinia `authStore.appConfig` | Re-login |
| `data.result.appOptions` | `APP.AppOptions` | `GAS/auth.gs:122` → `getAppOptions()` `GAS/appOptions.gs:15` | Flat map of option-group → array of selectable values | `localStorage.appOptions` + Pinia `authStore.appOptions` (exposed as `appOptionsMap` computed) | Re-login |

---

## 3. `user` Payload Sub-Reference

Shape built by `buildAuthUserPayload()` at `GAS/auth.gs:205`:

```json
{
  "id":           "string",
  "name":         "string",
  "email":        "string",
  "avatar":       "string",
  "accessRegion": { "code": "string", "isUniverse": true, "accessibleCodes": [], "accessibleRegions": [] },
  "designation":  { "id": "string", "name": "string" },
  "roles":        [{ "id": "string", "name": "string" }],
  "role":         "string"
}
```

| Field | Source Sheet.Column | Generator |
|---|---|---|
| `id` | `APP.Users.UserID` | `GAS/auth.gs:207` |
| `name` | `APP.Users.Name` | `GAS/auth.gs:208` |
| `email` | `APP.Users.Email` | `GAS/auth.gs:209` |
| `avatar` | `APP.Users.Avatar` | `GAS/auth.gs:210` |
| `accessRegion` | `APP.Users.AccessRegion` + `APP.AccessRegions` | `GAS/auth.gs:211` → `buildUserAccessRegionPayload()` in `GAS/accessRegion.gs` |
| `designation` | `APP.Designations` via `APP.Users.DesignationID` | `GAS/auth.gs:212` → `getDesignationById()` in `GAS/auth.gs` |
| `roles` | `APP.Roles` via `APP.Users.Roles` (CSV of RoleIDs) | `GAS/auth.gs:213` → `getRoleNamesByIds()` in `GAS/auth.gs` |
| `role` | `APP.Users.Role` (legacy primary role field) | `GAS/auth.gs:214` → `getPrimaryRoleName()` in `GAS/auth.gs` |

---

## 4. `resources` Payload Sub-Reference

Array of resource entries built by `buildAuthorizedResourceEntry()` at `GAS/resourceRegistry.gs:482`. Each entry:

```json
{
  "name":               "Products",
  "scope":              "master",
  "parentResource":     "",
  "sheetName":          "Products",
  "codePrefix":         "PRD",
  "codeSequenceLength": 5,
  "functional":         false,
  "permissions": {
    "canRead":   true,
    "canWrite":  true,
    "canUpdate": true,
    "canDelete": false
  },
  "headers": ["Code", "Name", "VariantTypes", "Status", "..."],
  "ui": {
    "menus": [{
      "group":           ["Masters", "Product"],
      "order":           1,
      "label":           "Products",
      "icon":            "inventory_2",
      "route":           "/masters/products",
      "pageTitle":       "Products",
      "pageDescription": "...",
      "show":            true,
      "menuAccess":      {}
    }],
    "fields":         [],
    "customUIName":   "",
    "listViews":      [],
    "listViewsMode":  "auto"
  },
  "additionalActions": [],
  "actions":           [],
  "allowedActions":    [],
  "reports":           []
}
```

| Field | Purpose |
|---|---|
| `name` | Resource identifier (matches `APP.Resources.Name`) |
| `scope` | `master`, `operation`, or `accounts` |
| `parentResource` | Name of parent resource for child resources (e.g., `Products` for `SKUs`) |
| `sheetName` | Target Google Sheet tab name |
| `codePrefix` | Prefix for auto-generated codes (e.g., `PRD`) |
| `codeSequenceLength` | Zero-padded numeric suffix length |
| `functional` | `true` = no sheet data (e.g., BulkUploadMasters); sheet I/O must not be attempted |
| `permissions` | CRUD flags derived from `APP.RolePermissions` for the user's role(s) |
| `headers` | Sheet column headers; empty array for functional resources |
| `ui.menus` | Sidebar menu configuration array including `menuAccess` rules |
| `ui.fields` | UIFields config for custom form rendering |
| `ui.customUIName` | Drives per-tenant 3-tier component resolution in frontend |
| `ui.listViews` / `ui.listViewsMode` | List view filter configurations |
| `additionalActions` | AdditionalActions JSON config for action pages |
| `reports` | Report configs for PDF generation |

---

## 5. `appConfig` Sub-Reference

Key-value map read from `APP.Config` sheet by `getLoginAppConfig()` at `GAS/auth.gs:164`. Keys are stored as-is; frontend reads case-insensitively via `authStore.appConfigMap`.

| Key | Purpose | Frontend consumer |
|---|---|---|
| `MasterSyncTTL` | Seconds between background re-syncs for master-scope resources | `FRONTENT/src/stores/auth.js` → `scopeSyncConfig.masterSyncTTL` (fallback: 900s) |
| `AccountsSyncTTL` | Seconds between syncs for accounts-scope resources | `FRONTENT/src/stores/auth.js` → `scopeSyncConfig.accountsSyncTTL` (fallback: 60s) |
| `OperationsSyncTTL` | Seconds between syncs for operation-scope resources | `FRONTENT/src/stores/auth.js` → `scopeSyncConfig.operationsSyncTTL` (fallback: 300s) |
| `reportFileID` | Google Spreadsheet ID for the REPORTS file | `GAS/reportGenerator.gs` → `resolveFileIdForScope('report')` |
| `MasterFileID` | FileID for MASTER spreadsheet (fallback if not set in Resources.FileID) | `GAS/sheetHelpers.gs` → `resolveFileIdForScope('master')` |
| `OperationsFileID` | FileID for OPERATIONS spreadsheet | `GAS/sheetHelpers.gs` → `resolveFileIdForScope('operation')` |
| `AccountsFileID` | FileID for ACCOUNTS spreadsheet | `GAS/sheetHelpers.gs` → `resolveFileIdForScope('accounts')` |

> Note: Keep this table in sync as new Config keys are added to the system.

---

## 6. `appOptions` Sub-Reference

Flat map read from `APP.AppOptions` sheet by `getAppOptions()` at `GAS/appOptions.gs:15`.
Sheet layout: Column A = option group key; Columns B onwards = selectable values.
Seed data defined in `GAS/Constants.gs:65` (`APP_OPTIONS_SEED`).

Supplier Quotation additions:
- `SupplierQuotationResponseType`: `['QUOTED', 'PARTIAL', 'DECLINED']`
- `SupplierQuotationProgress`: `['RECEIVED', 'ACCEPTED', 'REJECTED']`
- `SupplierQuotationExtraChargeType`: `['tax', 'freight', 'commission', 'handling', 'other']`
- `Currency`: `['AED']`

| Option Group | Values | Seeded at | Frontend consumer |
|---|---|---|---|
| `StockMovementReferenceType` | `['GRN', 'DirectEntry', 'StockAdjustment']` | `GAS/Constants.gs:66` + `GAS/setupOperationSheets.gs` (column dropdown validation) | `FRONTENT/src/components/Warehouse/ManageStockContextStep.vue` → type cards; `GAS/setupOperationSheets.gs` → ReferenceType dropdown |

> Rule: When adding a new option group to `APP_OPTIONS_SEED`, also add a matching dropdown validation in the relevant setup script, update this table, and update any frontend consumers.

---

## 7. Frontend Access Pattern

```js
import { useAuthStore } from 'src/stores/auth'

const auth = useAuthStore()

// Auth state
auth.token              // session token string
auth.user               // user payload object
auth.resources          // full authorized resources array
auth.appConfig          // raw appConfig map
auth.appOptions         // raw appOptions map

// Computed getters
auth.appConfigMap        // same as appConfig (normalized)
auth.appOptionsMap       // same as appOptions (normalized)
auth.authorizedResources // same as resources
auth.scopeSyncConfig     // { masterSyncTTL, accountsSyncTTL, operationsSyncTTL }

// Example: get StockMovement reference types
const types = auth.appOptionsMap['StockMovementReferenceType'] // ['GRN', 'DirectEntry', ...]
```
