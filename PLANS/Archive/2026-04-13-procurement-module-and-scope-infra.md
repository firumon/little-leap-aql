# PLAN: Procurement Module Schema + View Scope + Scope Infrastructure
**Status**: IN_PROGRESS
**Created**: 2026-04-13
**Created By**: Brain Agent (Claude Opus 4.6)
**Executed By**: Build Agent

## Objective
Implement the foundational schema and backend changes for the Procurement module (PurchaseRequisitions, PurchaseRequisitionItems, UOM master), introduce the `view` scope for formula-driven read-only sheets, make scope infrastructure data-driven via `App.Config.Scopes`, and switch operation-scope code generation to a year-scoped format.

## Context
- PurchaseRequisitions already exists as a skeleton in `setupOperationSheets.gs` and `syncAppResources.gs` — this plan expands it.
- PurchaseRequisitionItems also exists as a skeleton — this plan redefines its columns.
- UOM is a new master resource.
- The `view` scope is a new concept: formula-driven, read-only sheets in a separate spreadsheet file.
- Scope validation is currently hardcoded in `normalizeResourceScope()` and `apiDispatcher.gs` — must become data-driven.
- Code generation (`generateNextCode`) currently uses `<Prefix><Sequence>` — operation-scope resources must switch to `<Prefix><2DigitYear><Sequence>`.

## Pre-Conditions
- [ ] Existing codebase is on `main` branch, clean state.
- [ ] Google Sheet already has PurchaseRequisitions and PurchaseRequisitionItems sheet names created (setup scripts will update columns).

---

## Steps

### Step 1: Add `Scopes` to App.Config and make scope validation data-driven

**Goal**: Remove hardcoded scope lists. Scopes are now defined as a CSV value in `App.Config` sheet under the key `Scopes`.

#### 1a. Add config-driven scope reader in `sheetHelpers.gs`

Add a new function after `getAppConfigValue` (~line 191):

```javascript
/**
 * Returns the list of valid scopes from App.Config "Scopes" key.
 * Falls back to a default set if not configured.
 */
function getConfiguredScopes() {
  var raw = getAppConfigValue('Scopes');
  if (!raw) return ['master', 'operation', 'accounts', 'report', 'view'];
  return raw.toString().split(',').map(function(s) { return s.trim().toLowerCase(); }).filter(Boolean);
}
```

**Files**: `GAS/sheetHelpers.gs`

#### 1b. Rewrite `normalizeResourceScope()` in `resourceRegistry.gs`

**Current** (lines 251-259): Hardcoded if-chain with `master, operation, accounts, report, system`.

**Replace with**:
```javascript
function normalizeResourceScope(value) {
  var normalized = (value || 'master').toString().trim().toLowerCase();
  var validScopes = getConfiguredScopes();
  if (validScopes.indexOf(normalized) !== -1) return normalized;
  throw new Error('Invalid scope value: "' + value + '". Must be one of: ' + validScopes.join(', ') + '.');
}
```

This removes `system` scope and makes validation dynamic.

**Files**: `GAS/resourceRegistry.gs` (lines 251-259)

#### 1c. Rewrite `canonicalScopes` in `apiDispatcher.gs`

**Current** (line 156): `const canonicalScopes = ['master', 'operation', 'accounts', 'report'];`

**Replace with**:
```javascript
const canonicalScopes = getConfiguredScopes();
```

**Files**: `GAS/apiDispatcher.gs` (line 156)

#### 1d. Block write operations for `view` scope in API dispatcher

In the `dispatchGenericMasterCrudAction` area or the CRUD validation function (around line 152-161 in `apiDispatcher.gs`), add a check: if the resolved resource scope is `view`, only allow `get` action. Block `create`, `update`, `bulk`.

Find where action validation happens and add:
```javascript
// After resolving the resource config for the request
if (resourceConfig && resourceConfig.scope === 'view') {
  if (normalizedAction !== 'get') {
    return { success: false, error: 'View-scope resources are read-only.' };
  }
}
```

**Files**: `GAS/apiDispatcher.gs`
**Rule**: `view` scope = read-only. No create/update/delete/bulk.

#### 1e. Handle `view` scope in read API — return all non-empty rows

