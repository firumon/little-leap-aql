# APP.Resources Columns Guide

This document explains each `APP > Resources` column, what to fill, and common value patterns.

## Usage Notes
- One row = one resource (`Products`, `PurchaseOrders`, `Shipments`, etc.).
- Keep `Name` stable after frontend routes/permissions go live.
- JSON columns should contain valid JSON (`{}` or `[]` format). Exception: `ListViews` can be intentionally blank (`""`) to enable auto mode.

## Column Reference
| Column | Required | Type | Meaning | Typical Values / Format | Example |
|---|---|---|---|---|---|
| `Name` | Yes | Text | Unique resource key used in API + permissions | PascalCase resource name | `Products` |
| `Scope` | Yes | Text | Logical module for resource | `master`, `operation`, `accounts`, `report`, `system` | `master` |
| `ParentResource` | Optional | Text | Points to a parent resource definition | Exact matched Name of another resource | `Products` |
| `IsActive` | Yes | Boolean | Enables/disables resource at runtime | `TRUE` / `FALSE` | `TRUE` |
| `FileID` | Yes | Text | Spreadsheet ID where sheet exists | Google Sheet file id | `1AbC...xyz` |
| `SheetName` | Yes | Text | Tab name inside target file | Exact tab name | `Products` |
| `CodePrefix` | Optional | Text | Prefix for generated `Code` | Any uppercase prefix | `LLMP` |
| `CodeSequenceLength` | Optional | Number | Digits for sequence part | Positive integer | `5` |
| `LastDataUpdatedAt` | Optional | Number | Last write timestamp (Unix ms) used for fast delta-sync early exit | Unix epoch milliseconds | `1710420000000` |
| `Audit` | Yes | Boolean | If true, backend manages audit fields | `TRUE` / `FALSE` | `TRUE` |
| `RequiredHeaders` | Optional | CSV Text | Fields required on create/update | Comma-separated header names | `Name,SKU` |
| `UniqueHeaders` | Optional | CSV Text | Single-column uniqueness checks | Comma-separated header names | `SKU` |
| `UniqueCompositeHeaders` | Optional | Text | Multi-column uniqueness checks | `A+B;C+D` or JSON array | `WarehouseCode+StorageName` |
| `DefaultValues` | Optional | JSON Text | Default values used by backend | JSON object | `{"Status":"Active","Country":"UAE"}` |
| `RecordAccessPolicy` | Yes | Text | Row-level authorization model | `ALL`, `OWNER`, `OWNER_GROUP`, `OWNER_AND_UPLINE` | `OWNER_AND_UPLINE` |
| `OwnerUserField` | Optional | Text | Header used as owner column | Usually `CreatedBy` | `CreatedBy` |
| `AdditionalActions` | Optional | CSV Text | Declares domain actions supported by resource | Comma-separated action names | `Approve,Reject,Cancel` |
| `Menu` | Optional | JSON Text | Consolidated menu/navigation config. Contains: `group` (sidebar group), `order` (sort within group), `label` (sidebar text), `icon` (Quasar/Material icon), `route` (frontend path), `pageTitle`, `pageDescription`, `show` (boolean, show in menu). Blank/`{}` = auto-derive defaults from `Name`/`Scope`. | JSON object | `{"group":"Masters","order":1,"label":"Products","icon":"inventory_2","route":"/masters/products","pageTitle":"Products","pageDescription":"Manage products","show":true}` |
| `UIFields` | Optional | JSON Text | Field config for dynamic form/table | JSON array of field objects | `[{"header":"Name","label":"Name","type":"text","required":true}]` |
| `IncludeInAuthorizationPayload` | Yes | Boolean | Include this resource in login/getAuthorizedResources payload | `TRUE` / `FALSE` | `TRUE` |
| `Functional` | Yes | Boolean | If `TRUE`, resource is a UI tool with no backing sheet (FileID/SheetName ignored). Skipped during data sync. | `TRUE` / `FALSE` | `FALSE` |
| `PreAction` | Optional | Text | Function name executed **before** the main action handler when the resource is invoked | GAS function name | `validateBulkPayload` |
| `PostAction` | Optional | Text | Function name executed **after** routing (or as the primary handler for functional resources) | GAS function name | `handleMasterBulkRecords` |
| `Reports` | Optional | JSON Text | Downloadable document configs (JSON array) | JSON array of report objects | `[{"name":"pkg","templateSheet":"Package"}]` |
| `ListViews` | Optional | JSON Text | Filter-driven list view configurations with single-cell mode control. `""` (blank) = auto mode, `[]` = off mode, non-empty JSON array = custom mode. | `""`, `[]`, or JSON array of view objects | `[{"name":"Active","default":true,"color":"positive","filter":{"type":"group","logic":"AND","items":[{"type":"condition","column":"Status","operator":"eq","value":"Active"}]}}]` |
| `CustomUIName` | Optional | Text | Tenant/client UI code that drives 3-tier component resolution. When set, the frontend looks for custom pages in `pages/Masters/_custom/{CustomUIName}/` and custom sections in `components/Masters/_custom/{CustomUIName}/` before falling back to entity-custom or default components. Empty = no tenant-custom tier (skip straight to entity-custom → default). The same value can be shared across multiple resources for one tenant. | Any short code string | `A2930` |

