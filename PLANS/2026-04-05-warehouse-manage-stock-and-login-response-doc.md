# PLAN: Warehouse > Manage Stock (type-agnostic) + Login Response Documentation
**Status**: COMPLETED
**Created**: 2026-04-05
**Created By**: Brain Agent (Claude Opus 4.6)
**Executed By**: Build Agent (Claude Sonnet 4.6)

---

## Objective

Deliver two tightly-coupled deliverables in one plan:

1. **Warehouse > Manage Stock** — a new operator-facing page, reachable from a new `Warehouse` sidebar group, that lets authenticated users write `StockMovements` rows for any `ReferenceType` (currently `GRN`, `DirectEntry`, `StockAdjustment`; future types such as `Dispatch` must work with zero code changes). The same single page must serve all types without per-type branching logic. The `WarehouseStorages` summary must update in lockstep as movements are written.
2. **Login Response documentation** — create `Documents/LOGIN_RESPONSE.md` as the canonical spec for everything returned by `handleLogin()`, wire references into `CLAUDE.md`, `AGENTS.md`, and `Documents/README.md`, and add a maintenance-rule clause (mirroring the existing `AQL_MENU_ADMIN_GUIDE.md` rule) requiring the doc to be updated whenever the login payload shape, generators, or frontend storage locations change.

### Why both in one plan
The Manage Stock feature consumes `appOptions.StockMovementReferenceType` from the login response. The user identified, during the same discussion, that there is currently **no documentation** of the login response structure. Bundling ensures the doc is created at the same time the feature starts actively relying on an `appOptions` key, and the maintenance rule is enforced from day one.

---

## Context

### Decisions locked during planning discussion
| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Per-ReferenceType behavior config | **None.** Single universal UI. `StockMovements` sheet columns are the contract. | User explicit. Adding a new type must be a sheet-row edit, not a code change. |
| 2 | Sidebar placement | **Menu group** `Warehouse` via `menu.group` field (no new nesting code) | User explicit. Matches existing MainLayout grouping mechanism (`FRONTENT/src/layouts/MainLayout/MainLayout.vue:183-233`), which groups by `menu.group` and resolves group icon from the first item. |
| 3 | GRN `ReferenceCode` capture | **Free-text field**, single value for the whole batch | User explicit. |
| 4 | Batch write | **Loop single creates** (one `callGasApi('create', …)` per row). No new bulk handler. | User explicit. |
| 5 | URL path | `/operations/manage-stock` (scope=operation) | Avoids touching the router's dynamic-route scope regex (currently `masters\|operations\|accounts`). Menu group label is "Warehouse" — which is what the user sees — independent of URL. |
| 6 | Resource registration | **Functional resource** (`Functional: 'TRUE'`, no sheet data), scope=`operation` | Matches the `BulkUploadMasters` functional-resource pattern at `GAS/syncAppResources.gs:~888`. |
| 7 | Frontend route wiring | **Explicit route** in `routes.js`, mirroring `/masters/bulk-upload` at `FRONTENT/src/router/routes.js:42-46` | The dynamic `/:scope/:resourceSlug` route assumes sheet-backed resources; bulk-upload proves functional pages get explicit routes. |

### Existing infrastructure (already in place — do NOT recreate)
| Piece | Location |
|---|---|
| `StockMovements` sheet (ledger) | Columns documented at `Documents/OPERATION_SHEET_STRUCTURE.md:88-104`. Created by `GAS/setupOperationSheets.gs`. Registered in `GAS/syncAppResources.gs:633-657`. |
| `WarehouseStorages` sheet (live summary) | `Documents/OPERATION_SHEET_STRUCTURE.md:106-118`. Registered at `GAS/syncAppResources.gs:659-688`. |
| `StockMovementReferenceType` AppOption | Seeded in `GAS/Constants.gs:65-67` as `['GRN', 'DirectEntry', 'StockAdjustment']`. Read by `GAS/appOptions.gs:15-37`. Validated on sheet by `GAS/setupOperationSheets.gs`. |
| AppOptions → login payload wiring | `GAS/auth.gs:91-124` (`handleLogin`) calls `getAppOptions()` and bundles into response. |
| Frontend auth store | `FRONTENT/src/stores/auth.js:12-16` persists `appOptions` to `localStorage` and exposes `appOptionsMap` computed. |
| Generic create API | `handleMasterCreateRecord()` at `GAS/masterApi.gs:87-123` — handles both master and operation scopes via `openResourceSheet(resourceName)`. |
| Frontend create wrapper | `createMasterRecord(resourceName, record)` at `FRONTENT/src/services/masterRecords.js:527-533` — already resolves scope via `resolveResourceScope`, usable for operation resources. |
| Menu group rendering | `FRONTENT/src/layouts/MainLayout/MainLayout.vue:183-233` — fully data-driven: reads `menu.group` and group icon from first item's `menu.icon`. No hardcoded group list. |
| Products store (for SKU lookup) | `FRONTENT/src/stores/products.js` — `useProductsStore()`, cache-first IDB+Pinia. |
| Functional resource precedent | `BulkUploadMasters` in `GAS/syncAppResources.gs` (search for `Functional: 'TRUE'`). Route: `/masters/bulk-upload` (explicit in routes.js). |

### Critical gap discovered during planning
`WarehouseStorages` is documented as "automatically managed by stock movements" (`Documents/OPERATION_SHEET_STRUCTURE.md:107`), but **`grep -r "WarehouseStorages" GAS/` finds only setup/role references — there is no code path that updates the summary when a `StockMovements` row is created.** This plan closes that gap with a server-side post-insert hook, which then applies to this feature *and* any future caller (including the existing GRN flow when it eventually wires its completion step).

