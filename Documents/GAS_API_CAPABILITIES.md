# AQL - GAS API Capabilities Reference

## Purpose
This document describes what the GAS backend can already do before a new backend design or implementation path is proposed.

## When To Read This File
Read this file when:
- designing new backend behavior
- checking whether an existing GAS capability already covers a request
- planning or implementing backend changes

Do not treat this as a universal startup read for every task.

---

## Current Capability Areas
- generic CRUD by action/scope/resource
- bulk create/update with `records: []`
- bulk upload flow for the dedicated Bulk Upload UI
- post-write hook support (e.g., PostAction-based cross-resource progress sync)
- additional actions / workflow transitions
- composite save for parent + children
- report generation
- batch action execution
- year-scoped code generation for operation-scope resources (e.g., PR26000001)
- view scope read-only behavior (no CRUD operations, full dataset return without pagination)
- delta sync via `lastUpdatedAt` cursor

---

## Action Reference

### `get` — Read records
```json
{
  "action": "get",
  "resource": "PurchaseRequisitions",
  "scope": "operation",
  "includeInactive": false,
  "lastUpdatedAt": 1713400000000
}
```
- `lastUpdatedAt` (Unix ms): delta cursor — only rows with `UpdatedAt > lastUpdatedAt` are returned. Omit for full fetch.
- `scope` resolves the correct sheet; defaults to `"master"` when omitted.
- Response: `{ success, rows: [[...]], meta: { resource, fileId, sheetName, hasDeltaFilter, lastSyncAt } }`
- **Note:** `rows` are raw arrays parallel to `meta.headers` is NOT included in the response. The frontend uses its cached headers from the initial authorized-resources sync.

### `create` — Create a single record
```json
{
  "action": "create",
  "resource": "Products",
  "Name": "Widget",
  "Status": "Active"
}
```
- Fields are read from the top-level payload (or from a nested `record: {}` object).
- Code is auto-generated from `codePrefix` + sequence.
- Response: `{ success, data: { code: "PRD000001" } }`

### `update` — Update a single record
```json
{
  "action": "update",
  "resource": "Products",
  "code": "PRD000001",
  "Name": "Widget v2"
}
```
- Only provided fields are merged; omitted fields keep existing values.
- Response: `{ success, data: { code } }`

### `bulk` — Batch create/update via records array
```json
{
  "action": "bulk",
  "resource": "SKUs",
  "records": [
    { "Code": "SK001", "Name": "Red" },
    { "Name": "Blue" }
  ]
}
```
- Records with an existing `Code` are updated; records without `Code` are inserted.
- Writes are batched: all inserts in one `setValues` call; updates are individual (scattered rows).
- Response includes `rows` (full fresh snapshot), `headers`, `meta`, and a results summary `{ created, updated, skipped, errors[] }`.

### `compositeSave` — Atomic parent + children save
```json
{
  "action": "compositeSave",
  "resource": "PurchaseRequisitions",
  "scope": "operation",
  "data": { "PRDate": "2026-04-18", "Type": "STOCK", "Priority": "Medium" },
  "children": [
    {
      "resource": "PurchaseRequisitionItems",
      "records": [
        { "_action": "create",     "data": { "SKU": "CK2-G3", "Quantity": 5 } },
        { "_action": "update",     "_originalCode": "PRI26000001", "data": { "Quantity": 10 } },
        { "_action": "deactivate", "_originalCode": "PRI26000002", "data": {} }
      ]
    }
  ]
}
```
- `code` present → edit; absent → create (auto-generates parent code).
- Validates ALL records first; writes nothing if any validation fails (all-or-nothing).
- Parent code is automatically injected into children via `resolveParentCodeField` convention (`PurchaseRequisitionCode`, `ParentCode`, etc.).
- Child `_action`: `"create"` | `"update"` | `"deactivate"`.
- Response: `{ success, data: { parentCode } }` — **does not return fresh rows**. Use `batch` if you need fresh data after save.

### `executeAction` — Workflow transition
```json
{
  "action": "executeAction",
  "resource": "PurchaseRequisitions",
  "code": "PR26000001",
  "actionName": "Approve",
  "column": "Progress",
  "columnValue": "Approved",
  "fields": { "ProgressApprovedComment": "Looks good" }
}
```
- Sets `column = columnValue` on the record.
- Auto-fills `{column}{value}At` (timestamp) and `{column}{value}By` (UserID) if those columns exist.
- `fields`: any additional columns to set in the same write.
- Response: `{ success, data: { code, column, columnValue } }`

### `batch` — Multiple actions in one round-trip
```json
{
  "action": "batch",
  "requests": [
    { "action": "compositeSave", "resource": "PurchaseRequisitions", ... },
    { "action": "get",           "resource": "PurchaseRequisitions",     "scope": "operation", "includeInactive": true },
    { "action": "get",           "resource": "PurchaseRequisitionItems", "scope": "operation", "includeInactive": true }
  ]
}
```
- Requests execute **sequentially** in order. Later requests see writes made by earlier ones.
- Each request can be any valid protected action (`get`, `create`, `update`, `bulk`, `compositeSave`, `executeAction`, etc.).
- Each sub-request includes its own `action` field; the outer `token` covers all.
- Response:
```json
{
  "success": true,
  "message": "Batch actions completed successfully",
  "data": [
    { "success": true, "data": { "parentCode": "PR26000001" } },
    { "success": true, "rows": [[...]], "meta": { ... } },
    { "success": true, "rows": [[...]], "meta": { ... } }
  ]
}
```
- `success` at the top level is `false` if **any** sub-request failed.
- Individual results are always present in `data[]` regardless of failure — inspect each `data[i].success`.

**Primary use case:** combine a write with an immediate read in one call so the frontend can update IDB without a second round-trip. Example: `compositeSave` + two `get` calls returns the created record and all affected children in one response.

---

## Delta Sync — `lastUpdatedAt` cursor

All `get` calls support delta filtering:
- Send `lastUpdatedAt: <Unix ms>` to receive only rows where `UpdatedAt > lastUpdatedAt`.
- Omit `lastUpdatedAt` (or send `null`) for a full fetch.
- The response `meta.lastSyncAt` is the timestamp the frontend should store as the next cursor.
- Row-level filter: `updatedDate.getTime() <= lastUpdatedAt.getTime()` → row is excluded.

---

## Key Rules
- Prefer existing capabilities before proposing new backend patterns.
- Resource metadata belongs in `syncAppResources.gs`.
- Operational multi-record saves should use the supported bulk-array path, not invent custom action shapes when an existing pattern fits.
- Use `batch` when you need a write + immediate read in one call. Do not use two separate HTTP calls with `forceSync` as a workaround.

---

## Canonical Detail Owners
- Implementation patterns and anti-patterns: [GAS_PATTERNS.md](GAS_PATTERNS.md)
- Resource metadata semantics: [RESOURCE_COLUMNS_GUIDE.md](RESOURCE_COLUMNS_GUIDE.md)
- Task-based reading expectations: [DOC_ROUTING.md](DOC_ROUTING.md)

## When To Escalate
Escalate when the requirement cannot be covered by current generic CRUD, hook, batch, action, or composite-save patterns.

## Maintenance Rule
Update this file when:
- a backend capability is added, removed, or materially changed
- a new generic backend pattern becomes officially supported
- escalation guidance changes
