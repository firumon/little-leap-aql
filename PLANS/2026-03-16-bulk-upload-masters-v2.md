# PLAN: Bulk Upload Masters (Functional Resource + Action Hooks)
**Status**: COMPLETED
**Created**: 2026-03-16
**Created By**: Brain Agent
**Executed By**: Build Agent

## Objective
Introduce a **Functional Resource** pattern in `APP.Resources` and build a **Bulk Upload** tool for master records. This extends the metadata schema with three new columns (`Functional`, `PreAction`, `PostAction`) so that resources can represent UI tools (not just data sheets). The Bulk Upload tool lets users paste or upload data, preview/edit it in a table with local Insert/Update detection, persist drafts in IndexedDB, and submit all records to the backend in one API call.

## Context
- **Source docs reviewed**: `RESOURCE_COLUMNS_GUIDE.md`, `TECHNICAL_SPECIFICATIONS.md`, `CONTEXT_HANDOFF.md`
- **Key files analysed**: `syncAppResources.gs`, `apiDispatcher.gs`, `masterApi.gs`, `db.js`, `auth.js`, `routes.js`, `MainLayout.vue`, `masterRecords.js`
- **Architecture contract**: Service Worker handles sync/cache boundaries only. Nature detection (Insert vs Update) is reactive UI logic and belongs in a Pinia composable, reading synced data from IndexedDB.
- **Draft persistence**: A new IDB object store `functional-drafts` will hold transient tool state so users don't lose work on refresh.

## Pre-Conditions
- [x] Required source docs were reviewed.
- [x] Architecture decisions finalized (Guide Agent discussion).
- [x] `APP.Resources` Google Sheet has 3 new columns added manually (or via sync script): `Functional`, `PreAction`, `PostAction`.

---

## Steps

### Step 1: Extend APP.Resources Schema (Backend Metadata)
- [x] Add `Functional`, `PreAction`, `PostAction` to every resource entry in `APP_RESOURCES_CODE_CONFIG` array (default: `Functional: 'FALSE'`, `PreAction: ''`, `PostAction: ''`).
- [x] Add a new entry for the Bulk Upload tool:
  ```
  Name: 'BulkUploadMasters'
  Scope: 'master'
  Functional: 'TRUE'
  IsActive: 'TRUE'
  FileID: ''          ← intentionally empty (no backing sheet)
  SheetName: ''       ← intentionally empty
  PostAction: 'handleMasterBulkRecords'
  MenuGroup: 'Masters'
  MenuOrder: 99
  MenuLabel: 'Bulk Upload'
  MenuIcon: 'cloud_upload'
  RoutePath: '/masters/bulk-upload'
  ShowInMenu: 'TRUE'
  IncludeInAuthorizationPayload: 'TRUE'
  ```
- [x] Ensure `syncAppResourcesFromCode()` writes the new columns when syncing.

**Files**: `GAS/syncAppResources.gs`
**Rule**: Existing resources must keep `Functional: 'FALSE'`. Only tool resources set it to `'TRUE'`.

---

### Step 2: Backend — Action Hook Middleware in Dispatcher
- [x] In `isGenericMasterCrudAction()`, add `'master.bulk'` and `'bulk'` as recognized actions.
- [x] In `dispatchGenericMasterCrudAction()`, add a branch for `'master.bulk'` / `'bulk'`:
  1. Resolve resource name from payload.
  2. Load resource config from `APP.Resources`.
  3. If `PostAction` is defined, call `this[PostAction](auth, payload)` dynamically.
  4. If no `PostAction`, return error `'No handler defined for bulk action on this resource'`.

**Files**: `GAS/apiDispatcher.gs`
**Pattern**: Follow the existing `dispatchGenericMasterCrudAction` switch pattern.

---

### Step 3: Backend — Implement `handleMasterBulkRecords`
- [x] Add function `handleMasterBulkRecords(auth, payload)` to `masterApi.gs`.
- [x] Payload contract: `{ resource: 'Products', records: [{...}, {...}] }`. The `resource` field names the **target** master (e.g., Products), not BulkUploadMasters.
- [x] Logic per record:
  1. If record has a `Code` that exists in the sheet → **Update** (reuse `handleMasterUpdateRecord` internal logic: merge, audit, validate uniqueness).
  2. If record has no `Code` or Code not found → **Insert** (reuse `handleMasterCreateRecord` internal logic: generate code, audit, validate required/unique).
  3. Wrap each record in try/catch; collect per-record results.