### Architecture: the "dual-field row" (the core idea)
Every edit row in the grid exposes **two bound input fields** for the same underlying delta:

```
| SKU   | Product   | Current | Change (Δ) | New Qty | Note |
| S-001 | Widget A  |   42    |   [  10 ]  |   52    |      |
| S-003 | Widget C  |  100    |   [ -61 ]  |  [ 39 ] |      |
```

- **Change (Δ)** is a signed number input.
- **New Qty** is an absolute number input.
- They are bi-directionally bound: typing in one updates the other via `New = Current + Δ` ⇔ `Δ = New − Current`.
- The value written to `StockMovements.QtyChange` is **always the signed delta**. `Current` is read from `WarehouseStorages` for the (Warehouse, Storage, SKU) tuple (0 if absent).

**Why this is type-agnostic:**
- **GRN** operator naturally uses the *Change* column (thinks "I received 10").
- **DirectEntry** operator naturally uses the *Change* column (thinks "add 5" / "remove 3").
- **StockAdjustment** operator naturally uses the *New Qty* column (thinks "I counted 39 at this rack" — system computes Δ = 39 − 100 = −61).
- **Future Dispatch** operator types negative numbers in *Change*. Works with zero code changes.
- The UI never branches on `ReferenceType`. The type is just metadata persisted on the row.

Only genuinely different *shapes* (e.g., a future `Transfer` type requiring both source and destination locations) would warrant a separate page. `GRN | DirectEntry | StockAdjustment | Dispatch` all fit "one warehouse + one location + signed delta" and share this single page.

---

## Pre-Conditions

- [ ] `clasp` is configured and working in `GAS/` (`cd GAS && clasp status` returns clean).
- [ ] Dev Quasar server can run from `FRONTENT/` (`npm run dev` or equivalent).
- [ ] Build Agent has read `CLAUDE.md`, `Documents/MULTI_AGENT_PROTOCOL.md`, `Documents/CONTEXT_HANDOFF.md`.
- [ ] Build Agent has read this plan in full before touching any file.
- [ ] APP spreadsheet has a user/role with write permission on `StockMovements` and `WarehouseStorages` (needed for the end-to-end verification step).

---

## Steps

Steps are ordered to let the Build Agent verify **incrementally** — backend first (so the data path exists), then minimal resource registration (so the menu item appears), then the page itself (step by step, from context screen → edit grid → submit loop), then the documentation deliverable.

### Step 1: Backend — create the `applyStockMovementToWarehouseStorages` hook

**Files**: `GAS/stockMovements.gs` (new file)

- [ ] Create a new file `GAS/stockMovements.gs`.
- [ ] Implement a single exported function:
  ```js
  function applyStockMovementToWarehouseStorages(record, auth) {
    // 1. Validate required fields on the record: WarehouseCode, StorageName, SKU, QtyChange
    //    If any is missing or QtyChange is 0 → return { success: true, skipped: true }.
    // 2. Open the WarehouseStorages sheet via openResourceSheet('WarehouseStorages').
    //    (Same helper used by handleMasterCreateRecord — see GAS/masterApi.gs:89.)
    // 3. Read headers + all rows. Build header index map via getHeaderIndexMap(headers).
    // 4. Scan rows to find a row where:
    //      WarehouseCode === record.WarehouseCode &&
    //      StorageName   === record.StorageName   &&
    //      SKU           === record.SKU
    // 5. If found:
    //      - newQty = Number(row[idx.Quantity] || 0) + Number(record.QtyChange)
    //      - Write back via sheet.getRange(matchedRowNumber, idx.Quantity + 1, 1, 1).setValue(newQty)
    //      - Update UpdatedAt / UpdatedBy via applyAuditFields on a copy of the row,
    //        OR write UpdatedAt/UpdatedBy directly with single setValue calls.
    //      - Call updateResourceSyncCursor('WarehouseStorages').
    // 6. If not found:
    //      - Build a fresh row using the same pattern as handleMasterCreateRecord:
    //        generate a new Code with generateNextCode(values, idx, 'LOC', 5),
    //        set WarehouseCode/StorageName/SKU/Quantity fields,
    //        applyAccessRegionOnWrite(rowData, idx, auth),
    //        applyAuditFields(rowData, idx, auth, resource.config, true).
    //      - sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([rowData]).
    //      - updateResourceSyncCursor('WarehouseStorages').
    // 7. Return { success: true }.
    //
    // Error handling: wrap the entire body in try/catch. On error, Logger.log the error
    // with full context (resource, record, message) and return { success: false, error: String(error) }.
    // Do NOT throw — the caller must not roll back the ledger row if the summary update fails.
  }
  ```

- [ ] The function must reuse these existing helpers (do not reimplement):
  - `openResourceSheet` (check `GAS/masterApi.gs` and surrounding files to locate)
  - `getHeaderIndexMap`
  - `generateNextCode`
  - `applyAccessRegionOnWrite`
  - `applyAuditFields`
  - `updateResourceSyncCursor`

**Pattern**: Mirror the write path inside `handleMasterCreateRecord` at `GAS/masterApi.gs:87-123`. The upsert is structurally similar to "create a new row" — the only difference is the lookup-first branch.

**Rule**: The hook must be idempotency-safe against partial failure: if the summary update throws, the ledger row has already been committed by the caller and must not be reverted. The ledger is the source of truth; `WarehouseStorages` is a materialized cache that can be rebuilt from the ledger if it drifts.

---

### Step 2: Backend — wire the hook into `handleMasterCreateRecord`

**Files**: `GAS/masterApi.gs`

