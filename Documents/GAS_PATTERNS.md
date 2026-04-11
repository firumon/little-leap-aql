# AQL — GAS Backend Patterns Guide

This document is the authoritative implementation reference for all AI agents and developers working on the GAS backend. Read this **before** writing any GAS code.

For a complete picture of what the backend can do out of the box, see:
→ **[`Documents/GAS_API_CAPABILITIES.md`](GAS_API_CAPABILITIES.md)** — read this first before designing a new feature.

---

## Cardinal Rule: No New GAS Files

**Do NOT create a new `.gs` file for each module or feature.**

The GAS project has a fixed set of files. New resource-specific logic belongs inside one of the existing files, attached to an existing pattern. If none of the patterns below fit, write a plan in `PLANS/` first and get it approved before implementing.

| File | Purpose |
|---|---|
| `apiDispatcher.gs` | `doPost`, action routing. Do NOT add resource-specific cases here. |
| `masterApi.gs` | Generic CRUD handlers + hook dispatchers. Do NOT hardcode resource names. |
| `resourceRegistry.gs` | Resource config resolution, permission checks. No business logic. |
| `auth.gs` | Login, token validation. No business logic. |
| `sheetHelpers.gs` | Low-level sheet utilities (findRow, generateCode, audit fields). |
| `stockMovements.gs` | Hook functions for StockMovements. **Pattern example — see below.** |
| `syncAppResources.gs` | `APP_RESOURCES_CODE_CONFIG` — all resource metadata lives here. |

---

## Pattern 1: Standard Resource (No Hooks)

**Use when**: Pure CRUD — create, read, update rows. No side effects.

**Steps**:
1. Add resource to `APP_RESOURCES_CODE_CONFIG` in `syncAppResources.gs`.
2. Leave `PostAction: ''`, `PreAction: ''`.
3. Done — `create` / `update` / `get` handle everything.

**GAS code required**: None.

---

## Pattern 2: After-Create Hook (Single Record Side Effect)

**Use when**: Creating one record should trigger a side effect on another sheet.

**Example**: `StockMovements` single create → upsert `WarehouseStorages`.

### Setup

**`syncAppResources.gs`**:
```javascript
PostAction: 'myResourceHandler',
```

**Existing hook file** — add the `_afterCreate` function:
```javascript
// Naming convention: {PostAction}_afterCreate(record, auth)
function myResourceHandler_afterCreate(record, auth) {
  // record = plain object { ColumnName: value, ... }
  // Do side effect. NEVER throw — the ledger row is already committed.
}
```

### Flow
```
action=create, record: {}
  → handleMasterCreateRecord
      → writes row to sheet
      → dispatchAfterCreateHook → myResourceHandler_afterCreate(record, auth)
```

---

## Pattern 3: Bulk Save with Side Effect (array payload)

**Use when**: Frontend sends N records at once and a side effect must run after all inserts (e.g., update stock totals).

**Frontend call**:
```javascript
// Send records[] — GAS auto-detects array and routes to dispatchBulkCreateRecords
await callGasApi('create', {        // action=create (NOT bulk)
  scope: 'operation',
  resource: 'StockMovements',
  records: [{ ... }, { ... }]
})
```

> **Important**: Use `action=create` (not `action=bulk`). `action=bulk` is reserved exclusively for the Bulk Upload UI page.

### Setup

**`syncAppResources.gs`** — same PostAction:
```javascript
PostAction: 'myResourceHandler',
```

**Hook file** — add the `_afterBulk` side-effect hook:
```javascript
// Naming convention: {PostAction}_afterBulk(records, auth)
// Called AFTER handleBulkUpsertRecords has written all rows.
function myResourceHandler_afterBulk(records, auth) {
  // records = original records[] from the payload
  // Do the side effect here (update another sheet, send notification, etc.)
  // NEVER throw — rows are already committed
}
```

### Flow
```
action=create, records: []
  → dispatchBulkCreateRecords
      → handleBulkUpsertRecords (writes all rows generically)
      → dispatchAfterBulkHook → myResourceHandler_afterBulk(records, auth)
```

---

## Pattern 4: Generic Bulk Upsert (No Side Effect, array payload)

**Use when**: Bulk create/update of records for a resource that has no PostAction — no side effects needed, just write the rows.

The same `action=create, records: []` path applies. When there is no PostAction, `dispatchBulkCreateRecords` falls back to `handleBulkUpsertRecords` automatically.

**No GAS code required.** Just leave `PostAction: ''` in `syncAppResources.gs`.

---

## Pattern 5: Bulk Upload UI (Data Import / Restore)

**Use when**: An admin is importing master data from the Bulk Upload page in the app (paste CSV / upload file).

This is the **only** legitimate use of `action=bulk`.

**Frontend** (`useBulkUpload.js` → `bulkMasterRecords`):
```javascript
await callGasApi('bulk', {
  scope: 'master',
  resource: 'BulkUploadMasters',     // functional caller resource
  callerResource: 'BulkUploadMasters',
  targetResource: 'Products',        // actual target sheet
  records: [...]
})
```