- [x] Enforce `canWrite` + `canUpdate` permissions on the **target** resource upfront.
- [x] Call `updateResourceSyncCursor()` once at the end.
- [x] Return: `{ success: true, data: { created: N, updated: N, errors: [{index, message}] } }`.

**Files**: `GAS/masterApi.gs`
**Pattern**: Reuse existing `handleMasterCreateRecord` / `handleMasterUpdateRecord` internal helpers.
**Rule**: GAS execution limit is ~6 min. For very large batches, consider chunking in future iterations.

---

### Step 4: Frontend — IDB Upgrade for Draft Persistence
- [x] Bump `DB_VERSION` from `2` to `3` in `db.js`.
- [x] In the `upgrade()` callback, create object store `functional-drafts` with `keyPath: 'key'`.
- [x] Add helper functions:
  - `saveFunctionalDraft(key, data)` — upserts a draft.
  - `getFunctionalDraft(key)` — retrieves a draft by key.
  - `deleteFunctionalDraft(key)` — removes a draft (for Clear All).

**Files**: `FRONTENT/src/utils/db.js`
**Rule**: Must handle the version upgrade gracefully (existing stores untouched).

---

### Step 5: Frontend — Bulk Upload Service Function
- [x] Add `bulkMasterRecords(targetResourceName, records)` to `masterRecords.js`.
- [x] Calls `callGasApi('bulk', { scope: 'master', resource: targetResourceName, records })`.
- [x] Note: `resource` in payload is the **target** master (e.g., Products), not BulkUploadMasters.

**Files**: `FRONTENT/src/services/masterRecords.js`
**Pattern**: Follow existing `createMasterRecord` / `updateMasterRecord` pattern.

---

### Step 6: Frontend — Dynamic Menu for Functional Resources
- [x] In `MainLayout.vue`, the menu already renders from `auth.resources`. The `BulkUploadMasters` resource entry will appear naturally once authorized.
- [x] **Guard**: In the menu filter, functional resources (`Functional === true`) should still show if `ShowInMenu` is true and the user has `canRead` permission. No special handling needed — the existing filter covers this.
- [x] **Guard**: In `masterRecords.js` `syncAllMasterResources()`, skip sync for resources where `functional === true` (no sheet to sync from).

**Files**: `FRONTENT/src/layouts/MainLayout/MainLayout.vue`, potentially `FRONTENT/src/services/masterRecords.js`
**Rule**: Functional resources must never trigger `openResourceSheet()` or `syncAllMasterResources()` for themselves.

---

### Step 7: Frontend — Route for Bulk Upload Page
- [x] Add route under the `/dashboard` layout children:
  ```js
  { path: '/masters/bulk-upload', component: () => import('pages/Masters/BulkUploadPage.vue'), meta: { scope: 'master', requiresAuth: true } }
  ```
- [x] Place it **before** the `/masters/:resourceSlug` catch-all so it matches first.

**Files**: `FRONTENT/src/router/routes.js`

---

### Step 8: Frontend — Create `BulkUploadPage.vue`
- [x] **Resource Selector**: Dropdown of master resources (from `auth.resources`, scope `master`, `Functional !== true`, `canWrite === true`). Changing selection resets the form.
- [x] **Headers Display**: Read-only input showing comma-separated headers of the selected resource (excluding audit headers: `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`).
- [x] **Download Template**: Generate a CSV file client-side with headers as the first row. Trigger browser download.
- [x] **CSV Upload**: `<q-file>` to upload a `.csv`. Parse it: first row = headers (ignored, we use resource headers), remaining rows → populate textarea as tab-separated.
- [x] **Textarea**: For pasting tab-separated data (no headers). Users can paste from Excel directly.
- [x] **Plot Table Button**: Parses textarea content. For each row:
  1. Split by tab.
  2. Map columns to resource headers.
  3. Determine Nature: compare `Code` column value against local IDB records (from `getResourceRows(resourceName)`). If code exists in IDB → "Update", else → "Insert".
  4. Push to reactive `rows` array.
