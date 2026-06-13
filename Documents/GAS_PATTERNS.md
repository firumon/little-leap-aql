# AQL - GAS Backend Patterns Guide

## Purpose
This document is the implementation-pattern reference for GAS work in AQL.

## When To Read This File
Read this file when you are changing GAS implementation, not for every task.

---

## Core Rule
- Prefer extending existing GAS files and existing patterns first.
- Create a new GAS file only when the current structure cannot support the task cleanly or safely.
- If a new pattern or file is needed, plan it first and document the reason.

---

## Preferred Pattern Order

| # | Pattern | When to use |
|---|---------|-------------|
| 1 | **Pure CRUD via resource metadata** | Standard create/read/update on a single resource |
| 2 | **PostAction hook** (`PostAction_after<Action>` or base fallback) | Non-blocking side-effects after supported write actions |
| 3 | **Bulk array write** (`bulk` / `dispatchBulkCreateRecords`) | Multi-record create/update in one call; returns fresh snapshot |
| 4 | **Additional actions** (`executeAction`) | Workflow transitions (Approve, Reject, Submit, etc.) |
| 5 | **Composite save** (`compositeSave`) | Atomic parent + children write with all-or-nothing validation |
| 6 | **Record fetch** (`record`) | Exact multi-resource, multi-code record lookup with canonical resource hydration |
| 7 | **Batch envelope** (`batch`) | Multiple sequential actions in one HTTP call, including explicit `$ref` dependencies |
| 8 | **Propose a new generic pattern** | Only if none of the above fit |

---

## Pattern: `batch` — Write + Read in one round-trip

Use `batch` when you need to write data and immediately get fresh rows back, or when later sub-requests depend on earlier sub-request outputs, without a second HTTP call.

**Shape:**
```json
{
  "action": "batch",
  "token": "...",
  "requests": [
    { "action": "compositeSave", "resource": "...", ... },
    { "action": "record", "payload": { "resources": [{ "resource": "...", "codes": [{ "$ref": "Procurements.latest.code" }] }] } },
    { "action": "bulk", "resource": "...", "payload": { "records": [{ "ReferenceCode": { "$ref": "Procurements.latest.code" } }] } }
  ]
}
```

**Batch dependency standard:**
- GAS creates batch context entries automatically from every successful sub-response by resource name.
- Frontend requests MUST NOT send custom `ref` names.
- Use explicit `{ "$ref": "ResourceName.latest.code" }`, `{ "$ref": "ResourceName.latest.record.Code" }`, `{ "$ref": "ResourceName.byCode.CODE.Field" }`, or `{ "$ref": "ResourceName.records.0.Field" }` objects in payload values.
- Frontend code MUST preserve `$ref` values as objects until GAS receives them. Do not pass `$ref` values through `String()`, template literals, concatenation, or generic text-normalization helpers.
- Frontend batch builders that may receive either a normal code or a `$ref` MUST use the shared `FRONTENT/src/composables/batchRefs.js` helpers: `batchRef(path)` to create refs and `textOrRef(value)` to preserve refs while trimming normal text.
- Use normal text helpers only for values that cannot be batch refs. Use `textOrRef(value)` for fields such as `code`, `ParentCode`, `ReferenceCode`, `SourceCode`, `TargetCode`, and same-batch foreign-key fields.
- Do not embed `$ref` values inside comments or other sentence strings. Either omit the same-batch generated code from the comment, write the comment after the code is known, or add an explicit backend template feature before using refs inside strings.
- `latest` means the latest successful output for that resource in the current batch.
- `byCode` is deterministic access for loaded or written records.
- Unresolved `$ref` paths fail the current sub-request. GAS does not infer missing fields.
- Do not use `__PENDING__` placeholders.

**Frontend flow after a batch create:**
1. Call `callGasApi('batch', { requests: [...] })`.
2. Read `data[0]` (save result) for `parentCode`.
3. Read `data[1].rows`, `data[2].rows` for fresh record arrays.
4. Inject fresh rows into IDB via `upsertResourceRows(resourceName, headers, rows)`.
   - `headers` come from `dataStore.headers[resourceName]` (already loaded at login).
   - `upsertResourceRows` triggers `onRowsUpserted` → auto-updates Pinia store.
5. Navigate — store is already hot; no second round-trip needed.

**Do NOT use** two separate `callGasApi` calls + `forceSync: true` as a workaround. That is two round-trips and risks a race condition where the view page loads before the second call resolves.

---

## Pattern: `record` — Exact record fetch with canonical hydration

Use `record` when a workflow needs exact records by `Code` across one or more resources and the frontend state must hydrate through the normal `data.resources` path.

