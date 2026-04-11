# AQL — GAS API Capabilities Reference

This document is the **living reference** for everything the GAS backend can do out of the box.

**Every agent working on AQL must read this document before writing any new module, page, or composable.**

When starting a new feature, first check this document. If existing capabilities cover the requirement — use them directly. Only propose a new pattern if none of the existing ones can satisfy the need, and even then, discuss first (see [When to escalate](#when-to-escalate)).

---

## Table of Contents

1. [Action → Handler Reference](#action--handler-reference)
2. [Capability: Standard CRUD](#capability-standard-crud)
3. [Capability: Bulk Create / Update (array payload)](#capability-bulk-create--update-array-payload)
4. [Capability: Bulk Upload (UI import / data restore)](#capability-bulk-upload-ui-import--data-restore)
5. [Capability: PostAction Hook (after-create side effect)](#capability-postaction-hook-after-create-side-effect)
6. [Capability: PostAction Bulk Handler](#capability-postaction-bulk-handler)
7. [Capability: PreAction (reserved)](#capability-preaction-reserved)
8. [Capability: Additional Actions (Approve / Reject / etc.)](#capability-additional-actions-approve--reject--etc)
9. [Capability: Composite Save (Parent + Children)](#capability-composite-save-parent--children)
10. [Capability: Reports](#capability-reports)
11. [Capability: Batch Actions](#capability-batch-actions)
12. [Resource Config Reference (syncAppResources.gs)](#resource-config-reference-syncappresourcesgs)
13. [Rule: No New GAS Files](#rule-no-new-gas-files)
14. [When to Escalate](#when-to-escalate)

---

## Action → Handler Reference

| Frontend `action` | Payload shape | GAS function called | Notes |
|---|---|---|---|
| `get` | `{ resource, scope }` | `handleMasterGetRecords` | Supports `lastUpdatedAt` delta filter |
| `get` | `{ resources: [...], scope }` | `handleMasterGetMultiRecords` | Fetch multiple resources in one call |
| `create` | `{ resource, record: {} }` | `handleMasterCreateRecord` → `dispatchAfterCreateHook` | Single create; fires `{postAction}_afterCreate` if set |
| `create` | `{ resource, records: [] }` | `dispatchBulkCreateRecords` → PostAction or `handleBulkUpsertRecords` | **Array payload = automatic bulk path** |
| `update` | `{ resource, code, record: {} }` | `handleMasterUpdateRecord` | Single update |
| `update` | `{ resource, records: [] }` | `dispatchBulkCreateRecords` → PostAction or `handleBulkUpsertRecords` | **Array payload = automatic bulk path** |
| `bulk` | `{ resource: 'BulkUploadMasters', targetResource, records: [] }` | `dispatchBulkAction` → PostAction (`handleBulkUpsertRecords`) | **Reserved for Bulk Upload UI only** |
| `compositeSave` | `{ resource, data, children: [] }` | `handleCompositeSave` | Parent + children atomic save |
| `executeAction` | `{ resource, code, actionName, column, columnValue }` | `handleExecuteAction` | Approve / Reject / custom status transitions |
| `generateReport` | `{ resource, reportId, ... }` | `generateReportPdf` | PDF report generation |
| `batch` | `{ requests: [{...}, {...}] }` | `handleBatchActions` | Executes multiple actions sequentially |
| `login` | `{ email, password }` | `handleLogin` | Public — no token required |

---

## Capability: Standard CRUD

**What it is**: Create, read, update a single record. No custom code needed.

**When to use**: Any resource where rows are created/updated one at a time and no side effects are required.

**Setup**: Add the resource to `APP_RESOURCES_CODE_CONFIG` in `syncAppResources.gs`. Leave `PostAction` and `PreAction` blank.

**Frontend calls**:
```javascript
// Read
await callGasApi('get', { scope: 'master', resource: 'Products' })

// Create
await callGasApi('create', { scope: 'master', resource: 'Products', record: { Name: 'Widget' } })

// Update
await callGasApi('update', { scope: 'master', resource: 'Products', code: 'PRD00001', record: { Name: 'Widget Pro' } })
```

**GAS code required**: None.

---

## Capability: Bulk Create / Update (array payload)

**What it is**: Send N records in one HTTP call instead of one call per record. The GAS layer automatically detects `records: []` and routes to the appropriate handler.

**When to use**: Any time the frontend needs to save multiple rows at once — operational entries (stock movements, GRN lines, etc.) or any multi-row form submit.

**How it works**:
1. Frontend sends `action=create` (or `update`) with `records: [...]` instead of a single `record: {}`.
2. `dispatchGenericMasterCrudAction` detects the array and calls `dispatchBulkCreateRecords`.
3. `dispatchBulkCreateRecords` checks if the resource has a `PostAction`:
   - **PostAction set** → calls the PostAction handler directly. The handler owns the write pipeline.
   - **No PostAction** → falls back to `handleBulkUpsertRecords` (generic upsert — same engine as Bulk Upload).

**Frontend call**:
```javascript
// Bulk create (N rows, 1 GAS round-trip)
await callGasApi('create', {
  scope: 'operation',
  resource: 'StockMovements',
  records: [
    { WarehouseCode: 'WH01', SKU: 'SKU001', QtyChange: 10 },
    { WarehouseCode: 'WH01', SKU: 'SKU002', QtyChange: 5 }
  ]
})
```

**GAS code required**: None for pure CRUD resources. Add a PostAction handler only if a side effect (e.g., updating another sheet) is needed.

> **Important**: Do NOT use `action=bulk` for operational saves. `action=bulk` is reserved for the Bulk Upload UI only.

---

## Capability: Bulk Upload (UI import / data restore)

**What it is**: The Bulk Upload page (`/bulk-upload`) lets admins import master data (Products, Suppliers, etc.) from pasted tab-separated text or a CSV file. It upserts records: creates if no matching Code, updates if Code already exists.

**When to use**: Only from the Bulk Upload UI. Not for operational/transactional saves.

**How it works**:
1. Frontend (`useBulkUpload.js`) calls `bulkMasterRecords(targetResourceName, records)` in `resourceRecords.js`.
2. That function sends `action=bulk, resource=BulkUploadMasters, targetResource=Products, records=[...]`.
3. `dispatchBulkAction` reads `BulkUploadMasters.PostAction = 'handleBulkUpsertRecords'` and calls it.
4. `handleBulkUpsertRecords` in `masterApi.gs`:
   - Opens the **target** resource sheet once.
   - Validates all rows (required fields, uniqueness).
   - Inserts new rows as one `setValues` block.
   - Updates changed rows individually.
   - Returns the full sheet snapshot so IDB can be refreshed.

**Resources that support Bulk Upload**: Any resource in `APP_RESOURCES_CODE_CONFIG` with `Functional: FALSE` and `canWrite` permission. The upload page auto-populates the resource selector.

**Frontend service call**:
```javascript
// resourceRecords.js — already built
await bulkMasterRecords('Products', records)
```

**GAS code required**: None. `handleBulkUpsertRecords` is generic.

---

## Capability: PostAction Hook (after-create side effect)

**What it is**: After a single record is created via `action=create`, GAS automatically calls a hook function `{postAction}_afterCreate(record, auth)` if the resource has `PostAction` set.

**When to use**: When creating one record should trigger a side effect on another sheet — e.g., a single StockMovements row updating WarehouseStorages.

**Setup**:
```javascript
// syncAppResources.gs
PostAction: 'myResourceHandler',
```

```javascript
// In an existing .gs file (not a new file)
function myResourceHandler_afterCreate(record, auth) {
  // record = plain object { ColumnName: value, ... }
  // Do the side effect here. Never throw — ledger row is already committed.
}
```

**Flow**:
```
action=create, record: {} 
  → handleMasterCreateRecord
      → writes row
      → dispatchAfterCreateHook
          → calls myResourceHandler_afterCreate(record, auth)
```

**GAS code required**: One `_afterCreate` function in an existing file.

---

## Capability: PostAction Side-Effect Hooks

**What it is**: PostAction names a set of hook functions that fire as side effects — AFTER the generic write machinery has already committed the data. PostAction is NOT a write handler; it is a side-effect trigger.

Three hook conventions based on the write path:

| Write path | Hook called | Signature |
|---|---|---|
| Single create (`action=create, record: {}`) | `{postAction}_afterCreate` | `fn(record, auth)` |
| Bulk create/update (`action=create, records: []`) | `{postAction}_afterBulk` | `fn(records, auth)` |
| Bulk Upload UI (`action=bulk`) | PostAction itself as primary handler | `fn(auth, payload)` |

**Typical uses for `_afterCreate` / `_afterBulk`**:
- Update a derived/aggregated sheet (e.g. WarehouseStorages stock totals)
- Send an email or push notification
- Call an external API (UrlFetchApp)

**Setup**:
```javascript
// syncAppResources.gs
PostAction: 'myResourceHandler',
```

```javascript
// In an existing .gs file — add only the hooks you need
// Called after single create
function myResourceHandler_afterCreate(record, auth) {
  // record = plain object { ColumnName: value, ... }
  // NEVER throw — the ledger row is already committed
}

// Called after bulk array write
function myResourceHandler_afterBulk(records, auth) {
  // records = original records[] from the payload
  // NEVER throw
}
```

**Flow — single create**:
```
action=create, record: {}
  → handleMasterCreateRecord (writes row)
  → dispatchAfterCreateHook → myResourceHandler_afterCreate(record, auth)
```

**Flow — bulk**:
```
action=create, records: []
  → dispatchBulkCreateRecords
      → handleBulkUpsertRecords (writes all rows generically)
      → dispatchAfterBulkHook → myResourceHandler_afterBulk(records, auth)
```

**Real example**: `handleStockMovementsBulkSave_afterBulk` / `handleStockMovementsBulkSave_afterCreate` in `stockMovements.gs` — update WarehouseStorages totals after rows are written.

---

## Capability: PreAction (reserved)

**What it is**: A `PreAction` field exists in `APP.Resources` and is read into `config.preAction` by `resourceRegistry.gs`. It is reserved for a future validation/transformation hook that runs **before** a record is written.

**Current status**: Not yet implemented in any handler. The field is stored but not called.

**When it will be used**: When a resource needs to validate or transform incoming data before the generic write pipeline executes — e.g., checking inventory availability before creating a dispatch order.

**How to implement when needed**: Add `dispatchPreActionHook(config, payload, auth)` to `masterApi.gs` following the same pattern as `dispatchAfterCreateHook`. Call it before the write in `handleMasterCreateRecord` / `handleMasterUpdateRecord`. Document the change here.

---

## Capability: Additional Actions (Approve / Reject / etc.)

**What it is**: Record-level status transitions triggered from the UI (Approve, Reject, Send, etc.). Sets a named column value + auto-fills `{Column}{Value}At` and `{Column}{Value}By` audit fields.

**When to use**: When a record needs to move through a workflow state (Pending → Approved → Dispatched).

**Setup** (no GAS code required):
```javascript
// syncAppResources.gs
AdditionalActions: JSON.stringify([
  {
    action: 'Approve',
    label: 'Approve',
    column: 'Progress',
    columnValue: 'Approved',
    icon: 'check_circle',
    color: 'positive'
  }
]),
```

**Frontend call**:
```javascript
await callGasApi('executeAction', {
  resource: 'Procurements',
  code: 'PRC00001',
  actionName: 'Approve',
  column: 'Progress',
  columnValue: 'Approved',
  fields: { ProgressApprovedComment: 'LGTM' }   // optional extra fields
})
```

**GAS code required**: None. `handleExecuteAction` in `masterApi.gs` is fully generic.

---

## Capability: Composite Save (Parent + Children)

**What it is**: Atomically save a parent record and one or more child resource records in a single call. Validates everything first; writes only if all validations pass.

**When to use**: Forms that save a parent and its detail lines together — e.g., Product + SKUs, Purchase Order + line items.

**Frontend call** (no GAS code required):
```javascript
await callGasApi('compositeSave', {
  resource: 'Products',
  data: { Name: 'Widget', Category: 'Feeding' },
  // code: 'PRD00001',   ← include for edit, omit for create
  children: [{
    resource: 'SKUs',
    records: [
      { data: { Variant1: 'Blue', Variant2: '125ml' }, _action: 'create' },
      { data: { Variant1: 'Pink', Variant2: '125ml' }, _action: 'create' },
      { data: { Code: 'SKU003' }, _action: 'deactivate' }
    ]
  }]
})
```

`_action` values: `'create'`, `'update'`, `'deactivate'`.

**GAS code required**: None. `handleCompositeSave` in `masterApi.gs` is fully generic.

---

## Capability: Reports

**What it is**: Generate a PDF from a Google Sheets template, filled with data from a resource.

**Setup**:
```javascript
// syncAppResources.gs
Reports: JSON.stringify([{
  id: 'rep_unique_id',
  name: 'product-list',
  label: 'Product List',
  templateSheet: 'ProductList',
  isRecordLevel: false,
  inputs: [],
  pdfOptions: {}
}]),
```

**Frontend call**:
```javascript
await callGasApi('generateReport', { resource: 'Products', reportId: 'rep_unique_id' })
```

---

## Capability: Batch Actions

**What it is**: Execute multiple independent API actions sequentially in a single HTTP call.

**When to use**: When a single user interaction needs to cause multiple mutations and/or reads, and you want to avoid the high latency of multiple server round-trips. Example: create `StockMovements` and immediately fetch the updated `WarehouseStorages` in one call.

**Frontend call**:
```javascript
const response = await callGasApi('batch', {
  requests: [
    {
      action: 'create',
      scope: 'operation',
      resource: 'StockMovements',
      records: [...]
    },
    {
      action: 'get',
      scope: 'operation',
      resource: 'WarehouseStorages',
      includeInactive: true
    }
  ]
})

// response.data will be an array of results, one for each request
const [createResult, getResult] = response.data
```

**GAS code required**: None. `handleBatchActions` in `apiDispatcher.gs` is fully generic.

---

## Resource Config Reference (syncAppResources.gs)

All resource metadata is defined in `APP_RESOURCES_CODE_CONFIG` in `syncAppResources.gs`. This is the **single source of truth**. After any change, run `AQL 🚀 > Setup & Refactor > Sync APP.Resources from Code`.

| Field | Type | Purpose |
|---|---|---|
| `Name` | string | Resource identifier (used in all API calls) |
| `Scope` | string | `master`, `operation`, `accounts`, `report` |
| `SheetName` | string | The Google Sheet tab name |
| `FileID` | string | Sheet file ID (blank = use Config sheet resolution) |
| `CodePrefix` | string | Prefix for auto-generated codes (e.g., `'PRD'`) |
| `CodeSequenceLength` | number | Zero-padded code length (default 6) |
| `Menu` | JSON | `[{ group: ['Section'], label: 'Label', route: '/path', icon: '...' }]` |
| `UIFields` | JSON | Field definitions for the UI form |
| `RequiredHeaders` | JSON | Fields that must be non-empty on create/update |
| `UniqueHeaders` | JSON | Fields that must be unique per resource |
| `Audit` | bool | Whether to auto-fill `CreatedAt/By`, `UpdatedAt/By` |
| `IncludeInAuthorizationPayload` | bool | Include headers+rows in the login response |
| `Functional` | bool | Functional resource (hidden from Bulk Upload selector) |
| `PreAction` | string | Reserved — pre-write hook (not yet wired) |
| `PostAction` | string | Function name for after-create hook + bulk handler |
| `AdditionalActions` | JSON | Record-level status transition actions |
| `Reports` | JSON | PDF report definitions |
| `ListViews` | JSON | Named filter/sort presets for the list page |
| `CustomUIName` | string | Override the default Vue component name |

---

## Rule: No New GAS Files

The GAS file set is fixed. Do NOT create a new `.gs` file for each module or resource.

| If you need... | Use... |
|---|---|
| Pure CRUD (no side effects) | Add to `syncAppResources.gs`. Zero GAS code. |
| Side effect on single create | `PostAction` + `{handler}_afterCreate` in existing file |
| Side effect on bulk save | `PostAction` + `{handler}(auth, payload)` in existing file |
| Workflow status transition | `AdditionalActions` JSON in `syncAppResources.gs`. Zero GAS code. |
| Atomic parent+child save | `action=compositeSave`. Zero GAS code. |
| A new generic pattern | Write a plan in `PLANS/` first (see below) |

Hook functions belong in `stockMovements.gs` (for StockMovements) or a similarly named file that groups hooks for related resources. Never put resource-specific logic in `masterApi.gs`, `apiDispatcher.gs`, or `resourceRegistry.gs`.

---

## When to Escalate

If a feature cannot be implemented with any existing capability, **stop and discuss with the user** before writing code.

Escalation triggers:
- Required logic would need a new `case` in `apiDispatcher.gs` for a specific resource
- Required logic would need an `if (resourceName === 'X')` check in `masterApi.gs`
- Required data flow cannot be expressed as create/update/bulk/compositeSave/executeAction
- A new `.gs` file would be needed for the module
- The PreAction hook would need to be implemented (reserved capability)

When escalating, provide:
1. What the feature needs that existing patterns don't cover
2. Which pattern comes closest and why it falls short
3. A proposed new pattern (if you have one) — with minimal surface area

Document the approved new pattern in this file and in `GAS_PATTERNS.md` before implementing.