When reading a `view`-scope resource, skip pagination and return all rows that have data. The existing read logic likely uses pagination params. For `view` scope, override to return full dataset but filter out empty rows (rows where all cells are blank — formula rows with no source data).

Find the generic read/get handler and add scope-aware logic:
```javascript
// If scope is 'view', return all non-empty rows (no pagination)
if (resourceConfig.scope === 'view') {
  // Filter out rows where all visible columns are empty
  // Return full dataset without offset/limit
}
```

**Files**: `GAS/masterApi.gs` (in the generic get/read handler)
**Rule**: View-scope reads return all rows with data. No pagination.

---

### Step 2: Update `Constants.gs` — add UOM to MASTER_SHEETS and VIEW_SHEETS

**Current**: `CONFIG.MASTER_SHEETS` has Products, SKUs, Suppliers, Warehouses, Ports, Carriers.

**Add** to `MASTER_SHEETS`:
```javascript
UOMS: 'UOMs',
```

**Add** new section after `ACCOUNTS_SHEETS`:
```javascript
VIEW_SHEETS: {
  // Placeholder — view sheets will be added as they are designed
}
```

**Files**: `GAS/Constants.gs`

---

### Step 3: Add AppOptions seed entries

**Current** `APP_OPTIONS_SEED` in `Constants.gs` (lines 65-67):
```javascript
const APP_OPTIONS_SEED = {
  StockMovementReferenceType: ['GRN', 'DirectEntry', 'StockAdjustment']
};
```

**Add three new entries**:
```javascript
const APP_OPTIONS_SEED = {
  StockMovementReferenceType: ['GRN', 'DirectEntry', 'StockAdjustment'],
  PurchaseRequisitionType: ['STOCK', 'PROJECT', 'SALES', 'ASSET'],
  PurchaseRequisitionPriority: ['Low', 'Medium', 'High', 'Urgent'],
  PurchaseRequisitionProgress: ['Draft', 'New', 'Approved', 'Rejected', 'RFQ Processed']
};
```

**Files**: `GAS/Constants.gs` (lines 65-67)

---

### Step 4: Update PurchaseRequisitions resource config in `syncAppResources.gs`

**Current** (lines 234-260): Skeleton with `ProcurementCode, Progress, ProgressPENDINGAt/By/Comment, Status, AccessRegion`.

**Replace the entire PurchaseRequisitions entry** with:

```javascript
{
    Name: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITIONS,
    Scope: 'operation',
    ParentResource: CONFIG.OPERATION_SHEETS.PROCUREMENTS,
    IsActive: 'TRUE',
    SheetName: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITIONS,
    CodePrefix: 'PR',
    CodeSequenceLength: 6,
    LastDataUpdatedAt: 0,
    Audit: 'TRUE',
    RequiredHeaders: 'ProcurementCode,Type,Priority',
    UniqueHeaders: '',
    UniqueCompositeHeaders: '',
    DefaultValues: '{"Status":"Active","Progress":"Draft"}',
    RecordAccessPolicy: 'OWNER_AND_UPLINE',
    OwnerUserField: 'CreatedBy',
    AdditionalActions: 'Submit,Approve,Reject',
    Menu: JSON.stringify([{ group: ['Operations', 'Procurement'], order: 1, label: 'Purchase Requisitions', icon: 'request_quote', route: '/operations/prs', pageTitle: 'Purchase Requisitions', pageDescription: 'Internal requests for purchase', show: true }]),
    UIFields: JSON.stringify([]),
    IncludeInAuthorizationPayload: 'TRUE',
    Functional: 'FALSE',
    PreAction: '',
    PostAction: '',
    Reports: '',
    CustomUIName: '',
    ListViews: ''
}
```

**Key changes**:
- `RequiredHeaders`: `ProcurementCode,Type,Priority`
- `DefaultValues`: Progress changed from `PENDING` to `Draft`
- `AdditionalActions`: `Submit,Approve,Reject` — Submit moves Draft→New, Approve/Reject are progress actions from New onwards

**Files**: `GAS/syncAppResources.gs` (lines 234-260)

---

### Step 5: Update PurchaseRequisitionItems resource config in `syncAppResources.gs`

**Current** (lines 261-287): Has `PRCode, SKU` required, `CodePrefix: 'PRI'`, `Audit: 'TRUE'`.