- [ ] Locate `handleMasterCreateRecord` at line 87.
- [ ] Immediately **before** the `return { success: true, ... }` at lines 118-122, add:
  ```js
  if (resourceName === 'StockMovements') {
    try {
      applyStockMovementToWarehouseStorages(buildRecordObject(headers, rowData), auth);
    } catch (hookError) {
      Logger.log('applyStockMovementToWarehouseStorages failed: ' + hookError);
      // Do NOT fail the outer create — ledger row is already committed.
    }
  }
  ```
- [ ] If a helper `buildRecordObject(headers, rowData)` does not already exist, add a small private helper at the bottom of `masterApi.gs` that zips the headers array with the rowData array into a plain object `{ [header]: value, ... }`. Check via `grep` for existing similar helpers first (e.g., `rowToObject`, `zipRow`) and reuse if present.

**Pattern**: Same post-commit hook style as `PostAction` handlers on functional resources (grep `syncAppResources.gs` for `PostAction:` usage).

**Rule**: The hook fires only on `resourceName === 'StockMovements'`. Keep the branch tight and string-equal — do not generalize to a hook registry until a second resource needs one.

---

### Step 3: Backend — register the `ManageStock` functional resource

**Files**: `GAS/syncAppResources.gs`

- [ ] Locate the end of the `WarehouseStorages` entry at line 688.
- [ ] Immediately after it (before the next entry), add a new resource object:
  ```js
  {
      Name: 'ManageStock',
      Scope: 'operation',
      IsActive: 'TRUE',
      SheetName: '',
      CodePrefix: '',
      CodeSequenceLength: 0,
      LastDataUpdatedAt: 0,
      Audit: 'FALSE',
      RequiredHeaders: '',
      UniqueHeaders: '',
      UniqueCompositeHeaders: '',
      DefaultValues: '',
      RecordAccessPolicy: 'ALL',
      OwnerUserField: '',
      AdditionalActions: '',
      Menu: JSON.stringify({
          group: 'Warehouse',
          order: 1,
          label: 'Manage Stock',
          icon: 'inventory',
          route: '/operations/manage-stock',
          pageTitle: 'Manage Stock',
          pageDescription: 'Add, adjust, or directly enter stock movements',
          show: true
      }),
      UIFields: JSON.stringify([]),
      IncludeInAuthorizationPayload: 'TRUE',
      Functional: 'TRUE',
      PreAction: '',
      PostAction: '',
      Reports: '',
      CustomUIName: '',
      ListViews: ''
  },
  ```

**Pattern**: Field-for-field mirror of `BulkUploadMasters` functional resource (grep `Functional: 'TRUE'` in this same file for the exact template).

**Rule**: `Functional: 'TRUE'` tells the frontend and backend "this resource has no sheet rows, do not attempt sheet I/O." `Scope: 'operation'` is correct because the page writes operation-scope data even though it has no own sheet.

- [ ] After saving, open the APP Sheet, run `AQL 🚀 > Sync Resources` (or equivalent menu action — see `Documents/AQL_MENU_ADMIN_GUIDE.md`) to push the new row into `APP.Resources`.
- [ ] Verify in the `APP.Resources` sheet that a row exists with `Name=ManageStock`, `Functional=TRUE`, `Menu` JSON populated.

---

### Step 4: Backend — grant menu access to appropriate roles

**Files**: APP Sheet `Roles` tab (manual user action — documented, not code)

- [ ] Determine which roles should see Manage Stock. Default: Admin + Warehouse Operator role (if exists). Ask the user if uncertain.
- [ ] In the APP `Roles` sheet (or via `GAS/setupRoles.gs` seed if appropriate), add `ManageStock` permission entries.
- [ ] Verify after next login that `authStore.resources` contains a `ManageStock` entry.

**Rule**: Functional resources still flow through role-based access. Without the permission grant, the menu item won't appear.

---

### Step 5: Backend — deploy

**Files**: `GAS/` (deployment only)

- [ ] Run `cd GAS && clasp push`.
- [ ] If the response contract changed (it did — the new `ManageStock` resource is new data in the login payload, but the envelope shape itself is unchanged, so a new deployment version is NOT strictly required), confirm with the user whether a new Web App deployment version is needed. Default: no, because the API verbs (`action=create`, etc.) and envelope shape are unchanged.

---

### Step 6: Frontend — add the explicit route

**Files**: `FRONTENT/src/router/routes.js`

- [ ] In the `/dashboard` children array, **immediately after** the `/masters/bulk-upload` entry at line 42-46, add:
  ```js
  {
    path: '/operations/manage-stock',
    component: () => import('pages/Warehouse/ManageStockPage.vue'),
    meta: { scope: 'operation', requiresAuth: true }
  },
  ```

**Pattern**: Copy-paste mirror of the `bulk-upload` functional-page route entry at line 42-46.

**Rule**: This entry must be defined BEFORE the dynamic `/:scope(masters|operations|accounts)/:resourceSlug` matcher so it takes precedence.

---

### Step 7: Frontend — create the page shell

**Files**: `FRONTENT/src/pages/Warehouse/ManageStockPage.vue` (new — create the `Warehouse/` folder under `pages/`)

- [ ] Create the file with this shape:
  ```vue
  <template>
    <q-page class="q-pa-md">
      <ManageStockContextStep
        v-if="step === 1"
        v-model:warehouseCode="ctx.warehouseCode"
        v-model:storageName="ctx.storageName"
        v-model:referenceType="ctx.referenceType"
        v-model:referenceCode="ctx.referenceCode"
        @proceed="step = 2"
      />
      <ManageStockEditGrid
        v-else
        :context="ctx"
        @back="step = 1"
        @submitted="onSubmitted"
      />
    </q-page>
  </template>

  <script setup>
  import { ref, reactive } from 'vue'
  import ManageStockContextStep from 'src/components/Warehouse/ManageStockContextStep.vue'
  import ManageStockEditGrid from 'src/components/Warehouse/ManageStockEditGrid.vue'

  const step = ref(1)
  const ctx = reactive({
    warehouseCode: '',
    storageName: '',
    referenceType: '',
    referenceCode: ''
  })

  function onSubmitted() {
    // Reset grid but keep context so operator can enter another batch at the same location
    // (user convenience — re-picking the same warehouse/type/storage every time would be painful).
  }
  </script>
  ```

