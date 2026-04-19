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
| 2 | **After-create hook** (`PostAction_afterCreate`) | Side-effects after a single record write (e.g. update a derived sheet) |
| 3 | **Bulk array write** (`bulk` / `dispatchBulkCreateRecords`) | Multi-record create/update in one call; returns fresh snapshot |
| 4 | **Additional actions** (`executeAction`) | Workflow transitions (Approve, Reject, Submit, etc.) |
| 5 | **Composite save** (`compositeSave`) | Atomic parent + children write with all-or-nothing validation |
| 6 | **Batch envelope** (`batch`) | Multiple independent actions in one HTTP call |
| 7 | **Propose a new generic pattern** | Only if none of the above fit |

---

## Pattern: `batch` — Write + Read in one round-trip

Use `batch` when you need to write data and immediately get fresh rows back, without a second HTTP call.

**Shape:**
```json
{
  "action": "batch",
  "token": "...",
  "requests": [
    { "action": "compositeSave", "resource": "...", ... },
    { "action": "get", "resource": "...", "scope": "operation", "includeInactive": true },
    { "action": "get", "resource": "...", "scope": "operation", "includeInactive": true }
  ]
}
```

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

## Pattern: `compositeSave` — Atomic parent + children

Use when a parent record and its children must be written or rejected together.

- Validation phase runs first across all records. If anything fails, nothing is written.
- Child records use `_action`: `"create"` | `"update"` | `"deactivate"`.
- `_originalCode` identifies existing child rows for update/deactivate.
- Parent code is auto-injected into children (convention: `{SingularParentName}Code` or `ParentCode`).
- Response returns only `{ parentCode }`. Pair with `batch` if you need fresh rows immediately.

---

## Pattern: After-create / after-bulk hooks

If a resource has `PostAction` set in its config, GAS calls `{postAction}_afterCreate(record, auth)` after a single create and `{postAction}_afterBulk(records, auth)` after a bulk write.

- Hook failures are logged but never fail the write response.
- Keep hook functions in the resource's dedicated hook file (e.g. `stockMovements.gs`).
- Do not hardcode resource-specific logic into `masterApi.gs`.

---

## Pattern: `executeAction` — Workflow transitions

Use for progress/status changes that also need auto-fill fields (e.g. `ProgressApprovedAt`, `ProgressApprovedBy`).

- Sets `column = columnValue` on the record.
- Auto-fills `{column}{value}At` and `{column}{value}By` if those columns exist on the sheet.
- Accepts `fields: {}` for any additional columns to set in the same write.

---

## Anti-Patterns

| Anti-pattern | Correct alternative |
|---|---|
| Hardcoding resource names in `masterApi.gs` | Use `PostAction` hook convention |
| Two HTTP calls (write then forceSync read) | Use `batch` envelope |
| Custom action shape for work a bulk/composite covers | Use `bulk` or `compositeSave` |
| New GAS file for every feature | Extend existing file unless structure is incompatible |
| Returning only `parentCode` from compositeSave then re-fetching | Use `batch` to combine save + get |

---

## Canonical Detail Owners
- Capability inventory: [GAS_API_CAPABILITIES.md](GAS_API_CAPABILITIES.md)
- Resource config semantics: [RESOURCE_COLUMNS_GUIDE.md](RESOURCE_COLUMNS_GUIDE.md)

## Maintenance Rule
Update this file when:
- a supported GAS implementation pattern changes
- a new backend extension pattern is approved
- the repo policy on reusing existing files versus creating new files changes
