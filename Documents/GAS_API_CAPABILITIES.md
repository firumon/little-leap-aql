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
- post-write hook support (strict PostAction dispatch for `create`, `update`, `bulk`, `executeAction`, `compositeSave`)
- additional actions / workflow transitions
- composite save for parent + children
- report generation
- batch action execution
- year-scoped code generation for operation-scope resources (e.g., PR26000001)
- view scope read-only behavior (no CRUD operations, full dataset return without pagination)
- delta sync via `lastUpdatedAt` cursor
- strict nested write payloads (`payload.record` / `payload.data`)
- delta-on-write for `create`, `update`, `bulk`, `executeAction`, and `compositeSave`

---

## Canonical Transport Envelope (v1)

All requests and responses use one transport envelope.

### Request
```json
{
  "requestId": "uuid",
  "action": "get",
  "resource": ["Products", "Procurements"],
  "token": "...",
  "payload": {
    "includeInactive": true,
    "lastUpdatedAtByResource": {
      "Products": 1713400000000
    }
  }
}
```

Rules:
- `scope` is not required in request payload.
- `resource` supports string or array.
- `requestId` is echoed in the response.

### Response
```json
{
  "success": true,
  "requestId": "uuid",
  "action": "get",
  "error": null,
  "message": "",
  "data": {
    "resources": {
      "Products": {
        "rows": [["..."], ["..."]],
        "meta": { "resource": "Products", "lastSyncAt": 1713400000999 }
      }
    },
    "result": {},
    "artifacts": {}
  },
  "meta": {
    "serverTime": 1713400000999,
    "version": "v1"
  }
}
```

Rules:
- Resource payloads are header-light by default.
- Header refresh is explicit via authorized-resources fallback.

---

## Action Reference

### `get` — Read records
```json
{
  "requestId": "uuid",
  "action": "get",
  "resource": ["PurchaseRequisitions", "PurchaseRequisitionItems"],
  "payload": {
    "includeInactive": false,
    "lastUpdatedAtByResource": {
      "PurchaseRequisitions": 1713400000000,
      "PurchaseRequisitionItems": 1713400000000
    }
  }
}
```
- Resource can be single or multi-resource.
- Delta cursor can be provided per-resource in `payload.lastUpdatedAtByResource`.
- Response resource rows are emitted under `data.resources[resourceName].rows`.

### `create` — Create a single record
```json
{
  "requestId": "uuid",
  "action": "create",
  "resource": "Products",
  "payload": {
    "record": {
      "Name": "Widget",
      "Status": "Active"
    },
    "lastUpdatedAtByResource": {
      "Products": 1713400000000
    }
  }
}
```
- Write fields must be nested under `payload.record`.
- Top-level write fields are rejected.
- Code is auto-generated from `codePrefix` + sequence.
- Response includes scalar result + resource delta under canonical envelope `data.resources`.

### `update` — Update a single record
```json
{
  "requestId": "uuid",
  "action": "update",
  "resource": "Products",
  "payload": {
    "code": "PRD000001",
    "record": {
      "Name": "Widget v2"
    },
    "lastUpdatedAtByResource": {
      "Products": 1713400000000
    }
  }
}
```
- Only provided fields are merged; omitted fields keep existing values.
- Response includes scalar result + resource delta under canonical envelope `data.resources`.

### `bulk` — Batch create/update via records array
```json
{
  "requestId": "uuid",
  "action": "bulk",
  "resource": "SKUs",
  "payload": {
    "targetResource": "SKUs",
    "records": [
      { "Code": "SK001", "Name": "Red" },
      { "Name": "Blue" }
    ],
    "lastUpdatedAtByResource": {
      "SKUs": 1713400000000
    }
  }
}
```
- Records with an existing `Code` are updated; records without `Code` are inserted.
- Writes are batched: all inserts in one `setValues` call; updates are individual (scattered rows).
- Response includes write summary in `data.result` and delta rows in `data.resources` for directly affected resources.

### `compositeSave` — Atomic parent + children save
```json
{
  "action": "compositeSave",
  "resource": "PurchaseRequisitions",
  "payload": {
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
    ],
    "lastUpdatedAtByResource": {
      "PurchaseRequisitions": 1713400000000,
      "PurchaseRequisitionItems": 1713400000000
    }
  }
}
```
- `code` present → edit; absent → create (auto-generates parent code).
- Validates ALL records first; writes nothing if any validation fails (all-or-nothing).
- Parent code is automatically injected into children via `resolveParentCodeField` convention (`PurchaseRequisitionCode`, `ParentCode`, etc.).
- Child `_action`: `"create"` | `"update"` | `"deactivate"`.
- Response includes `{ parentCode }` in `data.result` and delta rows in `data.resources` for directly affected parent/child resources.