## `RecordAccessPolicy` Meaning
- `ALL`: Any user with role action permission can access records.
- `OWNER`: Only creator/owner can access records.
- `OWNER_GROUP`: Owner + users in same designation hierarchy level.
- `OWNER_AND_UPLINE`: Owner + users in higher authority levels.

## `RolePermissions.Actions` Alignment
- Use `RolePermissions.Actions` to grant actions per role-resource.
- CRUD inference used by backend:
  - `Read` -> read permission
  - `Write` or `Create` -> create permission
  - `Update` -> update permission
  - `Delete` -> delete permission
- Additional actions (like `Approve`) are checked from same `Actions` list.

## `Menu` JSON Schema

The `Menu` column stores a single JSON object that consolidates all menu/navigation config for the resource. This replaced the former 8 separate columns (`MenuGroup`, `MenuOrder`, `MenuLabel`, `MenuIcon`, `RoutePath`, `PageTitle`, `PageDescription`, `ShowInMenu`).

```json
{
  "group": "Masters",
  "order": 1,
  "label": "Products",
  "icon": "inventory_2",
  "route": "/masters/products",
  "pageTitle": "Products",
  "pageDescription": "Manage product master records",
  "show": true
}
```

| Field | Required | Type | Meaning | Default (when missing) |
|---|---|---|---|---|
| `group` | No | String | Sidebar group label | `""` |
| `order` | No | Number | Sort order within group | `9999` |
| `label` | No | String | Sidebar display text | Resource `Name` |
| `icon` | No | String | Quasar/Material icon id | `list_alt` |
| `route` | No | String | Frontend route path | `""` |
| `pageTitle` | No | String | Page title in UI | Resource `Name` |
| `pageDescription` | No | String | Subtitle/help text | `""` |
| `show` | No | Boolean | Show in sidebar menu | `true` |
| `menuAccess` | No | Object | Permission-based menu visibility rule (see `menuAccess` schema below) | `undefined` (fallback: `canRead` on own resource) |

**Fallback**: If the `Menu` cell is blank or `{}`, all fields auto-derive sensible defaults from the resource `Name` and `Scope`. This means existing resources continue working without migration.

### `menuAccess` Sub-schema

The `menuAccess` field inside `Menu` JSON controls whether a user sees the resource in the sidebar and can access its route. If `menuAccess` is absent, the fallback is `canRead` on the resource itself.

**Supported `menuAccess` formats:**

1. **No `menuAccess` field (absent or undefined)**
   - Fallback: User must have `canRead` on this resource.
   
2. **Single permission on own resource**
   ```json
   "menuAccess": { "require": "canWrite" }
   ```
   - User must have the specified permission on this resource.
   - `require` can be a string (`"canWrite"`) or array (`["canWrite", "canDelete"]`).
   - Array means ALL permissions must be true (AND).

3. **Cross-resource AND rule (all rules must pass)**
   ```json
   "menuAccess": {
     "all": [
       { "resource": "Products", "require": "canWrite" },
       { "resource": "Variants", "require": "canRead" }
     ]
   }
   ```
   - All listed rules must be satisfied.
   - Each rule specifies a `resource` name and `require` (string or array).
   - If `resource` is omitted in a rule, it defaults to the current resource.

4. **Cross-resource OR rule (any rule must pass)**
   ```json
   "menuAccess": {
     "any": [
       { "resource": "Products", "require": "canWrite" },
       { "resource": "Variants", "require": "canWrite" }
     ]
   }
   ```
   - At least ONE rule must be satisfied.
   - If no rules pass, access is denied.

**Evaluation Logic:**
- Frontend reads `menuAccess` from the auth payload and evaluates it against the current user's permissions.
- Used in: `MainLayout.vue` (sidebar filtering) and `router/index.js` (route guard).
- If `menuAccess` is malformed or absent, safe defaults apply (deny by default for defined rules, `canRead` fallback otherwise).

## Action & Progress Tracking Columns Convention

When a resource has `AdditionalActions` or uses a `Progress` state machine, the **sheet must include tracking columns** for each progress state or action. This provides a full audit trail of who did what and when.

### Column Naming Pattern
For each progress state `<STATE>`, add these columns to the sheet schema (in the setup script):
- `Progress<STATE>At` — Timestamp when the action/transition happened
- `Progress<STATE>By` — UserID who performed the action
- `Progress<STATE>Comment` — Optional comment/reason for the action

### Example: PurchaseRequisitions
Progress states: `PENDING → VERIFIED → APPROVED → REJECTED`

Required tracking columns:
```
ProgressPENDINGAt, ProgressPENDINGBy, ProgressPENDINGComment
ProgressVERIFIEDAt, ProgressVERIFIEDBy, ProgressVERIFIEDComment
ProgressAPPROVEDAt, ProgressAPPROVEDBy, ProgressAPPROVEDComment
ProgressREJECTEDAt, ProgressREJECTEDBy, ProgressREJECTEDComment
```