**Replace the entire PurchaseRequisitionItems entry** with:

```javascript
{
    Name: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITION_ITEMS,
    Scope: 'operation',
    ParentResource: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITIONS,
    IsActive: 'TRUE',
    SheetName: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITION_ITEMS,
    CodePrefix: '',
    CodeSequenceLength: 0,
    LastDataUpdatedAt: 0,
    Audit: 'FALSE',
    RequiredHeaders: 'PRCode,SKU,UOM,Quantity',
    UniqueHeaders: '',
    UniqueCompositeHeaders: 'PRCode+SKU',
    DefaultValues: '{"Quantity":0,"EstimatedRate":0}',
    RecordAccessPolicy: 'OWNER_AND_UPLINE',
    OwnerUserField: 'CreatedBy',
    AdditionalActions: '',
    Menu: JSON.stringify([{ group: ['Operations', 'Procurement'], order: 3, label: 'PR Items', icon: 'list', route: '', pageTitle: 'PR Items', pageDescription: 'Items in Purchase Requisition', show: false }]),
    UIFields: JSON.stringify([]),
    IncludeInAuthorizationPayload: 'TRUE',
    Functional: 'FALSE',
    PreAction: '',
    PostAction: '',
    Reports: '',
    CustomUIName: '',
    ListViews: ''
}
```

**Key changes**:
- `CodePrefix: ''` and `CodeSequenceLength: 0` — no auto-generated code for items
- `Audit: 'FALSE'` — no audit columns for items
- `RequiredHeaders`: `PRCode,SKU,UOM,Quantity`
- `DefaultValues`: `Quantity: 0, EstimatedRate: 0`

**Files**: `GAS/syncAppResources.gs` (lines 261-287)

---

### Step 6: Add UOM master resource config in `syncAppResources.gs`

**Add a new entry** in the MASTER RESOURCES section (after Carriers, before the operation resources):

```javascript
{
    Name: CONFIG.MASTER_SHEETS.UOMS,
    Scope: 'master',
    IsActive: 'TRUE',
    SheetName: CONFIG.MASTER_SHEETS.UOMS,
    CodePrefix: '',
    CodeSequenceLength: 0,
    LastDataUpdatedAt: 0,
    Audit: 'TRUE',
    RequiredHeaders: 'Code,Name',
    UniqueHeaders: 'Code',
    UniqueCompositeHeaders: '',
    DefaultValues: '{"Status":"Active"}',
    RecordAccessPolicy: 'ALL',
    OwnerUserField: 'CreatedBy',
    AdditionalActions: '',
    Menu: JSON.stringify([{ group: ['Masters', 'Product'], order: 3, label: 'UOMs', icon: 'straighten', route: '/masters/uoms', pageTitle: 'Units of Measure', pageDescription: 'Manage units of measure', show: true }]),
    UIFields: JSON.stringify([
        { header: 'Code', label: 'Code', type: 'text', required: true },
        { header: 'Name', label: 'Name', type: 'text', required: true },
        { header: 'BaseUOM', label: 'Base UOM', type: 'text' },
        { header: 'ConversionFactor', label: 'Conversion Factor', type: 'number' },
        { header: 'Status', label: 'Status', type: 'status', required: true }
    ]),
    IncludeInAuthorizationPayload: 'TRUE',
    Functional: 'FALSE',
    PreAction: '',
    PostAction: '',
    Reports: '',
    CustomUIName: '',
    ListViews: ''
}
```

**Key points**:
- `CodePrefix: ''` and `CodeSequenceLength: 0` — Code is user-entered (meaningful codes like `kg`, `g`, `m`)
- `UniqueHeaders: 'Code'` — enforce unique codes

**Files**: `GAS/syncAppResources.gs`

---

### Step 7: Update PurchaseRequisitions sheet schema in `setupOperationSheets.gs`

**Current** (lines 28-33): Skeleton headers `Code, ProcurementCode, Progress, ProgressPENDINGAt/By/Comment, Status, AccessRegion`.

**Replace the PurchaseRequisitions schema entry** with:

```javascript
{
    resourceName: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITIONS,
    headers: ['Code', 'ProcurementCode', 'PRDate', 'Type', 'Priority', 'RequiredDate', 'WarehouseCode', 'TypeReferenceCode', 'Progress',
              'ProgressApprovedAt', 'ProgressApprovedBy', 'ProgressApprovedComment',
              'ProgressRejectedAt', 'ProgressRejectedBy', 'ProgressRejectedComment',
              'Status', 'AccessRegion'].concat(commonAuditColumns),
    statusDefault: 'Active',
    defaults: { Status: 'Active', Progress: 'Draft' },
    progressValidation: ['Draft', 'New', 'Approved', 'Rejected', 'RFQ Processed'],
    columnWidths: {
        Code: 150, ProcurementCode: 150, PRDate: 130, Type: 100, Priority: 100,
        RequiredDate: 130, WarehouseCode: 140, TypeReferenceCode: 160, Progress: 130,
        ProgressApprovedAt: 160, ProgressApprovedBy: 150, ProgressApprovedComment: 200,
        ProgressRejectedAt: 160, ProgressRejectedBy: 150, ProgressRejectedComment: 200,
        Status: 100, AccessRegion: 130
    }
}
```

**Also add dropdown validations** for Type and Priority using AppOptions. Check if `setupOperationSheets.gs` supports custom validations. If not, add after the existing validation block:
```javascript
if (schema.typeValidation && schema.headers.indexOf('Type') !== -1) {
    setup_applyListValidation(sheet, schema.headers, 'Type', schema.typeValidation);
}
if (schema.priorityValidation && schema.headers.indexOf('Priority') !== -1) {
    setup_applyListValidation(sheet, schema.headers, 'Priority', schema.priorityValidation);
}
```

And add to the PR schema object:
```javascript
typeValidation: APP_OPTIONS_SEED.PurchaseRequisitionType,
priorityValidation: APP_OPTIONS_SEED.PurchaseRequisitionPriority,
```

**Files**: `GAS/setupOperationSheets.gs` (lines 28-33, and the validation block ~lines 194-205)

---

### Step 8: Update PurchaseRequisitionItems sheet schema in `setupOperationSheets.gs`

**Current** (lines 36-41): `Code, PRCode, SKU, Quantity, ExpectedDate, Notes, Status` + audit.

**Replace** with:

```javascript
{
    resourceName: CONFIG.OPERATION_SHEETS.PURCHASE_REQUISITION_ITEMS,
    headers: ['PRCode', 'SKU', 'UOM', 'Quantity', 'EstimatedRate'],
    defaults: { Quantity: 0, EstimatedRate: 0 },
    columnWidths: { PRCode: 150, SKU: 150, UOM: 100, Quantity: 100, EstimatedRate: 130 }
}
```

**Key changes**:
- No `Code` column (no auto-generated code)
- No `Status` column
- No audit columns
- No `statusDefault` or `statusValidation`
- Columns: `PRCode, SKU, UOM, Quantity, EstimatedRate`

**Files**: `GAS/setupOperationSheets.gs` (lines 36-41)

---

### Step 9: Add UOM master sheet schema in `setupMasterSheets.gs`

**Add a new schema entry** to the `schemaByResource` array (after Carriers):

```javascript
{
    resourceName: CONFIG.MASTER_SHEETS.UOMS,
    headers: ['Code', 'Name', 'BaseUOM', 'ConversionFactor', 'Status'].concat(commonAuditColumns),
    statusDefault: 'Active',
    defaults: { Status: 'Active' },
    columnWidths: {
        Code: 100, Name: 200, BaseUOM: 100, ConversionFactor: 150, Status: 100,
        CreatedAt: 170, UpdatedAt: 170, CreatedBy: 140, UpdatedBy: 140
    }
}
```

**Files**: `GAS/setupMasterSheets.gs`

---

### Step 10: Year-scoped code generation for operation-scope resources

**Goal**: Change `generateNextCode` so that operation-scope resources produce codes like `PR26000001` instead of `PR000001`. Master-scope resources keep the old format.

#### 10a. Add a new function `generateNextYearScopedCode` in `masterApi.gs`

Add after the existing `generateNextCode` function (~line 729):