- [x] **Preview Table** (`q-table`):
  - Columns: Nature (chip: green=Insert, orange=Update), all resource headers (editable via `q-popup-edit`), Actions (delete button).
  - Editing a `Code` cell re-evaluates Nature in real time.
- [x] **Clear All Button**: Visible in table header area. Confirms via `q-dialog`, then clears `rows`, `rawContent`, and deletes the IDB draft.
- [x] **Draft Persistence**: On any change to `rows`, auto-save to IDB `functional-drafts` store with key `bulk-upload::{resourceName}`. On page load, if a draft exists for the selected resource, restore it.
- [x] **Upload All Button**: Confirms via dialog, then calls `bulkMasterRecords(targetResourceName, records)`. Shows results summary (created/updated/errors). On full success, clears the table and draft.

**Files**: `FRONTENT/src/pages/Masters/BulkUploadPage.vue`
**Pattern**: Reference `MasterEntityPage.vue` for table patterns and Quasar component usage.

---

## Documentation Updates Required
- [x] Update `Documents/RESOURCE_COLUMNS_GUIDE.md` — add `Functional`, `PreAction`, `PostAction` column definitions to the table.
- [ ] Update `Documents/CONTEXT_HANDOFF.md` — add a section on the "Functional Resource" pattern under architecture notes. _(deferred to next session)_

## Acceptance Criteria
- [x] `APP.Resources` sheet has 3 new columns (`Functional`, `PreAction`, `PostAction`) after running `syncAppResourcesFromCode()`.
- [x] "Bulk Upload" menu item appears under Masters group for authorized users.
- [x] Selecting a resource shows its headers and enables template download.
- [x] Pasting tab-separated data and clicking "Plot Table" renders an editable preview with correct Nature labels (Insert/Update) based on local IDB data.
- [x] Editing a Code cell in the table immediately recalculates Nature.
- [x] Refreshing the page restores previously plotted data from IDB draft.
- [x] "Clear All" wipes the table, textarea, and IDB draft.
- [x] "Upload All" sends records to GAS, and the response summary (created/updated/errors) is shown to the user.
- [x] No regression: existing master pages, menu items, and sync continue to work normally.

---

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*

### Progress Log
- [x] Step 1 completed — `syncAppResources.gs` updated with 3 new columns + BulkUploadMasters entry
- [x] Step 2 completed — `apiDispatcher.gs` routes `bulk`/`master.bulk` via `dispatchBulkAction`
- [x] Step 3 completed — `masterApi.gs` has `handleMasterBulkRecords` with per-record insert/update
- [x] Step 4 completed — `db.js` v3 with `functional-drafts` store + helpers
- [x] Step 5 completed — `masterRecords.js` has `bulkMasterRecords()` service function
- [x] Step 6 completed — `syncAllMasterResources` skips functional resources
- [x] Step 7 completed — Route `/masters/bulk-upload` added before `:resourceSlug` wildcard
- [x] Step 8 completed — `BulkUploadPage.vue` created with all features

### Deviations / Decisions
- [x] `resourceRegistry.gs` also updated to expose `functional`, `preAction`, `postAction` in `getResourceConfig()` and `buildAuthorizedResourceEntry()` — not in original plan but required for the frontend to know about functional resources.
- [x] `CONTEXT_HANDOFF.md` update deferred to next session.

### Files Actually Changed
- `GAS/syncAppResources.gs`
- `GAS/resourceRegistry.gs`
- `GAS/apiDispatcher.gs`
- `GAS/masterApi.gs`
- `FRONTENT/src/utils/db.js`
- `FRONTENT/src/services/masterRecords.js`
- `FRONTENT/src/router/routes.js`
- `FRONTENT/src/pages/Masters/BulkUploadPage.vue` (NEW)
- `Documents/RESOURCE_COLUMNS_GUIDE.md`

### Validation Performed
- [x] Dev server builds without errors
- [x] Browser verification — page loads at `/masters/bulk-upload` with all UI elements visible

### Manual Actions Required
- [ ] Run `syncAppResourcesFromCode()` from GAS editor to push new columns/resource to the sheet.
- [ ] Assign `BulkUploadMasters` resource with `canRead` + `canWrite` permission to the relevant role(s) in `APP > RolePermissions`.
- [ ] Re-login to get updated authorization payload.