### When to Apply
| Condition | Action |
|---|---|
| Resource has `Progress` column with a state machine | Add tracking columns for **every** defined progress state |
| Resource has `AdditionalActions` like `Approve,Reject` | Add tracking columns for each action (`ApprovedAt/By/Comment`, `RejectedAt/By/Comment`) |
| Resource has only basic CRUD + `Status` (Active/Inactive) | No extra tracking columns needed — standard audit columns (`CreatedAt`, `UpdatedAt`, etc.) suffice |

### Checklist for Adding a New Progress State or Action
1. Add the new state/action value to the `progressValidation` array in the setup script.
2. Add the corresponding `Progress<STATE>At`, `Progress<STATE>By`, `Progress<STATE>Comment` columns to the `headers` array.
3. Add column widths for the new columns.
4. Update `RESOURCE_COLUMNS_GUIDE.md` and the relevant sheet structure doc.
5. Run the setup/refactor function to apply the new schema.

### Resources That Need This Pattern (Current)
| Resource | Progress States | AdditionalActions |
|---|---|---|
| Procurements | INITIATED → PR_CREATED → ... → COMPLETED/CANCELLED | — |
| PurchaseRequisitions | PENDING → VERIFIED → APPROVED/REJECTED | Approve, Reject, Verify |
| RFQs | DRAFT → PUBLISHED → CLOSED/CANCELLED | Publish, Close |
| RFQSuppliers | SENT → QUOTATION_RECEIVED → APPROVED/REJECTED | — |
| PurchaseOrders | DRAFT → APPROVED → SENT_TO_SUPPLIER → ACKNOWLEDGED → ACCEPTED/CANCELLED | Approve, Send, Acknowledge, Accept |
| Shipments | Draft → InTransit → Arrived → Cleared → Received | Submit, Dispatch, Arrive, Clear |
| PortClearance | Pending → InProgress → Cleared/Held | Submit, Hold, Clear |
| GoodsReceipts | Draft → Verified → Accepted | Verify, Accept |

## `ListViews` JSON Schema

The `ListViews` column stores a JSON array of view definitions. Each view defines a filter tree that controls which records appear when the view chip is selected.

### View Object
```json
{
  "name": "Pending/New",
  "default": true,
  "color": "warning",
  "filter": {
    "type": "group",
    "logic": "AND",
    "items": [...]
  }
}
```

| Field | Required | Type | Meaning |
|---|---|---|---|
| `name` | Yes | String | Display name shown on chip (also used as URL query value) |
| `default` | No | Boolean | If `true`, this view is selected by default. Only one view should be default. |
| `color` | No | String | Quasar color name for the chip (`positive`, `warning`, `negative`, `primary`, etc.) |
| `filter` | Yes | Object | Filter tree (group or condition) |

### Filter Group
```json
{ "type": "group", "logic": "AND", "items": [...] }
```
- `logic`: `AND` (all must match) or `OR` (any must match)
- `items`: Array of conditions or nested groups
- Empty `items: []` matches all records (useful for an explicit "All" view)

### Filter Condition
```json
{ "type": "condition", "column": "Status", "operator": "eq", "value": "Active" }
```

### Supported Operators (v1)
| Code | Label | Value Type |
|---|---|---|
| `eq` | Is equal to | Single value |
| `neq` | Is not equal to | Single value |
| `in` | Is one of | Array of values |
| `not_in` | Is not one of | Array of values |
| `gt` | Greater than | Single value |
| `gte` | Greater than or equal | Single value |
| `lt` | Less than | Single value |
| `lte` | Less than or equal | Single value |
| `contains` | Contains | Single value |

### Runtime Tokens
| Token | Resolved To |
|---|---|
| `$now` | Current timestamp (Unix ms) at evaluation time |

### Evaluation Rules
1. String comparisons are case-insensitive.
2. Numeric/date comparison attempts numeric coercion first; if coercion fails, fallback to string compare.
3. Missing column in a condition evaluates to `false`.
4. Empty group (`items: []`) evaluates to `true`.

### `ListViews` Mode Behavior (Single Column)
- `ListViews = ""` (blank cell): **Auto mode**
  - If resource has `Status` header: auto-generates `Active` (default) + `Inactive`.
  - If resource has no `Status` header: no view switcher shown.
- `ListViews = []`: **Off mode**
  - No view switcher is shown, even if `Status` exists.
- `ListViews = [ ...non-empty view objects... ]`: **Custom mode**
  - Uses only configured views (full override, no merge with defaults).

### Manage Lists UI Behavior (`AQL > Resources > Manage Lists`)
- When custom views exist, the dialog shows those views for edit/delete.
- When no custom views exist, the dialog shows a single select + `Update` control:
  - `Fallback to default Active/Inactive` (writes blank `ListViews` cell)
  - `Switch off ListViews for <Resource>` (writes `[]`)
- Adding a new view always saves a non-empty JSON array (custom mode).
- Deleting the last custom view writes `[]` (off mode).