**Pattern**: Thin page orchestrator — logic lives in the two child components. This matches AQL's component+composable architecture rule in `CLAUDE.md` ("Keep pages thin; move logic to `src/composables/`, split UI into `src/components/`").

**Rule**: Do not put any sheet I/O logic in this file. Only local state and child-component orchestration.

---

### Step 8: Frontend — create the Context Step component

**Files**: `FRONTENT/src/components/Warehouse/ManageStockContextStep.vue` (new — create the `Warehouse/` folder under `components/`)

- [ ] Implement a card-based selection UI with:
  - **Warehouse cards section**: load warehouses via `fetchMasterRecords('Warehouses', {})` (from `FRONTENT/src/services/masterRecords.js` — grep for it) OR use an existing warehouses store/composable if present (check `FRONTENT/src/stores/` and `FRONTENT/src/composables/` first — reuse over reimplement). Render each active warehouse as a `q-card` with name, code, city. Clicking applies `q-card--highlighted` (or an equivalent custom class) and emits `update:warehouseCode`.
  - **Type cards section**: read `useAuthStore().appOptionsMap['StockMovementReferenceType']` — an array like `['GRN', 'DirectEntry', 'StockAdjustment']`. Render each as a card. Map display labels and icons with a local mapping object (NOT a config sheet — this is purely cosmetic):
    ```js
    const TYPE_DISPLAY = {
      GRN:             { label: 'Goods Receipt',   icon: 'call_received', description: 'Incoming stock from a receipt' },
      DirectEntry:     { label: 'Direct Entry',    icon: 'edit_note',     description: 'Manually add/subtract stock' },
      StockAdjustment: { label: 'Stock Adjustment',icon: 'fact_check',    description: 'Physical count reconciliation' }
    }
    const displayFor = (type) => TYPE_DISPLAY[type] || { label: type, icon: 'inventory_2', description: '' }
    ```
    This is **display-only**. It must gracefully fall back to `{ label: type, icon: 'inventory_2' }` for unknown types so a new `AppOptions` row (e.g., `Dispatch`) appears immediately without code changes.
  - **Storage Location input**: a `q-select` (with `use-input` + `new-value-mode="add-unique"`) bound to `storageName`. Options: distinct `StorageName` values from `WarehouseStorages` filtered by the selected `warehouseCode`. Load via a composable (see Step 10). Allow free typing of a brand-new storage name.
  - **Reference Code input**: plain `q-input` bound to `referenceCode`. Free text. Not required (`GRN` free-text, `DirectEntry` usually empty, `StockAdjustment` often empty).
  - **Proceed button**: `q-btn` disabled unless `warehouseCode && storageName && referenceType`. Emits `proceed`.

- [ ] Define props for v-model compatibility: `warehouseCode`, `storageName`, `referenceType`, `referenceCode` — each with matching `update:*` emits.

**Pattern**: Quasar-first UI per `CLAUDE.md` frontend rules — use `q-card`, `q-select`, `q-input`, `q-btn`.

**Rule**: Type cards MUST be rendered from `appOptionsMap['StockMovementReferenceType']`, not a hardcoded list. This is what makes the feature future-proof per the user's core requirement.

---

### Step 9: Frontend — create the StockMovementRow component (the dual-field row)

**Files**: `FRONTENT/src/components/Warehouse/StockMovementRow.vue` (new)

- [ ] Implement a single editable row component with props:
  - `sku` (string, readonly display)
  - `productName` (string, readonly display)
  - `currentQty` (number, readonly display)
  - `modelValue` (number — the delta; v-model binding)
  - `note` (string, optional, v-model via second binding or props+emit)
- [ ] Local state:
  - `delta` — computed get/set wrapping `modelValue`
  - `newQty` — computed get/set derived from `currentQty + delta` (get) and `emit('update:modelValue', newVal - currentQty)` (set)
- [ ] Template:
  ```vue
  <tr>
    <td>{{ sku }}</td>
    <td>{{ productName }}</td>
    <td class="text-right">{{ currentQty }}</td>
    <td><q-input dense type="number" v-model.number="delta" input-class="text-right" /></td>
    <td><q-input dense type="number" v-model.number="newQty" input-class="text-right" /></td>
    <td><q-input dense v-model="localNote" /></td>
    <td><q-btn flat dense icon="delete" @click="$emit('remove')" /></td>
  </tr>
  ```
- [ ] Zero rounding/formatting in this component — numeric `q-input` with `type="number"` is sufficient. If `currentQty` is 0 for an absent `WarehouseStorages` row, that is correct — typing `New Qty = 10` gives `delta = 10`.

**Pattern**: Small, pure-presentation component. No store access, no API calls. All data flows via props/emits.

**Rule**: The two fields MUST stay consistent at all times — any edit to either updates the other synchronously via the computed setters. Never store `delta` and `newQty` as independent refs; always derive one from the other.

---

### Step 10: Frontend — create the useStockMovements composable

**Files**: `FRONTENT/src/composables/useStockMovements.js` (new)