```javascript
/**
 * Generates a year-scoped code: <Prefix><2DigitYear><PaddedSequence>
 * Scans only codes matching the current year to determine next sequence.
 * Example: PR26000001, PR26000002, ... PR27000001 (year rollover)
 */
function generateNextYearScopedCode(values, idx, prefix, sequenceLength) {
  var year2 = new Date().getFullYear().toString().slice(-2);
  var escapedPrefix = escapeRegex(prefix);
  var codePattern = new RegExp('^' + escapedPrefix + year2 + '(\\d+)$');
  var maxSeq = 0;

  for (var i = 1; i < values.length; i++) {
    var code = (values[i][idx.Code] || '').toString().trim();
    var match = code.match(codePattern);
    if (match) {
      var num = Number(match[1]);
      if (num > maxSeq) maxSeq = num;
    }
  }

  var nextSeq = maxSeq + 1;
  return prefix + year2 + padSequence(nextSeq, sequenceLength);
}
```

**Files**: `GAS/masterApi.gs` (after line 729)

#### 10b. Modify the code generation call site to be scope-aware

Find where `generateNextCode` is called during record creation. It should check the resource scope: if `operation`, use `generateNextYearScopedCode`; otherwise use the existing `generateNextCode`.

Search for the call site of `generateNextCode` in `masterApi.gs` and wrap it:

```javascript
// Replace the direct call:
//   var newCode = generateNextCode(values, idx, config.codePrefix, config.codeSequenceLength);
// With:
var newCode;
if (config.scope === 'operation') {
  newCode = generateNextYearScopedCode(values, idx, config.codePrefix, config.codeSequenceLength);
} else {
  newCode = generateNextCode(values, idx, config.codePrefix, config.codeSequenceLength);
}
```

**Important**: This only affects records created from now onwards. Existing codes are untouched — the year-scoped regex only matches current-year codes, so old codes like `PR000001` won't interfere with sequence numbering.

**Files**: `GAS/masterApi.gs` (find the `generateNextCode` call site)
**Rule**: `CodeSequenceLength` means only the sequence portion (not including the 2-digit year). So `PR` prefix + `26` year + `000001` (6-digit sequence) = `PR26000001`.

---

### Step 11: Update frontend scope handling

#### 11a. Syncable resources filter in `resourceRecords.js`

**Current** (line 77): `return ['master', 'operation', 'accounts'].includes(scope) && ...`

**Replace with** a dynamic check. The `view` scope should NOT be in this list (no auto-sync). Options:
1. Add all scopes except `view` dynamically, OR
2. Exclude `view` explicitly.

Since the user wants sync TTL per scope kept as `{scope}SyncTTL` keys, and `view` has no sync:

```javascript
// Replace hardcoded scope list with: all scopes except 'view' (view is on-demand only)
return scope !== 'view' && entry?.permissions?.canRead !== false && entry?.name && entry?.functional !== true
```

This makes it open to any scope being syncable except `view`. If a new scope later needs exclusion, it can be handled then.

**Files**: `FRONTENT/src/services/resourceRecords.js` (line 77)

#### 11b. Route scope pattern in `routes.js`

**Current** (line 53): `path: '/:scope(masters|operations|accounts)/:resourceSlug'`

The route pattern needs to include `views` for the view scope. But rather than hardcoding another value, derive from config.

**Option A (simple, recommended for now)**: Add `views` to the regex:
```javascript
path: '/:scope(masters|operations|accounts|views)/:resourceSlug',
```

**Option B (dynamic)**: Use a broader catch-all pattern and validate in the route guard. This is more future-proof but requires a route guard change.

**Recommendation**: Use Option A for now. The route regex is a low-churn place and adding a scope here is a once-per-scope-lifetime event.

**Files**: `FRONTENT/src/router/routes.js` (line 53)

---

### Step 12: Manual Configuration in Google Sheet

These are actions the **user** must perform manually in the Google Sheet (cannot be done by code):

- [ ] Add row in `App.Config` sheet: Key = `Scopes`, Value = `master,operation,accounts,report,view`
- [ ] Add row in `App.Config` sheet: Key = `ViewFileID`, Value = `<the spreadsheet ID of the new View file>`
- [ ] Create the new View spreadsheet file in Google Drive (empty for now)
- [ ] Run `syncAppResourcesFromCode` from AQL menu to sync all resource changes
- [ ] Run `setupMasterSheets` from AQL menu to create the UOM sheet
- [ ] Run `setupOperationSheets` from AQL menu to update PR and PR Items sheets
- [ ] Run `setupAppSheets` from AQL menu to seed the new AppOptions entries