### `executeAction` — Workflow transition
```json
{
  "action": "executeAction",
  "resource": "PurchaseRequisitions",
  "payload": {
    "code": "PR26000001",
    "actionName": "Approve",
    "column": "Progress",
    "columnValue": "Approved",
    "fields": { "ProgressApprovedComment": "Looks good" },
    "lastUpdatedAtByResource": {
      "PurchaseRequisitions": 1713400000000
    }
  }
}
```
- Sets `column = columnValue` on the record.
- Auto-fills `{column}{PascalCase(value)}At` (timestamp) and `{column}{PascalCase(value)}By` (UserID) if those columns exist, while storing the original `columnValue` unchanged.
- `fields`: any additional columns to set in the same write.
- Response includes action result in `data.result` and resource delta in `data.resources`.

### `batch` — Multiple actions in one round-trip
```json
{
  "requestId": "uuid",
  "action": "batch",
  "payload": {
    "requests": [
      { "requestId": "uuid-1", "action": "compositeSave", "resource": "PurchaseRequisitions", "payload": { ... } },
      { "requestId": "uuid-2", "action": "get", "resource": ["PurchaseRequisitions"], "payload": { "includeInactive": true } },
      { "requestId": "uuid-3", "action": "get", "resource": ["PurchaseRequisitionItems"], "payload": { "includeInactive": true } }
    ]
  }
}
```
- Requests execute **sequentially** in order. Later requests see writes made by earlier ones.
- Each request can be any valid protected action (`get`, `create`, `update`, `bulk`, `compositeSave`, `executeAction`, etc.).
- Each sub-request includes its own `action` field; the outer `token` covers all.
- Response:
```json
{
  "success": true,
  "requestId": "uuid",
  "action": "batch",
  "data": {
    "result": {
      "responses": [
        { "success": true, "requestId": "uuid-1", "action": "compositeSave", "data": { "result": { "parentCode": "PR26000001" } } },
        { "success": true, "requestId": "uuid-2", "action": "get", "data": { "resources": { "PurchaseRequisitions": { "rows": [[...]], "meta": { ... } } } } },
        { "success": true, "requestId": "uuid-3", "action": "get", "data": { "resources": { "PurchaseRequisitionItems": { "rows": [[...]], "meta": { ... } } } } }
      ]
    },
    "resources": {
      "PurchaseRequisitions": { "rows": [[...]], "meta": { "resource": "PurchaseRequisitions", "lastSyncAt": 1713400000999 } },
      "PurchaseRequisitionItems": { "rows": [[...]], "meta": { "resource": "PurchaseRequisitionItems", "lastSyncAt": 1713400000999 } }
    }
  }
}
```
- `success` at top level is `false` if any sub-request fails.
- Individual results remain available under `data.result.responses[]` in the same request order.
- `data.resources` is the aggregated final resource payload map across sub-responses.

**Primary use case:** combine a write with an immediate read in one call so the frontend can update IDB without a second round-trip. Example: `compositeSave` + two `get` calls returns the created record and all affected children in one response.

---

## PostAction Dispatch Contract

Resources can set `PostAction` in `APP.Resources` to trigger non-blocking side effects after supported write actions.

Supported trigger actions:
- `create`
- `update`
- `bulk`
- `executeAction`
- `compositeSave`

Explicit exclusions:
- `get`
- `batch`

Resolution order for each supported action:
1. `{postAction}_after<Action>`
2. `{postAction}`

Action suffix mapping:
- `create` -> `_afterCreate`
- `update` -> `_afterUpdate`
- `bulk` -> `_afterBulk`
- `executeAction` -> `_afterExecuteAction`
- `compositeSave` -> `_afterCompositeSave`

Hook signature is strict:
```js
function myPostAction(payload, result, auth, action, meta, resourceName) {}
```

Argument notes:
- `payload`: original request payload for the completed action.
- `result`: raw handler result that will be wrapped into the API envelope.
- `auth`: authenticated user context.
- `action`: one of the supported action names above.
- `meta`: server-built helper context such as `savedRecord`, `savedRecords`, `previousRecord`, `parentRecord`, or child write summaries when available.
- `resourceName`: canonical resource being processed.

Behavior rules:
- Missing hook functions are treated as a silent no-op.
- Hook errors are logged and never fail the main API response.
- Config stores only the base `PostAction` name; dispatch suffixing is resolved in GAS.

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
- For write actions, use nested payload objects only (`payload.record` / `payload.data` / `payload.records`). Top-level write fields are invalid.
- Write actions return deltas for directly affected resources, using `payload.lastUpdatedAtByResource` and `includeInactive=true` on server-side write-delta reads.
- Use `batch` when you need packed sequential actions in one HTTP call; consume ordered per-request outputs from `data.result.responses`.

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
- canonical envelope fields or resource payload contract change