- [ ] Export a composable with these responsibilities:
  - `async function loadStoragesForWarehouse(warehouseCode)` — calls `fetchOperationRecords('WarehouseStorages', { filter: { WarehouseCode: warehouseCode } })` (or the equivalent for operation-scope records — check `services/` for an existing function; if none exists, call `callGasApi('get', { scope:'operation', resource:'WarehouseStorages' })` and filter client-side). Returns the array of storage rows.
  - `function distinctStorageNames(storageRows)` — returns unique `StorageName` strings sorted.
  - `function getCurrentQty(storageRows, storageName, sku)` — returns `Number(row.Quantity)` for the matching tuple, or `0` if absent.
  - `async function submitBatch({ warehouseCode, storageName, referenceType, referenceCode, rows })` — rows is an array of `{ sku, qtyChange, note }`. For each row where `qtyChange !== 0`, call `createMasterRecord('StockMovements', { WarehouseCode, StorageName, SKU, QtyChange, ReferenceType, ReferenceCode })`. Await sequentially (simpler progress reporting, avoids rate-limit/contention on GAS). Return `{ succeeded: number, failed: Array<{ sku, error }> }`. Show a single summary notify at the end via `$q.notify` — do NOT let `createMasterRecord`'s built-in per-call toast spam the user; pass `{ showLoading: false, successMessage: null }` option if the helper supports override, or wrap with a custom silent caller (see Step 10a).
  - Expose reactive refs `isSubmitting`, `progress` (object with `current` / `total`).
- [ ] Step 10a — suppressing per-row toasts: `createMasterRecord` at `masterRecords.js:527-533` hardcodes `successMessage: 'Record created successfully'` and `showLoading: true`. Looping 30 rows would produce 30 toasts and 30 loading overlays. Mitigation: **do not use `createMasterRecord` directly in the loop**. Instead call `callGasApi('create', { scope:'operation', resource:'StockMovements', record }, { showLoading: false, successMessage: null })` directly. Show one aggregate `$q.notify` at the end.

**Pattern**: Composable encapsulates stateful logic; components stay declarative. Matches the frontend architecture rule in `CLAUDE.md`.

**Rule**: Sequential submit (not `Promise.all`). Partial failures must be surfaced — the summary notify must distinguish "27 of 30 saved, 3 failed" and list the failed SKUs.

---

### Step 11: Frontend — create the Edit Grid component

**Files**: `FRONTENT/src/components/Warehouse/ManageStockEditGrid.vue` (new)

- [ ] Props: `context` (object with `warehouseCode`, `storageName`, `referenceType`, `referenceCode`).
- [ ] Local state:
  - `storageRows` (array) — loaded once on mount via `useStockMovements().loadStoragesForWarehouse(context.warehouseCode)`.
  - `gridRows` (array) — each item `{ id, sku, productName, currentQty, qtyChange, note }`. `id` is a client-only uid.
- [ ] Header section:
  - Chip strip showing `Warehouse: {code}` • `Type: {type}` • `Storage: {storage}` • `Ref: {ref or '-'}`. Each chip has a `close` icon / clickable → `emit('back')`.
- [ ] Toolbar:
  - "Add SKU" — `q-select` with `use-input`, options sourced from products store (`useProductsStore()`), emits to push a new row into `gridRows`. On selection, populate `currentQty` via `useStockMovements().getCurrentQty(storageRows, context.storageName, sku)`.
  - "Load all at this location" — button, populates `gridRows` with every row in `storageRows` where `StorageName === context.storageName`. Each pre-loaded row has `qtyChange = 0` and `currentQty = row.Quantity`.