**Shape:**
```json
{
  "action": "record",
  "payload": {
    "resources": [
      { "resource": "Procurements", "codes": ["PR2600001"] },
      { "resource": "GoodsReceipts", "codes": ["GRN2600001"] }
    ],
    "allowMissing": false
  }
}
```

Rules:
- `payload.resources[]` is required; there is no single-resource or single-code shortcut.
- `codes` must always be an array.
- GAS enforces normal read permission and record-level access on each matched row.
- Returned rows go to canonical `data.resources`; lookup maps and record objects go to `data.result`.

---

## Pattern: `compositeSave` — Atomic parent + children

Use when a parent record and its children must be written or rejected together.

- Validation phase runs first across all records. If anything fails, nothing is written.
- Child records use `_action`: `"create"` | `"update"` | `"deactivate"`.
- `_originalCode` identifies existing child rows for update/deactivate.
- Parent code is auto-injected into children (convention: `{SingularParentName}Code` or `ParentCode`).
- Response returns `{ parentCode }` plus delta resource payloads for directly affected parent/child resources.

---

## Pattern: PostAction hooks

If a resource has `PostAction` set in its config, GAS resolves hooks in this order for supported actions:
1. `{postAction}_after<Action>`
2. `{postAction}`

Supported actions:
- `create`
- `update`
- `bulk`
- `executeAction`
- `compositeSave`

Explicit exclusions:
- `get`
- `batch`

Canonical hook contract:
```js
function myPostAction(payload, result, auth, action, meta, resourceName) {
  if (!result || result.success !== true) return result;
  return result;
}
```

Action-specific example:
```js
function handleStockMovementsBulkSave_afterBulk(payload, result, auth, action, meta, resourceName) {
  var records = meta && Array.isArray(meta.savedRecords) ? meta.savedRecords : [];
  if (!records.length) return result;
  applyBatchStockMovementsToWarehouseStorages(records, auth);
  return result;
}
```

Base fallback example:
```js
function linkProcurementCodeToPurchaseRequisition_afterCreate(payload, result, auth, action, meta, resourceName) {
  var procurementCode = meta && meta.savedRecord ? meta.savedRecord.Code : '';
  var prCode = payload && payload.linkedPurchaseRequisitionCode ? payload.linkedPurchaseRequisitionCode : '';
  if (!procurementCode || !prCode) return result;
  updateResourceRecordFieldsByCode('PurchaseRequisitions', prCode, { ProcurementCode: procurementCode }, auth);
  return result;
}
```

Rules:
- Keep hook functions in the resource's dedicated hook file (for example `stockMovements.gs`, `procurement.gs`).
- Use the base hook name only in resource config; never store suffixes in `PostAction`.
- Treat `meta` as helper context, not as the public API contract.
- Hook failures are logged but never fail the write response.
- Do not hardcode resource-specific logic into `resourceApi.gs`.

---

## Pattern: `executeAction` — Workflow transitions

Use for progress/status changes that also need auto-fill fields (e.g. `ProgressApprovedAt`, `ProgressApprovedBy`).

- Sets `column = columnValue` on the record.
- Auto-fills `{column}{PascalCase(value)}At` and `{column}{PascalCase(value)}By` if those columns exist on the sheet, while preserving the exact stored `columnValue`.
- Accepts `fields: {}` for any additional columns to set in the same write.

---

## Anti-Patterns

| Anti-pattern | Correct alternative |
|---|---|
| Hardcoding resource names in `resourceApi.gs` | Use `PostAction` hook convention |
| Two HTTP calls (write then forceSync read) | Use `batch` envelope |
| Custom action shape for work a bulk/composite covers | Use `bulk` or `compositeSave` |
| New GAS file for every feature | Extend existing file unless structure is incompatible |
| Returning only `parentCode` from compositeSave then re-fetching | Return write-delta resources in the same response |
| Frontend-side placeholder patching for same-batch generated codes | Use explicit batch `$ref` objects resolved by GAS |
| Special-casing frontend state updates by request action | Return canonical `data.resources` and let generic ingestion update IDB/Pinia |

---

## Canonical Detail Owners
- Capability inventory: [GAS_API_CAPABILITIES.md](GAS_API_CAPABILITIES.md)
- Resource config semantics: [RESOURCE_COLUMNS_GUIDE.md](RESOURCE_COLUMNS_GUIDE.md)

## Maintenance Rule
Update this file when:
- a supported GAS implementation pattern changes
- a new backend extension pattern is approved
- the repo policy on reusing existing files versus creating new files changes
- changes are made to spreadsheet triggers, custom menu callbacks, or HTML dialog callbacks that require updating the multi-tenant template wrapper [tenant.gs](file:///f:/LITTLE%20LEAP/AQL/TENANTS/tenant.gs)
