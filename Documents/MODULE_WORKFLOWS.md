# AQL — Module Workflows

This document captures the **end-to-end workflow knowledge** for each major feature/module in the AQL system. It documents the complete data flow, responsible files, configuration surfaces, and known behaviors so that any AI agent (Claude, Codex, Gemini, etc.) can work on these features without re-discovering the architecture from scratch.

> **Maintenance Rule:** When a module workflow is added, modified, or a new module is built, update this file before closing the task. This is a living document — keep it accurate.

---

## Table of Contents

1. [Report Generation (PDF)](#1-report-generation-pdf)
2. [Master Pages - 3-Tier Section-Level Component Architecture](#2-master-pages--3-tier-section-level-component-architecture)
3. [Operation Pages — 3-Tier Architecture](#3-operation-pages--3-tier-architecture)
4. [Products Variant Management (Custom Pages)](#4-products-variant-management-custom-pages)
5. [Menu Access Control](#5-menu-access-control)
6. [Direct Stock Entry (Editable Register)](#6-direct-stock-entry-editable-register)
6A. [GRN Stock Entry](#6a-grn-stock-entry)
6B. [Warehouse Stock List](#6b-warehouse-stock-list)
7. [RFQ Supplier Dispatch Flow](#7-rfq-supplier-dispatch-flow)
8. [Supplier Quotation Response Capture](#8-supplier-quotation-response-capture)
9. [Purchase Order Module](#9-purchase-order-module)
10. [PO Receiving And Goods Receipts](#10-po-receiving-and-goods-receipts)
11. [Outlet Deliveries Schedule-Then-Deliver](#11-outlet-deliveries-schedule-then-deliver)

<!-- Future modules -- add sections as they are built:
12. [Data Backup & Restore](#12-data-backup--restore)
13. [Bulk Upload](#13-bulk-upload)
14. [Dashboard Widgets](#14-dashboard-widgets)
-->

---

## 11. Outlet Deliveries Item-Level Delivery

### 11.1 Overview
Outlet Deliveries are multi-outlet delivery headers. Allocated `OutletRestockItems` are selected on the OD add page and their ORI codes are stored as a CSV in `OutletDeliveries.OutletRestockItemCodes`. Warehouse stock is already reserved/deducted at ORSI allocation time through negative `StockMovements` with `ReferenceType = OutletRestock`.

### 11.2 Data Ownership
- `OutletRestockItems` owns allocation state through `WarehouseCode`, `StorageName`, `Quantity`, and `Progress`.
- `OutletDeliveries.Progress` uses `DRAFT`, `IN_TRANSIT`, `COMPLETED`, and `CANCELLED` from `OutletDeliveryProgress`.
- `OutletDeliveries.OutletRestockItemCodes` holds a CSV of ORI codes for the delivery.
- `StockMovements.ReferenceType = OutletRestock` reserves warehouse stock at ORSI allocation time.
- `OutletMovements.ReferenceType = RestockDelivery` posts delivered ORSI stock into outlets using `ReferenceCode = OutletDeliveries.Code`.
- `OutletStorages` is a derived SKU-only balance keyed by `OutletCode + SKU` with columns `Code`, `OutletCode`, `SKU`, and `Quantity` only.

### 11.3 Workflow
1. Add page loads allocated ORSI rows, existing deliveries, restocks, outlets, SKUs, products, and warehouses through the resource IO store.
2. User selects one or more eligible ALLOCATED ORSI rows that are not already linked to active deliveries.
3. Creation writes one OD `DRAFT` record with `OutletRestockItemCodes` set to the CSV of selected ORI codes.
4. Item delivery runs one batch: update ORSI to `DELIVERED`, create positive `OutletMovements`, derive OD progress from CSV-matched ORSI rows, and derive restock progress.
5. First delivered item moves OD to `IN_TRANSIT`; all delivered items move OD to `COMPLETED`.
6. DRAFT cancellation returns linked ORSIs to `ALLOCATED`; no stock movement is created.

### 11.4 Batch And Sync Rules
- Delivery creation, item delivery, and cancellation use `useResourceIoStore.runBatchRequests`.
- Batch helpers attach `lastUpdatedAtByResource` cursors from IDB metadata before write actions, preserving delta-on-write behavior.
- Write responses are consumed directly; no redundant `get` is issued after `create`, `update`, or `executeAction`.
- General frontend reloads continue to use the cache/last-sync throttle logic in `ResourceIoService`.

---

## 10. PO Receiving And Goods Receipts

### 10.1 Overview
PO Receiving is the editable inspection layer between Purchase Orders and finalized Goods Receipt Notes. Users select a Purchase Order, save or resume a receiving draft, enter received/damaged/rejected quantities, confirm the receiving, then generate a GRN. Goods Receipts are read-only finalized GRNs except for invalidation.

### 10.2 Data Ownership
- `POReceivings` stores direct `ProcurementCode`, purchase order link, receiving header, and progress (`DRAFT`, `CONFIRMED`, `GRN_GENERATED`, `CANCELLED`).
- `POReceivingItems` stores source PO item links and entered inspection quantities only.
- Accepted, short, and excess quantities are derived in frontend composables and are not persisted in receiving sheets.
- `GoodsReceipts` stores finalized GRN headers and uses `Status = Inactive` for invalidation.
- `GoodsReceiptItems.Qty` stores accepted quantity only.

### 10.3 Workflow
1. Select a Purchase Order from `/operations/po-receivings/_add`.
2. If an active draft exists for the PO, the page resumes it instead of creating a duplicate.
3. Save draft writes `POReceivings` plus `POReceivingItems` through `compositeSave`; the GAS hook can move procurement from `PO_ISSUED` to `GOODS_RECEIVING`.
4. Confirm runs the `Confirm` AdditionalAction and sets receiving progress to `CONFIRMED`.
5. Generate GRN runs the `GenerateGRN` AdditionalAction; the GAS hook creates one active `GoodsReceipts` row and accepted-only `GoodsReceiptItems` rows, then updates procurement to `GRN_GENERATED`.
6. Invalidate on Goods Receipts sets `Status = Inactive`; the GAS hook inactivates linked GRN items, rolls receiving back to `CONFIRMED`, and returns procurement to `GOODS_RECEIVING` unless completed.
7. Cancelling a receiving with an active GRN invalidates the GRN first. Completed procurement blocks frontend cancellation.

### 10.4 Routing And UI
- PO Receiving custom pages live under `FRONTENT/src/pages/Operations/PoReceivings/` because the resolver maps `po-receivings` to `PoReceivings`.
- Goods Receipts custom pages live under `FRONTENT/src/pages/Operations/GoodsReceipts/`.
- No Goods Receipts add/edit page is implemented.
- Report links for damage/reject/short/excess lists are disabled placeholders; no report template generation is implemented.

### 10.5 Warehouse Stock Posting
Finalized active GRNs are posted to warehouse stock from `/operations/stock-movements/grn-entry`. A GRN is eligible when no `StockMovements` ledger row exists with `ReferenceType = GRN` and `ReferenceCode = GoodsReceipts.Code`. Posting creates positive `StockMovements.QtyChange` rows and relies on the existing StockMovements post-write hook to update `WarehouseStorages`.

### 10.6 Out Of Scope
Stock reversal and report-template generation are intentionally not implemented in this phase.

## 1. Report Generation (PDF)
 
> [!NOTE]
> All details regarding Report Generation, Sheets templates, metadata settings, frontend components/composables, and backend code have been consolidated into the dedicated guide: **[REPORTS_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/REPORTS_SYSTEM.md)**.
> Please refer to that document for report architecture, configurations, and implementation rules.

---

## 2. Page & Component Resolution Architecture (12-Tier Section Resolution)

### 2.1 Overview

All master, operation, and accounts pages (List/Index, View, Add, Edit, Action, and custom pages) use a **dynamic resolver architecture**. Instead of static imports, the system uses a centralized routing interceptor and section loader.

- **Page-Level Resolution**: Managed by [PageResolver.vue](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/pages/PageResolver.vue) and [usePageResolver.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/usePageResolver.js) (6-tier lookup sequence for standard actions, 2-tier for custom pages).
- **Section-Level Resolution**: Managed by [useSectionResolver.js](file:///f:/LITTLE%20LEAP/AQL/FRONTENT/src/composables/resources/useSectionResolver.js), which dynamically resolves individual layout sections (like `Header`, `Toolbar`, `Records`, `Details`) using a **12-tier lookup priority checklist**.
- **Bare Section Keys**: Resolvers use simple bare keys (like `Header` instead of `ListHeader`, or `Record` instead of `ListRecordsRecord`) to localize namespaces and reduce template complexity.
- **Action Suffix Checks**: Action pages or outcome sections search for `{actionKey}{Section}.vue` first before falling back to `{Section}.vue` at each tier checked.

### 2.2 Resolution Flow

```
Route: /:scope(masters|operations)/:resourceSlug/(_add|:pageSlug|:code/(_view|_edit|_action/:action|:pageSlug))
         │
         ▼
PageResolver.vue  ← Centralized Page resolution (usePageResolver.js)
  Checks standard action priority list:
  1. Tenant-custom, Entity-specific:  pages/_custom/{ui}/{Scope}/{Entity}/{Action}Page.vue
  2. Tenant-custom, Scope-common:     pages/_custom/{ui}/{Scope}/{Action}Page.vue
  3. Tenant-custom, Tenant-global:    pages/_custom/{ui}/{Action}Page.vue
  4. Entity-custom:                   pages/{Scope}/{Entity}/{Action}Page.vue
  5. Scope-common fallback:           pages/_common/{Scope}/{Action}Page.vue
  6. Global-common fallback:          pages/_common/{Action}Page.vue
         │
         ▼
_common/{Action}Page.vue  ← Thin page orchestrator
  Uses: useSectionResolver({ resourceSlug, customUIName, scope })
         │
         ▼
Resolves sections dynamically via 12-tier lookup priority (uses global `registry` map):
  - Tiers 1-6:   components/_custom/{ui}/{Scope}/{Entity}/{Page}/{Section}.vue (and scope/global variations)
  - Tiers 7-8:   components/{Scope}/{Entity}/{Page}/{Section}.vue (and page-generic)
  - Tiers 9-10:  components/_common/{Scope}/{Page}/{Section}.vue (and scope-generic)
  - Tiers 11-12: components/_common/{Page}/{Section}.vue (and global fallback)
```

### 2.3 Page-Level Discovery Candidates
Custom pages (`action: 'resource-page'` or `'record-page'`) resolve through tenant-custom and entity-specific paths only, based on the `:pageSlug` URL parameter.
- `resource-page`: `pages/_custom/{ui}/{Scope}/{Entity}/{CustomPageName}Page.vue` → `pages/{Scope}/{Entity}/{CustomPageName}Page.vue`
- `record-page`: `pages/_custom/{ui}/{Scope}/{Entity}/Record{CustomPageName}Page.vue` → `pages/{Scope}/{Entity}/Record{CustomPageName}Page.vue`

If no page is found, it renders a developer fallback page: `pages/_common/Page.vue`.

### 2.4 Action Pages & Their Bare Section Keys

#### Index/List Page (`_common/IndexPage.vue`)
- `Header`: Dynamic list header (`components/_common/Header/Header.vue` fallback).
- `Toolbar`: Dynamic search/views toolbar (`components/_common/Index/Toolbar.vue` fallback).
- `ViewSwitcher`: Dynamic list view tabs (`components/_common/Toolbar/ViewSwitcher.vue` fallback).
- `Records`: Card-list records container (`components/_common/Content/Records.vue` fallback).
- `AqlContentWrapper`: Handles loading/empty state wrapper (`components/shared/AqlContentWrapper.vue`).

#### View Page (`_common/{Scope}/ViewPage.vue`)
- `Header`: Dynamic view header (`components/_common/View/Header.vue` fallback).
- `ActionBar`: Dynamic action triggers (`components/_common/Masters/View/ActionBar.vue` fallback).
- `Details`: Record details values grid (`components/_common/Masters/View/Details.vue` fallback).
- `Audit`: Creation/modification metadata (`components/_common/View/Audit.vue` fallback - Masters only).
- `Parent`: Displays parent record card (`components/_common/View/Parent.vue` fallback - Operations only).
- `Children`: Dynamic child resources loops (`components/_common/Masters/View/Children.vue` fallback).
- `Loading`: Page-level loading spinner (`components/_common/View/Loading.vue` fallback).
- `Empty`: Record not found card (`components/_common/View/Empty.vue` fallback).

#### Add / Edit Pages (`_common/AddPage.vue` & `_common/EditPage.vue`)
- `Header`: Header title (`components/_common/Add/Header.vue` or `components/_common/Edit/Header.vue` fallback).
- `Form`: Composite data fields (`components/_common/Masters/Add/Form.vue` or `components/_common/Masters/Edit/Form.vue` fallback).
- `Children`: Nested child rows (`components/_common/Masters/Add/Children.vue` or `components/_common/Masters/Edit/Children.vue` fallback).
- `Actions`: Cancel and Submit buttons (`components/_common/Add/Actions.vue` or `components/_common/Edit/Actions.vue` fallback).

#### Action Page (`_common/ActionPage.vue`)
- `Header`: Dynamic action header (`components/_common/Action/Header.vue` fallback).
- `Form`: Outcome selector and input fields (`components/_common/Masters/Action/Form.vue` fallback).
- `Actions`: Cancel and Submit outcomes (`components/_common/Action/Actions.vue` fallback).

### 2.5 Architecture Contract Link
- All frontend implementation under this module must follow `Documents/ARCHITECTURE RULES.md`.
- Core defaults are mandatory: `useDataStore`, `useResourceIoStore`, `useResourceStatusStore`, `useResourceNav`, `useSectionResolver`, `usePageResolver`.
- API transport must use canonical request/response envelopes.
- Components returned by resolvers must be wrapped in Vue's `markRaw` to avoid reactivity performance warnings.

---

## 3. Operation Pages Resolution

### 3.1 Overview

Operations pages use the identical centralized page resolver (`PageResolver.vue` / `usePageResolver.js`) and section resolver (`useSectionResolver.js`) as Masters, but with a different default section set — particularly for the `ViewPage`. 

Operations data generally flows top-down (e.g. Purchase Requisitions → Purchase Orders → Goods Receipts) and tracks complex lifecycles via `additionalActions`. Operations views exclude the generic `ViewAudit` section and substitute a `ViewParent` section.

### 3.2 Key Differences vs Masters

- **Section Resolver Scope**: `useSectionResolver` takes `scope: 'operations'`, which sets `{ScopeFolder}` to `Operations` in candidates paths checking.
- **ViewPage Orchestrator**: The default operations `ViewPage.vue` orchestrator includes `Parent` section and excludes `Audit` section.
- **ViewDetails Filtering**: The default `OperationViewDetails` dynamically filters out both audit columns (`CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`) and any action stamp columns dynamically generated from the resource's `additionalActions` configuration (e.g. `ApprovedBy`, `ApprovedAt`).
- **ViewParent Handling**: `OperationViewParent` automatically fetches the parent record (based on the `{ParentName}Code` header resolution logic). 
  - If the parent record has a `Name` field, it displays as a minimal inline link: `Name (Code)`.
  - If the parent record has no `Name` field, it displays a full embedded data card excluding audit/action fields.

### 3.3 Files Involved

| File | Role |
|---|---|
| `FRONTENT/src/pages/PageResolver.vue` | Centralized page resolver page component |
| `FRONTENT/src/composables/resources/usePageResolver.js` | 6-tier page resolver logic |
| `FRONTENT/src/composables/resources/useSectionResolver.js` | 12-tier section resolver logic |
| `FRONTENT/src/pages/_common/IndexPage.vue` | Centralized List page orchestrator |
| `FRONTENT/src/pages/_common/AddPage.vue` | Centralized Add page orchestrator |
| `FRONTENT/src/pages/_common/EditPage.vue` | Centralized Edit page orchestrator |
| `FRONTENT/src/pages/_common/ActionPage.vue` | Centralized Action page orchestrator |
| `FRONTENT/src/pages/_common/Operations/ViewPage.vue` | View orchestrator for Operations (custom section set) |
| `FRONTENT/src/components/_common/` | Consolidated global-common page section components |
| `FRONTENT/src/components/_common/Operations/` | Consolidated operations-common page section components |
| `FRONTENT/src/composables/resources/useResourceNav.js` | Composable for route navigation logic across scopes. |

### 3.4 Architecture Contract Link
- Operations frontend flows must comply with `Documents/ARCHITECTURE RULES.md` and the same core defaults listed in section 2.5.
- Route transitions must continue to go through `useResourceNav`; section/action customization must continue through resolver composables.

---

## 4. Products Variant Management (Custom Pages)

### 4.1 Overview

Products now use entity-custom pages under `FRONTENT/src/pages/Masters/Products/` for variant-aware UX across index, view, add, and edit actions.

- Parent resource: `Products`
- Child resource: `SKUs` (joined by `SKUs.ProductCode = Products.Code`)
- Variant schema source: `Products.VariantTypes` (CSV)
- Variant mapping: CSV position maps to `SKUs.Variant1` to `SKUs.Variant5`

### 4.2 Files Involved

| File | Role |
|---|---|
| `FRONTENT/src/composables/useProductVariants.js` | Shared helper for parsing `VariantTypes`, building dynamic columns, SKU variant validation, and duplicate variant-set detection |
| `FRONTENT/src/pages/Masters/Products/IndexPage.vue` | Custom list page with combined search (product fields + SKU variant values) and SKU counts |
| `FRONTENT/src/pages/Masters/Products/ViewPage.vue` | Custom detail page with dynamic SKU table columns labeled from `VariantTypes` |
| `FRONTENT/src/pages/Masters/Products/AddPage.vue` | Composite create page for Product + SKU rows with dynamic variant inputs |
| `FRONTENT/src/pages/Masters/Products/EditPage.vue` | Composite edit page with variant type impact handling and SKU row lifecycle controls |

### 4.3 Runtime Flow

1. Route resolver picks `Products/IndexPage.vue`, `ViewPage.vue`, `AddPage.vue`, `EditPage.vue` via entity-custom page tier.
2. Pages load Products with `useResourceData(resourceName)`.
3. SKU data is loaded through `fetchMasterRecords('SKUs')` and filtered by `ProductCode`.
4. `useProductVariants` converts `VariantTypes` CSV into dynamic variant columns.
5. Add/Edit pages manage Product + SKUs through `useCompositeForm(config)` and save atomically using `compositeSave`.

### 4.4 Validation and Behavior Rules

1. Variant dimension count is capped at 5.
2. Variant labels are user-defined and displayed as dynamic column headers.
3. SKU rows must fill all active variant columns before save.
4. Duplicate active SKU variant-value sets are blocked before save.
5. SKU delete in Edit follows existing composite pattern (`_action = deactivate`, `Status = Inactive`), not hard delete.
6. Edit page variant removal prompts for confirmation and remaps SKU variant columns in-memory before save.

---

## 5. Menu Access Control

> **Full documentation of the frontend menu system**: See [AQL_FRONTEND_MENU_SYSTEM.md](file:///f:/LITTLE%20LEAP/AQL/Documents/AQL_FRONTEND_MENU_SYSTEM.md) — covers JSON schema, data flow, permission gating algorithms, tree building, route guard, and admin operations.

### 5.1 Overview

Menu Access Control enables fine-grained permission-based visibility of resources in the sidebar and route protection using a flexible `menuAccess` rule inside the `Menu` JSON column of `APP.Resources`. Rules support single-resource permission checks and cross-resource AND/OR logic.

### 5.2 Architecture

**Backend (GAS):**
- `GAS/syncAppResources.gs` — Defines `menuAccess` inside each entry of the `Menu` JSON array for every resource, so multiple sidebar menu rows can share one resource entry.
- `GAS/resourceRegistry.gs` — Parses the `Menu` array, normalizes each entry, and exposes it in the auth payload as `entry.ui.menus` so the frontend can evaluate visibility per menu item.

**Frontend:**
- `FRONTENT/src/composables/useMenuAccess.js` — Reusable composable that accepts `resource` plus an optional `menuItem` (the matched entry from `ui.menus`) to evaluate permission rules, defaulting to checking if the user has any permission on the resource when no rule exists.
- `FRONTENT/src/layouts/MainLayout/MainLayout.vue` — Iterates over every `menu` entry in `resource.ui.menus`, calling `evaluateMenuAccess(resource, menu)` and rendering one sidebar row per visible entry.
- `FRONTENT/src/router/index.js` — Matches `to.path` against all `ui.menus` entries and passes the matched entry to `evaluateMenuAccessInline()` before allowing navigation.

### 5.3 `menuAccess` Rule Formats

All rules evaluate against the current logged-in user's permissions (from auth store). If `menuAccess` is absent, the fallback is checking if the user has any active action permission on the resource itself.

**Format 1: No rule (absent)**
```json
// No menuAccess field → fallback to checking for any active action permission
```

**Format 2: Single permission on own resource**
```json
"menuAccess": { "require": "canWrite" }
"menuAccess": { "require": ["canWrite", "canDelete"] }  // AND logic
```

**Format 3: All rules must pass (AND)**
```json
"menuAccess": {
  "all": [
    { "resource": "Products", "require": "canWrite" },
    { "resource": "SKUs", "require": "canRead" }
  ]
}
```
If any rule fails, access is denied.

**Format 4: Any rule must pass (OR)**
```json
"menuAccess": {
  "any": [
    { "resource": "Products", "require": "canWrite" },
    { "resource": "Variants", "require": "canWrite" }
  ]
}
```
If at least one rule passes, access is granted.

### 5.4 Evaluation Flow

1. **Backend Setup:**
   - Admin updates `menuAccess` on each entry inside the `Menu` JSON array in `APP.Resources` (either by hand in the sheet or by syncing `syncAppResources.gs` defaults).
   - GAS delivers the parsed entries as `ui.menus` in the auth payload so that each sidebar route can be guarded independently.

2. **Frontend Sidebar Filtering (MainLayout.vue):**
   - `visibleResourceMenuGroups` iterates every `resource.ui.menus` entry.
   - For each entry, it calls `evaluateMenuAccess(resource, menu)` and only renders the menu row if access is granted.
   - This produces one sidebar row per visible menu entry even when multiple entries share the same resource.

3. **Frontend Route Guard (router/index.js):**
   - `beforeEach` locates the resource entry whose `ui.menus` contains `to.path`.
   - It passes that matched menu entry into `evaluateMenuAccessInline(targetEntry, allResources, to.path)` before allowing navigation.
   - A failed evaluation redirects back to `/dashboard`; when allowed, navigation proceeds.

### 5.5 Permission Keys

Valid permission keys depend on role configuration. Common keys:
- `canRead`, `canWrite`, `canUpdate`, `canDelete` (CRUD standard)
- `canApprove`, `canReject`, `canCancel` (custom actions)
- Any key matching the pattern `can<ActionName>`

### 5.6 Configuration & Testing

**To add `menuAccess` to a resource:**

1. In `GAS/syncAppResources.gs`, find the resource's config object and update its `Menu` JSON:
   ```js
   Menu: JSON.stringify({
     group: ['Masters', 'Product'],
     order: 1,
     label: 'Products',
     icon: 'inventory_2',
     route: '/masters/products',
     pageTitle: 'Products',
     pageDescription: '...',
     show: true,
     menuAccess: { require: 'canWrite' }
   })
   ```

2. Run `clasp push --force` to deploy GAS changes.

3. In the APP sheet, run **AQL 🚀 > Resources > Sync APP.Resources from Code** to pull code changes into the sheet.

4. Run **AQL 🚀 > Resources > Clear Resource Config Cache** to purge server-side cache.

5. Create a **new Web App deployment** in Apps Script IDE (Deploy > New deployment) to serve the updated auth payload to the frontend.

6. Clear browser cache and login as a test user:
   - User WITH the required permission → resource visible in sidebar, route accessible.
   - User WITHOUT the required permission → resource hidden from sidebar, route redirects to dashboard.

### 5.7 Error Handling & Defaults

- If `menuAccess` is malformed (invalid JSON, missing fields), safe defaults apply.
- Missing `resource` in a rule defaults to the current resource name.
- Unknown permission keys return `false` (denied).
- If auth store is unavailable or `resources` list is empty, all visibility checks return `false`.

### 5.8 Implementation Details

- Evaluation is **fully frontend-side** — no extra GAS calls needed.
- Composable `useMenuAccess()` is lightweight; each check is O(n) where n = number of rules (typically 1–5).
- Router guard uses inline `evaluateMenuAccessInline()` (not composable) because Vue composables require `setup()` context, unavailable in the router.
- Both evaluators use identical logic to ensure consistency.

## 6. Direct Stock Entry (Editable Register)

### 6.1 Overview

The Direct Stock Entry page (`/operations/stock-movements/direct-entry`) provides a fast, mobile-first editable register for adding or adjusting stock quantities. It operates strictly as a `DirectEntry` movement type, writing to the `StockMovements` ledger which in turn auto-updates the `WarehouseStorages` summary via a backend hook.

### 6.2 Architecture Diagram

```
FRONTEND (Quasar)
  ManageStockPage.vue  ← Thin orchestrator, 2-step flow
    Step 1: Warehouse Selection (tappable cards)
    Step 2: StockEntryGrid.vue
      - Loads ALL existing WarehouseStorages for the selected warehouse
      - Loads all active SKUs with Product names
      - Displays rows for existing stock (read-only SKU/Storage, editable Qty)
      - Always shows one empty "add new" row at the bottom with auto-append
      - Highlights unsaved changes (dirty rows)
      - Sends ONLY deltas (QtyChange = NewQty - OriginalQty) on Save
      - Save calls useStockMovements().submitBatch()
      - After save: rebuilds grid from IDB (cache-first) — submitBatch
        has already upserted WarehouseStorages into IDB using locally
        resolved headers (no response-header dependency)

BACKEND (Google Apps Script)
  apiDispatcher.gs → action=create, scope=operation, resource=StockMovements
  resourceApi.gs → handleResourceCreateRecord()
    → writes ledger row to StockMovements sheet
    → dispatchAfterCreateHook() calls handleStockMovementsBulkSave_afterCreate()
    → applyStockMovementToWarehouseStorages() upserts WarehouseStorages
```

### 6.3 Files Involved

| File | Role |
|---|---|
| `FRONTENT/src/pages/Warehouse/ManageStockPage.vue` | Thin page orchestrator — two-step wizard state |
| `FRONTENT/src/components/Warehouse/StockEntryGrid.vue` | Core grid UI — editable rows, new rows, delta tracking, save logic |
| `FRONTENT/src/composables/useStockMovements.js` | Loads warehouses, SKUs, and storages. Submits batches via API. |
| `FRONTENT/src/router/routes.js` | Explicit route `/operations/stock-movements/direct-entry` |
| `GAS/stockMovements.gs` | Hook logic to sync `WarehouseStorages` based on `StockMovements` |
| `GAS/resourceApi.gs` | Executes `dispatchAfterCreateHook()` during save |

### 6.4 Key Behaviors
1. **Delta Calculation**: The UI tracks `originalQty` and `currentQty`. On save, it only submits rows where `currentQty !== originalQty`. The submitted value is the difference (`QtyChange = currentQty - originalQty`).
2. **Remove Icon**: Clicking the trash icon on an existing row sets its quantity to 0 and visually strikes it out. This generates a negative delta equal to the original quantity. This action is reversible until saved.
3. **Auto-Append New Rows**: Filling out the single empty row at the bottom automatically spawns a new empty row beneath it, allowing rapid entry of new stock.
4. **Reference Type**: Hardcoded to `DirectEntry`. This bypasses the need for the user to select a movement type, optimizing for speed.
5. **Mobile First**: Row layout uses compact flex grids rather than native HTML tables to prevent horizontal scrolling on mobile devices.
6. **Post-Save Cache Refresh (2026-04-11)**: `submitBatch()` pairs the `create StockMovements` request with a `get WarehouseStorages` request in a single batch. On success, it upserts the returned rows into IndexedDB using headers resolved locally (IDB meta → auth store → `getAuthorizedResources` fallback). The `WarehouseStorages` sync cursor (`lastSyncAt`) is advanced **only** when the IDB upsert actually writes rows — if local headers cannot be resolved, the cursor is left untouched so the next normal sync path can recover. After a successful save, `StockEntryGrid.vue` rebuilds from the (now-fresh) cache via `fetchData(false)` — no extra network round-trip.
7. **Draft Storage Dropdown (2026-04-11)**: The storage-location dropdown for new rows is a reactive union of fetched `WarehouseStorages` names plus any non-empty `StorageName` values currently typed in `newRows`. Typing a new location in row 1 immediately makes it selectable in row 2, before save. `q-select`'s `new-value-mode="add-unique"` still commits typed values to the row's model as before.

## 6A. GRN Stock Entry

### 6A.1 Overview
The GRN Stock Entry page (`/operations/stock-movements/grn-entry`) posts accepted finalized GRN quantities into warehouse stock. It reuses `useStockMovements().submitBatch()` and the existing `StockMovements` backend hook, so `WarehouseStorages` remains derived from ledger rows.

### 6A.2 Flow
1. Select a warehouse.
2. Select an eligible active GRN for a purchase order whose `ShipToWarehouseCode` matches the warehouse.
3. Allocate each `GoodsReceiptItems.Qty` across one or more storage rows.
4. Submit creates one positive `StockMovements` row per allocation with `ReferenceType = GRN`, `ReferenceCode = GoodsReceipts.Code`, selected `WarehouseCode`, allocation `StorageName`, `SKU`, and `QtyChange`.
5. Blank/default storage displays as `Default` in the UI and submits as `_default`.
6. After a successful save, the page redirects to `/masters/warehouses/{WarehouseCode}/stock`.

### 6A.3 Eligibility And Validation
- A GRN is hidden after any `StockMovements` row exists with `ReferenceType = GRN` and matching `ReferenceCode`.
- Each GRN item must be fully allocated before submit; reducing one allocation row immediately creates or updates a remainder row, while increasing one row reduces following rows without negative quantities.
- Current stock is read from `WarehouseStorages` for the selected warehouse, storage, and SKU.

## 6B. Warehouse Stock List

### 6B.1 Overview
Warehouse stock lookup is available from `Warehouse > Stock List`, from a Warehouse record's `View Stock` navigate action, and from GRN Stock Entry after posting. All entry points resolve to the same record-page stock view.

### 6B.2 Routes
- Resource page: `/masters/warehouses/stock-list` lists active warehouses as selection cards.
- Record page: `/masters/warehouses/{WarehouseCode}/stock` shows current `WarehouseStorages` rows for the warehouse, enriched with SKU and Product labels.

### 6B.3 Ownership
- `GAS/syncAppResources.gs` configures the `Warehouses` menu row and `ViewStock` navigate AdditionalAction.
- `FRONTENT/src/composables/masters/warehouses/useWarehouseStockList.js` owns loading, filtering, summary calculation, and navigation.
- `FRONTENT/src/components/Masters/Warehouses/WarehouseStockRows.vue` is UI-only and renders the stock rows.

## 7. RFQ Supplier Dispatch Flow

### 7.1 Overview
The RFQ supplier dispatch flow governs how suppliers are attached to a newly drafted RFQ, and how they are eventually marked as "sent". It operates through two distinct custom actions accessible from the RFQ record view.

### 7.2 Core Transitions
1. **Assign Supplier**: Allows the user to select one or more `Suppliers` master records and attach them to the RFQ. This creates new rows in the `RFQSuppliers` operation sheet with `Progress = ASSIGNED`. Once assigned, the parent RFQ becomes strictly read-only and its own `Progress` advances to `SENT` (meaning sent-to-dispatch-queue).
2. **Mark As Sent**: The RFQ view now routes sent records to a dispatch overview that shows the RFQ primary details, assigned suppliers, and available suppliers. Available suppliers can be selected and saved from this overview, creating additional `RFQSuppliers` rows with `Progress = ASSIGNED` without changing the already-sent parent RFQ progress. Clicking an assigned supplier opens a supplier-dispatch page where the user can pick one assigned supplier, preview RFQ / WhatsApp / email text variants, and mark that supplier as dispatched. This advances that `RFQSuppliers` row to `SENT` and stamps the `SentDate` field with today. When all active attached suppliers are moved past `ASSIGNED`, the parent `Procurements` record formally advances to `RFQ_SENT_TO_SUPPLIERS`.

### 7.3 Architecture Details
- **Composables**: The shared `useRFQSupplierFlow` composable manages data fetching (RFQ header, PR metadata, Suppliers, RFQSuppliers) and orchestrates the batch assignment / dispatch updates through `workflowStore`.
- **Custom Pages**: Both dispatch steps exist as custom full-page overrides (`RecordAssignSupplierPage` and `RecordMarkAsSentPage`) under the `Operations/Rfqs/` registry, while `ViewPage.vue` routes draft RFQs to the editable view and non-draft RFQs to the supplier overview.
- **Backend Sync**: `workflowStore.runBatchRequests` is used for the assignment / dispatch batch, with `workflowStore.updateResourceRecord` still used elsewhere for direct parent saves; no custom GAS endpoints are required for this flow.

## 8. Supplier Quotation Response Capture

### 8.1 Overview
Supplier Quotations capture normalized supplier responses received outside AQL after RFQs are sent. The module stores response headers in `SupplierQuotations` and quoted lines in `SupplierQuotationItems`.

This module intentionally stops at response capture. It does not compare quotations, score suppliers, generate POs, support alternate SKUs, snapshot RFQs, or store calculated partial/quoted flags.

### 8.2 Core Behaviors
1. **Index**: `/operations/supplier-quotations` shows Supplier Quotations grouped by `RECEIVED`, `ACCEPTED`, `REJECTED`, then other states. Stale rejected rows and accepted rows tied to completed procurements are hidden after the configured 14-day window.
2. **Create**: Staff select an RFQ with `Progress = SENT`, then choose one of its active `RFQSuppliers` rows. The create form captures `SupplierQuotationReference` and `AllowPartialPO` (`TRUE`/`FALSE`, default `TRUE`) on the quotation header. Duplicate supplier responses for the same RFQ warn but do not block.
3. **Response Types**: `QUOTED` requires every RFQ purchase requisition item to be quoted; `PARTIAL` allows missing item rows; `DECLINED` requires `DeclineReason` and does not require items.
4. **First Save Workflow**: First save writes the quotation header/items. If the matching `RFQSuppliers` row is still `ASSIGNED`, the save first stamps blank `SentDate`, moves it to `SENT`, and advances `Procurements.Progress` from `RFQ_GENERATED` to `RFQ_SENT_TO_SUPPLIERS` when still at that stage. The same save then marks the supplier row `RESPONDED`. If the supplier row is already `SENT`, it is marked `RESPONDED` directly. Finally, the linked procurement advances from `RFQ_SENT_TO_SUPPLIERS` to `QUOTATIONS_RECEIVED` only when it is still at that exact stage.
5. **Subsequent Edits**: Edits to an existing quotation update only the quotation header/items, including editable `SupplierQuotationReference` and `AllowPartialPO`, and do not re-run RFQSupplier or Procurement progress updates. Quotation item subtotal and confirmed total are runtime reactive calculations.
6. **Reject**: `RECEIVED` quotations can be rejected through the `Reject` AdditionalAction, which sets `Progress = REJECTED` and records `ProgressRejectedComment`, `ProgressRejectedAt`, and `ProgressRejectedBy`.

### 8.3 Architecture Details
- **Pages**: The menu route remains `/operations/supplier-quotations`, so the operation page resolver loads entity pages from `FRONTENT/src/pages/Operations/SupplierQuotations/`.
- **Composables**: Supplier Quotation workflow logic lives under `FRONTENT/src/composables/operations/supplierQuotations/`.
- **Backend**: The feature uses existing generic `compositeSave`, `batch`, `update`, and `executeAction` capabilities. No custom GAS endpoint is introduced.
- **Options**: Response type, quotation progress, extra charge keys, and currency are seeded through `APP.AppOptions` and delivered in the login payload.

## 9. Purchase Order Module

### 9.1 Overview
The Purchase Order module converts an eligible `SupplierQuotations` response into an active `PurchaseOrders` parent record with `PurchaseOrderItems` children.

### 9.2 Core Behaviors
1. **Creation Eligibility**: POs can only be created from Supplier Quotations with `ResponseType != DECLINED`, `Progress != REJECTED`, and `Status = Active`.
2. **Partial vs Full PO**: Governed by `SupplierQuotations.AllowPartialPO`. If false, the user must order all remaining quantities, quantities are readonly, and duplicates are blocked. If true, users can toggle items and reduce quantity down to the computed remaining quantity.
3. **Remaining Quantity**: Calculated strictly in frontend only as `SupplierQuotationItems.Quantity - SUM(PurchaseOrderItems.OrderedQuantity)`. Cancelled POs and inactive POs do not consume quantity. Closed POs do.
4. **RFQ Closing**: If the PO being created makes cumulative active PO item quantities exactly match every PR item quantity on the source RFQ, the user is warned that closing the RFQ prevents further supplier quotations. The RFQ closes only when the user confirms, and the close is executed through the RFQ `Close` AdditionalAction. The close payload records `ProgressClosedComment` as `<user_name>/system: "Complete purchase order created, hence closing RFQ"` and the backend action audit stamps `ProgressClosedBy` / `ProgressClosedAt`.
5. **No Data Duplication**: Supplier quotation terms (LeadTime, ShippingTerm, etc.) and calculated line totals are not copied into the stored PO record; they are displayed dynamically by resolving the quotation parent.
6. **Supplier Quotation Acceptance**: Creating a PO updates the source `SupplierQuotations.Progress` to `ACCEPTED` in the same save batch.
7. **Actions**: Handled exclusively through configuration-driven `AdditionalActions` (Send, Acknowledge, Accept, Cancel). Progress states map to `APP_OPTIONS_SEED.PurchaseOrderProgress`. Cancelling a PO marks matching `RFQSuppliers` rows for the PO RFQ/supplier as `CANCELLED`; when the linked procurement is `PO_ISSUED` and no other active non-cancelled PO exists for that procurement, it rolls back to `QUOTATIONS_RECEIVED`. If the source RFQ was `CLOSED`, cancellation reopens it to `SENT` and clears `ProgressClosedComment`.

### 9.3 Architecture Details
- **Pages**: `/operations/purchase-orders` handles index, create, and view.
- **Backend Sync**: Uses standard `workflowStore.runBatchRequests` for `compositeSave` and `executeAction` updates without new custom endpoints.
- **Composables**: Logic lives entirely in `FRONTENT/src/composables/operations/purchaseOrders/` providing stateless payload mapping, reactive frontend totals, and route-isolated flows.

## 10. PO Receiving + Goods Receipts

PO Receiving is the frontend-owned inspection layer between Purchase Orders and finalized Goods Receipt Notes (GRNs).

### 10.1 Workflow Rules
- PO Receiving drafts are saved only with `Progress = DRAFT`; save never writes `CONFIRMED` or `GRN_GENERATED`.
- Add/edit state follows the Purchase Requisition editable pattern: dirty draft state exposes Save only; clean saved draft state exposes Confirm only.
- Confirming a draft requires an existing POR code, `DRAFT` progress, valid form/items, and no unsaved changes in the add/edit flow. Saved draft PORs can also be confirmed from the read-only view when validation passes.
- GRN generation is blocked unless the POR is `CONFIRMED`, no active linked GRN exists, accepted item quantity is greater than zero, and linked procurement is not `COMPLETED`.
- `GoodsReceiptItems.Qty` stores accepted quantity only: `max(ReceivedQty - DamagedQty - RejectedQty, 0)`. Rows with accepted quantity `0` are excluded.
- GRN invalidation sets the GRN inactive, rolls active GRN items inactive, moves `POReceivings.Progress` from `GRN_GENERATED` back to `CONFIRMED`, and returns non-completed procurement to `GOODS_RECEIVING`.
- Receiving cancellation/replacement invalidates an active linked GRN first, cancels the POR through `POReceivings.Cancel`, and returns non-completed procurement to `PO_ISSUED`.

### 10.2 Architecture Details
- **Pages**: `/operations/po-receivings` handles index, draft/resume, and read-only action view. `/operations/goods-receipts` handles finalized GRN index/view only.
- **Backend Sync**: PO Receiving save, confirm, GRN creation, GRN invalidation, cancellation, and replacement are orchestrated through `workflowStore.runBatchRequests`. GRN creation uses `GoodsReceipts` + `GoodsReceiptItems` `compositeSave` in the first batch item, followed by configured `AdditionalActions`/updates and a grouped refresh `get`. `compositeSave` write responses include directly written parent/child rows so generated GRN headers are available to the frontend even when immediate sheet readback is sparse.
- **PostAction Ownership**: `POReceivings` and `GoodsReceipts` do not rely on `PostAction` hooks for workflow side effects; no custom GAS endpoint is used.
- **Composables**: Shared POR/GRN payload and batch request construction lives under `FRONTENT/src/composables/operations/poReceivings/`, keeping Vue pages UI-only.

## 11. Outlet & Field Sales Operations

Outlet & Field Sales Operations manages consignment outlet visits, restock requests, confirmed deliveries, outlet consumption, and movement-derived outlet stock.

### 11.1 Resource Model
- **Master resources**: `Outlets` and `OutletOperatingRules`.
- **Operation resources**: `OutletVisits`, `OutletRestocks`, `OutletRestockItems`, `OutletDeliveries`, `OutletConsumptions`, `OutletConsumptionItems`, `OutletConsumptionInvoices`, `OutletConsumptionInvoiceItems`, `OutletMovements`, and `OutletStorages`.
- **Source of truth**: `OutletMovements` is the stock ledger. `OutletStorages` is the derived current outlet balance keyed by `OutletCode + SKU`.
- **Delivery truth**: `OutletDeliveries.OutletRestockItemCodes` stores a CSV of ORI codes; delivery progress is derived from ORSI row progress matched against the CSV.

### 11.2 Visit Workflow
1. Field users create planned visits with `OutletCode`, `Date`, `Status = Active`, `Progress = PLANNED`, and optional progress comment.
2. An active planned visit can be completed, postponed, or cancelled only from `Progress = PLANNED`.
3. Completion updates the same row to `Status = COMPLETED` and stores any completion note in `StatusComment`.
4. Cancellation requires a comment and updates the same row to `Status = CANCELLED` with `StatusComment`.
5. Postponement requires a reason and new date. The flow updates the original visit to `Status = POSTPONED` with `StatusComment`, then creates a new `PLANNED` visit for the same outlet/date without previous/next link columns.

### 11.3 Restock Workflow
1. Sales executives create restock drafts in `DRAFT` or revise the same document in `REVISION_REQUIRED`.
2. Draft saves use `OutletRestocks` + `OutletRestockItems` composite save. Request quantities use `Quantity`, must be positive, and SKUs must not duplicate inside the same restock.
3. Submitting a new request first saves the draft, reads the generated restock code from the composite response, and then executes the configured `Submit` action to set `Progress = PENDING_APPROVAL`. Resubmitting from `REVISION_REQUIRED` requires a creator comment.
4. Approvers review pending ORSI rows grouped by warehouse availability: fully available, partially available, and not available. Recommendations prefer one storage that fully satisfies the row, then the best two-storage combination with least surplus, then smallest available storages first.
5. Approval can allocate any positive quantity. Applying a recommendation creates one `ALLOCATED` ORSI row per warehouse/storage allocation; partial allocation also creates a `PENDING` remainder row for the unallocated quantity.
6. Approval stamps `ApprovedUser`, row-level allocated fields, and creates negative `StockMovements` only for `ALLOCATED` ORSI rows. Not-available rows remain visible and cannot be allocated.
7. Send-back uses the same parent/child rows for revision rather than creating a replacement restock; the creator can edit/update/add/deactivate child rows only in `REVISION_REQUIRED`.

### 11.4 Delivery Workflow
1. Deliveries can be created only from ALLOCATED ORSI rows not already linked to an active delivery's `OutletRestockItemCodes` CSV.
2. OD creation writes one `OutletDeliveries` header with `OutletRestockItemCodes` set to the CSV of selected ORI codes.
3. Delivering an ORSI posts positive `OutletMovements` with `ReferenceType = RestockDelivery`, marks ORSI `DELIVERED`, and updates `OutletRestocks.Progress`.
4. OD progress remains `DRAFT` until the first ORSI is delivered, then becomes `IN_TRANSIT`; once all linked ORSIs are delivered it becomes `COMPLETED`.
5. DRAFT cancellation returns linked ORSIs to `ALLOCATED`; delivered ODs cannot be cancelled.

### 11.5 Consumption Workflow
1. Add flow is componentized into outlet context, mobile stock count, and summary/checklist steps. Date and username default internally and are not primary editable inputs.
2. User selects outlet first; upcoming active planned visit is auto-selected when available (`Status = Active`, `Progress = PLANNED`, nearest `Date >= today`). Visit completion stays explicit through the checklist.
3. Stock count uses `OutletStorages` by outlet/SKU. For each SKU, user enters counted current stock; sold quantity is derived as `max(systemQty - currentQty, 0)`. The stock-count UI is mobile-first and does not use a table layout.
4. Summary shows sold rows (read-only for persistence) and editable restock rows (default-copied from sold rows, with add/remove support).
5. Final checklist controls side effects in aligned rows: complete selected visit, schedule next visit, generate invoice, place restock request, submit restock immediately.
6. Submit writes `OutletConsumptions` + `OutletConsumptionItems(Qty)` first, then side effects in follow-up batch phases:
   - negative `OutletMovements` with `ReferenceType = Consumption`
   - optional `OutletConsumptionInvoices`
   - optional visit completion and next-visit scheduling
   - optional restock create/submit
7. Next planned visits created by consumption include a comment like `Auto planned after outlet consumption OC260001 by Firose Hussain on 29/10/2022`.
8. `OutletConsumptions.Progress` is `INVOICE_GENERATED` when invoice is generated, otherwise `PENDING_INVOICE_GENERATION`; cancellation remains action-based.
9. Pending invoice consumptions can generate an invoice from the view page. Invoice generation now resolves `PriceListCode` from `OutletOperatingRules.PriceListCode` or the default `PriceList`; `PriceListLookup` determines whether SKU prices come from inline `SKUPrices` JSON or `PriceListItems` rows. One active `OutletConsumptionInvoiceItems` row is created per active `OutletConsumptionItems` row with resolved price. Invoice `Subtotal` is computed as `sum(Qty * Price)` from generated item rows. Missing SKU prices block invoice generation with a user-facing error.
10. `OutletConsumptionInvoices` is exposed as list/view only; no add page exists.
11. Outlet stock balance changes only through the outlet movement post-write hook. No direct `OutletStorages` edits are allowed.

### 11.6 Architecture Details
- **Frontend**: Business rules, validation, batch orchestration, quantity calculations, and navigation live under `FRONTENT/src/composables/operations/outlets/`. Vue pages remain thin Quasar orchestration shells.
- **Components**: Reusable outlet UI blocks live under `FRONTENT/src/components/Operations/Outlets/` and remain UI-only.
- **Backend**: Uses generic resource APIs, configured `AdditionalActions`, composite save, bulk/update/create, and the outlet movement post-write hook. No custom endpoint is required.
- **Lock rules**: Submitted/restock approval states are not directly edited; revisions use send-back and resubmission. `OutletStorages` is never directly edited by frontend operation pages.

<!-- Future modules -- add sections as they are built:
12. [Data Backup & Restore](#12-data-backup--restore)
13. [Bulk Upload](#13-bulk-upload)
14. [Dashboard Widgets](#14-dashboard-widgets)
-->