- [ ] Grid body: `<table class="q-table">` with header row + `<StockMovementRow v-for="row in gridRows" :key="row.id" :sku="row.sku" :product-name="row.productName" :current-qty="row.currentQty" v-model="row.qtyChange" ...  @remove="..." />`.
- [ ] Footer:
  - Total row count, total non-zero rows.
  - **Submit** button — calls `useStockMovements().submitBatch(...)` passing `context` and the non-zero rows. On success, clear `gridRows` (keep context per Step 7's `onSubmitted`) and show aggregate notify.
  - **Cancel** — emits `back`.
- [ ] While `isSubmitting`, show a `q-inner-loading` overlay with `progress.current / progress.total` text.

**Pattern**: Container component that owns local UI state and delegates logic to the composable. Rows are pure children.

**Rule**: Rows with `qtyChange === 0` are excluded from submission. The grid must visually indicate (e.g., muted background) that a 0-delta row won't be saved — operators benefit from seeing "all these are unchanged, those three are the ones I'm about to submit."

---

### Step 12: Frontend — update REGISTRY files

**Files**: `FRONTENT/src/components/REGISTRY.md`, `FRONTENT/src/composables/REGISTRY.md`

- [ ] In `components/REGISTRY.md`, add entries for:
  - `Warehouse/ManageStockContextStep.vue` — "Step 1 card UI for Warehouse + Type + Storage + ReferenceCode selection."
  - `Warehouse/ManageStockEditGrid.vue` — "Step 2 grid for entering stock deltas across multiple SKUs."
  - `Warehouse/StockMovementRow.vue` — "Single editable row with bi-directionally bound Change (Δ) / New Qty fields."
- [ ] In `composables/REGISTRY.md`, add an entry for:
  - `useStockMovements` — "Load WarehouseStorages for a warehouse, resolve current qty per SKU, submit a batch of StockMovement creates sequentially with aggregated notify."

**Rule**: Per `CLAUDE.md` frontend rules, every new reusable component and composable must be registered in its respective `REGISTRY.md`.

---

### Step 13: Documentation — create `LOGIN_RESPONSE.md`

**Files**: `Documents/LOGIN_RESPONSE.md` (new)

- [ ] Create the file with the following sections (exact structure):

  **1. Envelope shape** — a single JSON block showing the exact shape returned by `handleLogin()` at `GAS/auth.gs:91-124`:
  ```json
  {
    "success": true,
    "token": "string (uuid)",
    "user": { /* see §3 */ },
    "resources": [ /* array, see §4 */ ],
    "appConfig": { /* key-value, see §5 */ },
    "appOptions": { /* key-array, see §6 */ }
  }
  ```

  **2. Top-level field reference table** — columns: `Field`, `Source`, `Generator (file:line)`, `Purpose`, `Frontend storage`, `Refresh trigger`. Rows:
  | Field | Source | Generator | Purpose | Frontend storage | Refresh |
  |---|---|---|---|---|---|
  | `token` | uuid | `GAS/auth.gs:111` | Session identifier | `localStorage.token` + Pinia `authStore.token` | Re-login only |
  | `user` | `APP.Users` + `APP.Roles` | `buildAuthUserPayload()` `GAS/auth.gs:205-216` | Authenticated user identity + roles + access region | `localStorage.user` + Pinia `authStore.user` | Re-login only |
  | `resources` | `APP.Resources` + `APP.Roles` | `getLoginAuthorizedResources()` `GAS/auth.gs:196-203` → `safeGetRoleResourceAccess()` `GAS/resourceRegistry.gs:422-480` | Menu items, permissions, UI config per resource the user can access | `localStorage.resources` + Pinia `authStore.resources` | Re-login or admin runs resource sync |
  | `appConfig` | `APP.Config` | `getLoginAppConfig()` `GAS/auth.gs:164-180` | Deployment-scoped settings (sync TTLs, file IDs, branding) | `localStorage.appConfig` + Pinia `authStore.appConfig` | Re-login |
  | `appOptions` | `APP.AppOptions` | `getAppOptions()` `GAS/appOptions.gs:15-37` | Flat map of option-group → array of selectable values | `localStorage.appOptions` + Pinia `authStore.appOptions` (exposed as `appOptionsMap`) | Re-login |

  **3. `user` payload sub-reference** — columns same as §2, listing every field built by `buildAuthUserPayload` at `GAS/auth.gs:205-216`: `id`, `name`, `email`, `avatar`, `accessRegion`, `designation`, `roles`, `role`. For each, specify the source sheet/column and generator helper.

  **4. `resources` payload sub-reference** — document the shape of a single resource entry as built by `GAS/resourceRegistry.gs:482-539`: `name`, `scope`, `parentResource`, `sheetName`, `codePrefix`, `codeSequenceLength`, `functional`, `permissions: {canRead, canWrite, canUpdate, canDelete}`, `headers[]`, `ui: {menu, fields, customUIName, listViews, listViewsMode}`, `additionalActions[]`, `allowedActions[]`, `reports[]`. For each, one-sentence purpose.

  **5. `appConfig` sub-reference** — list each known key currently used from `APP.Config`, its purpose, and its frontend consumer (where in code `authStore.appConfig.X` is read). Note that this list must be kept in sync as new config keys are added.

  **6. `appOptions` sub-reference** — list each known option group from `APP_OPTIONS_SEED` in `GAS/Constants.gs:65-67`, its values, seeding location, and frontend consumers. Current groups:
  - `StockMovementReferenceType` — `['GRN', 'DirectEntry', 'StockAdjustment']` — seeded at `GAS/Constants.gs:66`, validated by `GAS/setupOperationSheets.gs` (ReferenceType column dropdown), consumed by `FRONTENT/src/components/Warehouse/ManageStockContextStep.vue`.

  **7. Maintenance rule** — explicit clause (bolded, top of a section titled "Maintenance Rule"):
  > **Any change to the login response — adding/removing/renaming a top-level field, changing a generator function, changing a source sheet/column, adding or modifying an `APP.Config` key or `AppOptions` group, or changing a frontend storage location — MUST update `Documents/LOGIN_RESPONSE.md` in the same task. This is enforced the same way as the Menu Admin Guide Maintenance Rule in `CLAUDE.md`.**

**Pattern**: Structure and maintenance-rule wording mirror `Documents/AQL_MENU_ADMIN_GUIDE.md`.

**Rule**: Field references must include file:line. If a referenced line number is uncertain during writing, Build Agent must `Read` the file to confirm before writing the number. Stale line refs break future agents' ability to navigate.

---

### Step 14: Documentation — wire `LOGIN_RESPONSE.md` into startup docs

**Files**: `CLAUDE.md`, `AGENTS.md`, `Documents/README.md`

- [ ] In `CLAUDE.md`:
  - Add a new row to the "Key Documents" table: `| Documents/LOGIN_RESPONSE.md | Canonical login response shape, field sources, and frontend storage locations |`.
  - Add a new top-level section **after** the "Menu Admin Guide Maintenance Rule" section:
    ```
    ## Login Response Documentation Maintenance Rule
    - `Documents/LOGIN_RESPONSE.md` is the canonical specification of the login response payload returned by `handleLogin()`.
    - Any change to the login response shape, field generators, source sheets/columns, AppConfig keys, AppOptions groups, or frontend storage locations MUST update `Documents/LOGIN_RESPONSE.md` in the same task.
    - Keep `Documents/README.md` index entry aligned if the file location or name changes.
    ```

- [ ] In `AGENTS.md`: apply the **identical** two edits (table row + maintenance rule section). `AGENTS.md` and `CLAUDE.md` must stay mirrored per the existing project convention.

- [ ] In `Documents/README.md`: add an index entry for `LOGIN_RESPONSE.md` under the appropriate section (grep the file to locate where other architecture docs are indexed).

**Rule**: The `CLAUDE.md` and `AGENTS.md` edits must be character-identical in the new clauses to preserve mirror parity.

---

### Step 15: Documentation — update auxiliary docs

**Files**: `Documents/OPERATION_SHEET_STRUCTURE.md`, `Documents/MODULE_WORKFLOWS.md`, `Documents/AQL_MENU_ADMIN_GUIDE.md`, `Documents/CONTEXT_HANDOFF.md`

- [ ] `Documents/OPERATION_SHEET_STRUCTURE.md`: Update the `WarehouseStorages` section (around line 106-118) to state that rows are now maintained by the `applyStockMovementToWarehouseStorages` hook (`GAS/stockMovements.gs`), called from `handleMasterCreateRecord` whenever a `StockMovements` row is inserted. Replace the current "automatically managed by stock movements" with a more precise explanation of the trigger point.

- [ ] `Documents/MODULE_WORKFLOWS.md`: Add a new section **"Manage Stock"** describing the end-to-end operator workflow: pick context → load/add SKUs → enter deltas (Change or New Qty) → submit → ledger row + summary upsert. Include a note that future types like `Dispatch` require only an `APP.AppOptions` row (plus a role permission grant) — no code change.

- [ ] `Documents/AQL_MENU_ADMIN_GUIDE.md`: Add a new section for the `Warehouse > Manage Stock` menu action (per the existing mandatory rule in `CLAUDE.md`). Document: route, required permission, what it does, who should have access.

- [ ] `Documents/CONTEXT_HANDOFF.md`: Append a dated entry under the current state section summarizing the new feature, the hook gap that was closed, and the new `LOGIN_RESPONSE.md` doc.

**Rule**: Per `CLAUDE.md`, the menu admin guide update is **mandatory** for any menu change. Skipping it violates project policy.

---

### Step 16: Deploy and verify end-to-end

**Files**: N/A (deployment + testing)

- [ ] `cd GAS && clasp push` (deploys backend changes from Steps 1-3).
- [ ] In the APP Sheet, run the resource sync menu action to materialize the `ManageStock` row in `APP.Resources`.
- [ ] Grant role permission (Step 4).
- [ ] Run `npm run dev` (or equivalent) in `FRONTENT/`.
- [ ] Log out and log back in. Verify in browser devtools that the login response contains `ManageStock` in `resources[]` and that `appOptions.StockMovementReferenceType` is present.
- [ ] Confirm sidebar shows a **Warehouse** group with **Manage Stock** under it (icon: `warehouse` or first-item icon).
- [ ] Navigate to Manage Stock → run through the test cases in the Acceptance Criteria section.

---

## Documentation Updates Required

- [ ] Create `Documents/LOGIN_RESPONSE.md` (Step 13).
- [ ] Update `CLAUDE.md` — add Key Documents row + maintenance rule section (Step 14).
- [ ] Update `AGENTS.md` — mirror `CLAUDE.md` edits (Step 14).
- [ ] Update `Documents/README.md` — add index entry (Step 14).
- [ ] Update `Documents/OPERATION_SHEET_STRUCTURE.md` — correct the `WarehouseStorages` "automatically managed" claim (Step 15).
- [ ] Update `Documents/MODULE_WORKFLOWS.md` — add Manage Stock workflow (Step 15).
- [ ] Update `Documents/AQL_MENU_ADMIN_GUIDE.md` — add Warehouse > Manage Stock entry (Step 15).
- [ ] Update `Documents/CONTEXT_HANDOFF.md` — append dated entry (Step 15).
- [ ] Update `FRONTENT/src/components/REGISTRY.md` — 3 new entries (Step 12).
- [ ] Update `FRONTENT/src/composables/REGISTRY.md` — 1 new entry (Step 12).

---

## Acceptance Criteria

### Backend
- [ ] Calling `handleMasterCreateRecord({resource:'StockMovements', scope:'operation', record:{ WarehouseCode:'WH01', StorageName:'RACK-A1', SKU:'S-001', QtyChange: 10, ReferenceType:'GRN', ReferenceCode:'TEST-001' }})` from the Apps Script editor:
  - Adds a new row to `StockMovements` with the supplied values.
  - Adds a new row to `WarehouseStorages` for `(WH01, RACK-A1, S-001)` with `Quantity = 10` (or increments if one already exists).
  - Returns `{ success: true, ... }`.
- [ ] Repeating the call with `QtyChange: -3` increments the existing `WarehouseStorages` row to `Quantity = 7`.
- [ ] Forcing an error inside `applyStockMovementToWarehouseStorages` (temporarily throw) logs the error but `handleMasterCreateRecord` still returns success and the ledger row is committed.
- [ ] `APP.Resources` contains a `ManageStock` row with `Functional=TRUE` and the Menu JSON.

### Frontend
- [ ] After re-login, the sidebar shows a new **Warehouse** group containing **Manage Stock**.
- [ ] Navigating to `/operations/manage-stock` renders `ManageStockPage.vue` (Step 1 UI).
- [ ] Step 1 card UI shows Warehouse cards, Type cards from `appOptionsMap['StockMovementReferenceType']`, Storage dropdown, Reference Code input, and a **Proceed** button disabled until Warehouse + Storage + Type are selected.
- [ ] Adding a hypothetical `'Dispatch'` value to `APP.AppOptions` row for `StockMovementReferenceType` and re-logging in makes a new "Dispatch" card appear **with zero frontend code changes**. It falls back to a generic label/icon.
- [ ] In Step 2, adding an SKU shows its current qty from `WarehouseStorages` (or 0 if absent).
- [ ] Typing a value in the **Change (Δ)** column updates the **New Qty** column in the same row. Typing in **New Qty** updates **Change (Δ)**. The two fields never desync.
- [ ] "Load all at this location" populates the grid with every `WarehouseStorages` row for the selected `(Warehouse, Storage)`.
- [ ] Submitting a batch with 5 rows (one of which has `QtyChange = 0`) writes 4 new `StockMovements` rows, updates `WarehouseStorages` accordingly, and shows a single aggregate notify ("4 movements saved").
- [ ] On partial failure (e.g., permission denied mid-batch), the aggregate notify reports "X of Y saved, Z failed" and lists the failed SKUs.
- [ ] No per-row toast spam during submission.

### Documentation
- [ ] `Documents/LOGIN_RESPONSE.md` exists with all 7 sections per Step 13, all file:line references verified correct by opening each referenced file.
- [ ] `CLAUDE.md` and `AGENTS.md` contain identical Login Response Documentation Maintenance Rule sections.
- [ ] `Documents/README.md` has an index entry for `LOGIN_RESPONSE.md`.
- [ ] `Documents/AQL_MENU_ADMIN_GUIDE.md` has a new Warehouse > Manage Stock entry (required by the existing rule in `CLAUDE.md`).
- [ ] `FRONTENT/src/components/REGISTRY.md` and `FRONTENT/src/composables/REGISTRY.md` contain the four new entries.

### Regression
- [ ] Existing Master pages still work (no breakage from the `handleMasterCreateRecord` hook — the hook only fires on `resourceName === 'StockMovements'`).
- [ ] Existing BulkUploadMasters functional-page flow still works.
- [ ] Other menu groups (Masters, Operations, Accounts) still render with their existing items.

---

## Post-Execution Notes (Build Agent fills this)
*(Status Update Discipline: Ensure you change `Status` to `IN_PROGRESS` or `COMPLETED` and update `Executed By` at the top of the file before finishing.)*
*(Identity Discipline: Always replace `[AgentName]` with the concrete agent/runtime identity used in that session. Build Agent must remove `| pending` when execution completes.)*

### Progress Log
- [x] Step 1 — `applyStockMovementToWarehouseStorages` hook created
- [x] Step 2 — Hook wired into `handleMasterCreateRecord` + `rowArrayToObject` helper added
- [x] Step 3 — `ManageStock` functional resource registered
- [ ] Step 4 — Role permission granted (manual user action)
- [x] Step 5 — Backend deployed via `clasp push --force` (23 files)
- [x] Step 6 — Frontend explicit route added
- [x] Step 7 — `ManageStockPage.vue` created
- [x] Step 8 — `ManageStockContextStep.vue` created
- [x] Step 9 — `StockMovementRow.vue` created
- [x] Step 10 — `useStockMovements.js` composable created
- [x] Step 11 — `ManageStockEditGrid.vue` created
- [x] Step 12 — REGISTRY files updated
- [x] Step 13 — `LOGIN_RESPONSE.md` created
- [x] Step 14 — `CLAUDE.md` / `AGENTS.md` / `README.md` wired
- [x] Step 15 — Auxiliary docs updated
- [ ] Step 16 — End-to-end verification (manual — requires sheet/browser access)

### Deviations / Decisions
- Step 4 is a manual action; Build Agent cannot write to Google Sheets directly.
- Step 16 end-to-end verification requires user to run sheet sync + grant roles + browser test.
- `useStockMovements.submitBatch` calls `callGasApi` directly (not `createMasterRecord`) to suppress per-row toast spam, exactly per plan Step 10a.
- `ManageStockEditGrid` loads SKUs from `fetchMasterRecords('SKUs')` + Products for label (plan said "products store" which was shorthand for SKU+product data).

### Files Actually Changed
- `GAS/stockMovements.gs` — new file
- `GAS/masterApi.gs` — hook + `rowArrayToObject` helper
- `GAS/syncAppResources.gs` — `ManageStock` resource entry
- `FRONTENT/src/router/routes.js` — explicit route
- `FRONTENT/src/pages/Warehouse/ManageStockPage.vue` — new
- `FRONTENT/src/components/Warehouse/ManageStockContextStep.vue` — new
- `FRONTENT/src/components/Warehouse/ManageStockEditGrid.vue` — new
- `FRONTENT/src/components/Warehouse/StockMovementRow.vue` — new
- `FRONTENT/src/composables/useStockMovements.js` — new
- `FRONTENT/src/components/REGISTRY.md` — 3 new entries
- `FRONTENT/src/composables/REGISTRY.md` — 1 new entry
- `Documents/LOGIN_RESPONSE.md` — new
- `CLAUDE.md` — maintenance rule + key docs table row
- `AGENTS.md` — same (mirror)
- `Documents/README.md` — index entry for LOGIN_RESPONSE.md
- `Documents/OPERATION_SHEET_STRUCTURE.md` — WarehouseStorages trigger chain
- `Documents/MODULE_WORKFLOWS.md` — Manage Stock section (section 5)
- `Documents/AQL_MENU_ADMIN_GUIDE.md` — section 9 Warehouse > Manage Stock
- `Documents/CONTEXT_HANDOFF.md` — dated entry
- `PLANS/2026-04-05-warehouse-manage-stock-and-login-response-doc.md` — status COMPLETED

### Validation Performed
- [ ] Backend acceptance criteria verified in Apps Script editor
- [ ] Frontend acceptance criteria verified in dev build
- [ ] Documentation cross-references verified (grep for `LOGIN_RESPONSE.md`)
- [ ] Regression checks passed

### Manual Actions Required
- [ ] Run `AQL 🚀 > Sync Resources` in the APP Sheet after `clasp push` (Step 3 materialization)
- [ ] Grant role permission for `ManageStock` in the APP `Roles` sheet (Step 4)
- [ ] Log out and log back in to pick up the new resource in the login response (Step 16)
- [ ] (If API envelope contract were changed — currently it is NOT) create a new Web App deployment version. Default: **not required** for this plan.