**GAS**: `dispatchBulkAction` → `BulkUploadMasters.PostAction = 'handleBulkUpsertRecords'` → generic upsert.

**Do not use `action=bulk` for operational page saves** — use `action=create, records: []` instead.

---

## Pattern 6: Additional Actions (Approve / Reject / etc.)

**Use when**: A record needs status transitions (Approve, Reject, Send, etc.).

**`syncAppResources.gs`**:
```javascript
AdditionalActions: JSON.stringify([
  { action: 'Approve', label: 'Approve', column: 'Progress', columnValue: 'Approved', icon: 'check_circle', color: 'positive' }
]),
```

**Frontend**:
```javascript
await callGasApi('executeAction', {
  resource: 'Procurements',
  code: 'PRC00001',
  actionName: 'Approve',
  column: 'Progress',
  columnValue: 'Approved',
  fields: { ProgressApprovedComment: 'LGTM' }
})
```

**GAS code required**: None. `handleExecuteAction` is fully generic.

---

## Pattern 7: Composite Save (Parent + Children)

**Use when**: A form saves a parent record and child rows atomically.

**Frontend**:
```javascript
await callGasApi('compositeSave', {
  resource: 'Products',
  data: { Name: 'Widget' },
  children: [{
    resource: 'SKUs',
    records: [
      { data: { Variant1: 'Blue' }, _action: 'create' },
      { data: { Variant1: 'Pink' }, _action: 'create' }
    ]
  }]
})
```

**GAS code required**: None. `handleCompositeSave` validates all, writes all or nothing.

---

## When Patterns Are Not Enough

If a feature genuinely can't be satisfied by any of the above patterns:

1. **Stop**. Do not write code yet.
2. Write a Brain Agent plan in `PLANS/` describing the new pattern.
3. Discuss with the user — explain what the existing patterns can't cover.
4. Get approval and document the new pattern here and in `GAS_API_CAPABILITIES.md`.
5. Implement the pattern **generically** (no resource names in core files).

See [GAS_API_CAPABILITIES.md — When to Escalate](GAS_API_CAPABILITIES.md#when-to-escalate) for the full escalation checklist.

---

## PostAction Hook Naming Convention

PostAction is a **side-effect trigger**, not a write handler. The write always happens first via generic machinery; hooks run after.

| Write path | Hook function name | Signature |
|---|---|---|
| Single create | `{postAction}_afterCreate` | `fn(record, auth)` |
| Bulk array write | `{postAction}_afterBulk` | `fn(records, auth)` |
| Bulk Upload UI (`action=bulk`) | `{postAction}` directly (primary handler) | `fn(auth, payload)` |

All hook functions must be in the **same file**. Add only the hooks the resource needs. Never throw inside a hook — the rows are already committed.

---

## Anti-Patterns (Never Do These)

```javascript
// ❌ Hardcode resource names in masterApi.gs or apiDispatcher.gs
if (resourceName === 'StockMovements') { ... }

// ❌ Add resource-specific action cases in apiDispatcher.gs
case 'batchStockMovements': return handleBatchStockMovements(auth, data);

// ❌ Use action=bulk for operational/page saves
await callGasApi('bulk', { resource: 'StockMovements', records: [...] })
// ✅ Correct: use action=create with records[]
await callGasApi('create', { resource: 'StockMovements', records: [...] })

// ❌ Create a new .gs file for each resource's logic
// stockMovements.gs — exists only for hook functions, not a full handler module
// procurements.gs  — DON'T create this

// ✅ Use PostAction + hook convention
// ✅ Use action=create + records[] for operational bulk saves
// ✅ Define all resource metadata in syncAppResources.gs
```

---

## Reference: Action → GAS Handler Map

| Frontend action | Payload | GAS function | Notes |
|---|---|---|---|
| `get` | `{ resource }` | `handleMasterGetRecords` | Supports `lastUpdatedAt` delta |
| `get` | `{ resources: [...] }` | `handleMasterGetMultiRecords` | Multi-resource in one call |
| `create` | `{ record: {} }` | `handleMasterCreateRecord` → `dispatchAfterCreateHook` | Fires `{postAction}_afterCreate` |
| `create` | `{ records: [] }` | `dispatchBulkCreateRecords` → PostAction or `handleBulkUpsertRecords` | Array = auto bulk path |
| `update` | `{ code, record: {} }` | `handleMasterUpdateRecord` | Single record |
| `update` | `{ records: [] }` | `dispatchBulkCreateRecords` → PostAction or `handleBulkUpsertRecords` | Array = auto bulk path |
| `bulk` | `{ resource: 'BulkUploadMasters', targetResource }` | `dispatchBulkAction` → PostAction | **Bulk Upload UI only** |
| `compositeSave` | `{ resource, data, children }` | `handleCompositeSave` | Atomic parent+children |
| `executeAction` | `{ resource, code, actionName }` | `handleExecuteAction` | AdditionalActions workflow |
| `generateReport` | `{ resource, reportId }` | `generateReportPdf` | PDF generation |
| `login` | `{ email, password }` | `handleLogin` | Public, no token |