---

## Documentation Updates Required
- [ ] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` — add note about `view` scope characteristics (read-only, no CRUD, no audit, no code gen).
- [ ] Update `Documents/GAS_API_CAPABILITIES.md` — add year-scoped code generation as a capability, add view scope read-only behavior.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` — record the scope infrastructure change and procurement module initiation.

---

## Acceptance Criteria
- [ ] `normalizeResourceScope('view')` returns `'view'` without error.
- [ ] `normalizeResourceScope('system')` throws an error (removed).
- [ ] `App.Config` `Scopes` key is the single source of truth for valid scopes.
- [ ] Creating a PurchaseRequisition generates a code like `PR26000001` (year-scoped).
- [ ] Creating a master record (e.g., Product) still generates `PRD00001` (old format preserved).
- [ ] PurchaseRequisitions sheet has columns: Code, ProcurementCode, PRDate, Type, Priority, RequiredDate, WarehouseCode, TypeReferenceCode, Progress, ProgressApprovedAt/By/Comment, ProgressRejectedAt/By/Comment, Status, AccessRegion, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy.
- [ ] PurchaseRequisitionItems sheet has columns: PRCode, SKU, UOM, Quantity, EstimatedRate (no Code, no Status, no audit).
- [ ] UOMs master sheet has columns: Code, Name, BaseUOM, ConversionFactor, Status, CreatedAt, UpdatedAt, CreatedBy, UpdatedBy.
- [ ] UOM Code is user-entered (no auto-generation).
- [ ] AppOptions sheet has entries for PurchaseRequisitionType, PurchaseRequisitionPriority, PurchaseRequisitionProgress.
- [ ] Default Progress for new PR is `Draft`.
- [ ] `view`-scope resources cannot be created/updated/deleted via API.
- [ ] `view`-scope read returns all non-empty rows (no pagination).
- [ ] Frontend route pattern includes `views` scope.
- [ ] Frontend sync excludes `view`-scope resources from auto-sync.

---

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

### Progress Log
- [x] Step 1 completed — Scope infrastructure (data-driven)
- [x] Step 2 completed — Constants update
- [x] Step 3 completed — AppOptions seed
- [x] Step 4 completed — PR resource config
- [x] Step 5 completed — PR Items resource config
- [x] Step 6 completed — UOM resource config
- [x] Step 7 completed — PR sheet schema
- [x] Step 8 completed — PR Items sheet schema
- [x] Step 9 completed — UOM sheet schema
- [x] Step 10 completed — Year-scoped code generation
- [ ] Step 11 completed — Frontend scope handling
- [ ] Step 12 completed — Manual config (user)
- [x] Documentation Updates Required

### Deviations / Decisions
- [ ] `[?]` Decision needed:
- [ ] `[!]` Issue/blocker:

### Files Actually Changed
- `GAS/sheetHelpers.gs`
- `GAS/resourceRegistry.gs`
- `GAS/apiDispatcher.gs`
- `GAS/Constants.gs`
- `GAS/syncAppResources.gs`
- `GAS/setupOperationSheets.gs`
- `GAS/setupMasterSheets.gs`
- `GAS/masterApi.gs`
- `FRONTENT/src/services/resourceRecords.js`
- `FRONTENT/src/router/routes.js`

### Validation Performed
- [ ] `normalizeResourceScope` tested with valid and invalid scopes
- [ ] Code generation tested for operation-scope (year-scoped) and master-scope (plain)
- [ ] API dispatch tested: view scope blocks writes, allows reads
- [ ] Sheet setup scripts produce correct column layouts

### Manual Actions Required
- [ ] Add `Scopes` key to `App.Config` sheet with value: `master,operation,accounts,report,view`
- [ ] Add `ViewFileID` key to `App.Config` sheet with the new View spreadsheet ID
- [ ] Create the View spreadsheet file in Google Drive
- [ ] Run `syncAppResourcesFromCode` from AQL menu
- [ ] Run `setupMasterSheets` from AQL menu
- [ ] Run `setupOperationSheets` from AQL menu
- [ ] Run `setupAppSheets` from AQL menu to seed AppOptions
- [ ] Deploy new Web App version (API contract changed — new scope, new code format)
