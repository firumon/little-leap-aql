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

## 11. Outlet Deliveries Schedule-Then-Deliver

### 11.1 Overview
Outlet Deliveries are now schedule-first documents. Approved or partially delivered `OutletRestocks` are selected from cards on the OD add page, scheduled against a warehouse, and written with `Progress = SCHEDULED`. Scheduling immediately creates negative `StockMovements` rows with `ReferenceType = OutletRestock` to reserve/deduct warehouse stock.

### 11.2 Data Ownership
- `OutletDeliveries.ItemsJSON` stores lowercase rows `{ sku, storage, qty }` copied from approved restock storage allocations.
- `OutletDeliveries.Progress` uses `SCHEDULED`, `DELIVERED`, and `CANCELLED` from `OutletDeliveryProgress`.
- `StockMovements.ReferenceType = OutletRestock` reserves warehouse stock using `ReferenceCode = OutletRestocks.Code`.
- `StockMovements.ReferenceType = OutletDeliveryCancel` reverses scheduled warehouse reservations using `ReferenceCode = OutletDeliveries.Code`.
- `OutletMovements.ReferenceType = RestockDelivery` posts delivered stock into outlets using `ReferenceCode = OutletDeliveries.Code`.
- `OutletStorages` is a derived SKU-only balance keyed by `OutletCode + SKU` with columns `Code`, `OutletCode`, `SKU`, and `Quantity` only.

### 11.3 Workflow
1. Add page loads approved and partially delivered `OutletRestocks`, existing `OutletDeliveries`, restock items, outlets, warehouses, SKUs, and products through the workflow store.
2. User selects one eligible ORS card. ORS is ineligible if it already has an active `SCHEDULED` OD.
3. Composable builds OD `ItemsJSON` from `OutletRestockItems.StorageAllocationJSON` and shows a read-only packing grid.
4. Scheduling runs one batch: create `OutletDeliveries` + bulk negative `StockMovements`. The returned OD code is used directly for navigation; no same-resource `get` follows the write.
5. Delivery runs one batch: `executeAction` Deliver + bulk positive `OutletMovements` aggregated by SKU + update ORS progress to `DELIVERED` or `PARTIALLY_DELIVERED`.
6. Cancellation runs one batch: `executeAction` Cancel + bulk positive `StockMovements` with `OutletDeliveryCancel`.

### 11.4 Batch And Sync Rules
- Scheduling, delivery, and cancellation use `useWorkflowStore.runBatchRequests`.
- Batch helpers attach `lastUpdatedAtByResource` cursors from IDB metadata before write actions, preserving delta-on-write behavior.
- Write responses are consumed directly; no redundant `get` is issued after `create`, `update`, or `executeAction`.
- General frontend reloads continue to use the cache/last-sync throttle logic in `ResourceFetchService`.

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

---

## 1. Report Generation (PDF)

### 1.1 Overview

The report system generates PDF documents from Google Sheets templates. A user clicks a report button in the frontend, the system clones a template sheet, injects data into cells, exports to PDF via Google's export API, and returns a Base64-encoded PDF for download.

### 1.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND (Quasar)                                                  │
│                                                                     │
│  _common/IndexPage.vue                                              │
│    ├── MasterListReportBar.vue ──── toolbar-level report buttons          │
│    └── MasterDetailDialog.vue ── record-level report buttons        │
│           │                                                         │
│           ▼                                                         │
│  useReports(currentResource)  ← composable, accepts resource ref    │
│    ├── getToolbarReports(config)  → filters non-record reports      │
│    ├── getRecordReports(config)   → filters record-level reports    │
│    ├── initiateReport(report, record?)                              │
│    │     ├── if user input needed → opens ReportInputDialog         │
│    │     └── else → executeReport()                                 │
│    └── executeReport(report, userValues, record)                    │
│          ├── buildCellData(report, record, userInputs)              │
│          └── callGasApi('generateReport', payload)                  │
│                │                                                    │
│                ▼  API payload: { resource, reportName,              │
│                                  templateSheet, cellData }          │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND (Google Apps Script)                                       │
│                                                                     │
│  apiDispatcher.gs                                                   │
│    case 'generateReport' → generateReportPdf(auth, data)            │
│                                                                     │
│  reportGenerator.gs                                                 │
│    generateReportPdf(auth, data):                                   │
│      1. Resolve REPORTS file ID via resolveFileIdForScope('report') │
│      2. Open REPORTS spreadsheet                                    │
│      3. Find template sheet by name                                 │
│      4. Clone template → temp sheet (_TEMP_<timestamp>)             │
│      5. Inject cellData into temp sheet cells                       │
│      6. SpreadsheetApp.flush() (recalculate formulas)               │
│      7. Resolve pdfOptions from APP.Resources report config         │
│         └─ getResourceConfig(resource) ← CACHED (free lookup)      │
│         └─ Find matching report by label/name                       │
│         └─ Extract report.pdfOptions                                │
│      8. _exportSheetAsPdf(file, tempSheet, pdfOptions)              │
│      9. Base64-encode PDF blob → return to frontend                 │
│     10. Cleanup: delete temp sheet (in finally block)               │
│                                                                     │
│  _exportSheetAsPdf(spreadsheet, sheet, options):                    │
│    Builds Google Sheets export URL with parameters:                 │
│      - size, portrait, fitw, gridlines, margins, fzr, gid          │
│    Fetches via UrlFetchApp with OAuth token                         │
│    Returns PDF blob                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Files Involved

| File | Role |
|---|---|
| `GAS/reportGenerator.gs` | Core PDF generation: template cloning, data injection, PDF export, cleanup |
| `GAS/reportManager.html` | Sheet Menu UI dialog for managing report configs per resource |
| `GAS/appMenu.gs` | Menu handlers: `app_showReportManagerDialog()`, `app_getReportManagerData()`, `app_saveResourceReports()` |
| `GAS/resourceRegistry.gs` | Caches `APP.Resources` config including `reports` array and `pdfOptions` |
| `GAS/apiDispatcher.gs` | Routes `generateReport` action to `generateReportPdf()` |
| `FRONTENT/src/composables/useReports.js` | Frontend composable: report filtering, input collection, API call, PDF download |
| `FRONTENT/src/composables/useResourceNav.js` | Composable for route navigation logic across scopes. |
| `FRONTENT/src/pages/Masters/_common/IndexPage.vue` | Integrates `useReports(currentResource)` with the master page |
| `FRONTENT/src/components/Masters/MasterListReportBar.vue` | Renders toolbar-level report buttons |
| `FRONTENT/src/components/Masters/MasterDetailDialog.vue` | Renders record-level report buttons |
| `FRONTENT/src/components/Masters/ReportInputDialog.vue` | Dialog for collecting user inputs before generation |

### 1.4 Configuration (APP.Resources.Reports Column)

Each resource in `APP.Resources` has a `Reports` column containing a JSON array. Each report object:

```json
[
  {
    "id": "rep_1711234567890",
    "name": "product-list",
    "label": "Product List",
    "templateSheet": "Report.ProductList",
    "isRecordLevel": false,
    "inputs": [
      {
        "field": "Code",
        "targetCell": "B2"
      },
      {
        "label": "Date Range",
        "type": "date",
        "targetCell": "B3",
        "required": true
      },
      {
        "default": "Company Name",
        "targetCell": "A1"
      }
    ],
    "pdfOptions": {
      "topMargin": 0,
      "bottomMargin": 0.25,
      "leftMargin": 0,
      "rightMargin": 0,
      "size": "A4",
      "portrait": true
    }
  }
]
```

#### Report Object Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Unique ID, auto-generated as `rep_<timestamp>` |
| `name` | string | Yes | Slug identifier (auto-derived from label) |
| `label` | string | Yes | Display name shown in UI buttons |
| `templateSheet` | string | Yes | Sheet name in the REPORTS spreadsheet file to clone |
| `isRecordLevel` | boolean | No | `true` = shown per-row in detail dialog; `false` = toolbar button |
| `inputs` | array | No | Data mapping definitions (see below) |
| `pdfOptions` | object | No | PDF export overrides (see below) |

#### Input Mapping Types

Each entry in `inputs` maps a value to a target cell in the template:

| Pattern | Fields | Description |
|---|---|---|
| **Context (Record)** | `field`, `targetCell` | Value sourced from the current record's field |
| **User Input** | `label`, `type`, `targetCell`, `required?`, `default?` | Prompts user via dialog before generation |
| **Static** | `default`, `targetCell` | Fixed value injected without user interaction |

`type` values: `text`, `number`, `date`, `boolean`, `static`

#### pdfOptions Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `topMargin` | number | `0` | Top margin in inches |
| `bottomMargin` | number | `0.25` | Bottom margin in inches |
| `leftMargin` | number | `0` | Left margin in inches |
| `rightMargin` | number | `0` | Right margin in inches |
| `size` | string | `"A4"` | Paper size: `A4`, `Letter`, `Legal` |
| `portrait` | boolean | `true` | `true` = portrait, `false` = landscape |

If `pdfOptions` is omitted entirely, the defaults above apply.

### 1.5 PDF Export Parameters (Google Sheets Export API)

The export URL is built in `_exportSheetAsPdf()` in `reportGenerator.gs`:

```
https://docs.google.com/spreadsheets/d/{id}/export?
  exportFormat=pdf
  &format=pdf
  &size=A4              ← from pdfOptions.size
  &portrait=true        ← from pdfOptions.portrait
  &fitw=true            ← always fit content to page width
  &gridlines=false      ← never show gridlines
  &printtitle=false     ← no spreadsheet title
  &sheetnames=false     ← no sheet name in header
  &pagenum=UNDEFINED    ← no page numbers
  &fzr=true             ← ALWAYS repeat frozen rows on every page
  &top_margin=0         ← from pdfOptions (in inches)
  &bottom_margin=0.25   ← from pdfOptions (in inches)
  &left_margin=0        ← from pdfOptions (in inches)
  &right_margin=0       ← from pdfOptions (in inches)
  &gid={sheetId}        ← targets the specific temp sheet
```

**Hardcoded behaviors** (not configurable per report):
- `fitw=true` — content always scales to fit page width
- `fzr=true` — frozen rows in the template always repeat on every page
- `gridlines=false` — gridlines never printed
- `printtitle=false`, `sheetnames=false` — no auto headers

### 1.6 Report Manager (Sheet Menu UI)

Accessed via **AQL 🚀 > Manage Reports** in the Google Sheet.

**Flow:**
1. Dialog loads all resources and template sheet names via `app_getReportManagerData()`
2. User selects a resource → shows existing reports
3. User can Add/Edit/Delete reports
4. Editor modal has:
   - Report Title, Template Sheet, Display Location (record-level toggle)
   - **PDF Options**: Top/Bottom/Left/Right margins, Paper Size, Orientation
   - **Data Mappings**: Source Field / User Label / Input Type / Target Cell / Required
5. Save calls `app_saveResourceReports(resourceName, reportsJson)` → writes JSON to `APP.Resources.Reports` column → **clears resource config cache** (all 3 tiers)

### 1.7 Cache Flow for Report Config

Report configs are part of `APP.Resources` and cached via the 3-tier caching system:

```
Tier 1: In-memory (_resource_config_map_cache)     ← per-execution
Tier 2: CacheService ('AQL_RESOURCE_CONFIG_MAP_V2') ← 5-min TTL
Tier 3: APP.Metadata sheet (permanent fallback)     ← survives cold starts
```

**Cache invalidation** (via `clearResourceConfigCache()`):
- Clears all 3 tiers (in-memory, CacheService, and Metadata row)
- Called by: `handleAddResource()`, `handleEditResource()`, `app_saveResourceReports()`
- The next `getResourceConfig()` call rebuilds from the `APP.Resources` sheet and re-populates all 3 tiers

**Full APP cache invalidation** (via `clearAllAppCaches()` / menu item `AQL 🚀 > Resources > Clear All App Caches`):
- Clears in-memory APP/header/resource caches.
- Clears all permanent rows below the header in `APP.Metadata`.
- Returns a summary with target spreadsheet and cleared-row count so wrong-spreadsheet or no-op cache clears are visible.
- Use this after APP resource/header setup changes when stale permanent header metadata is suspected.

**Critical:** The `pdfOptions` lookup in `generateReportPdf()` uses `getResourceConfig(resource)` which hits the cache — no extra sheet read overhead.

### 1.8 REPORTS Spreadsheet File

- The REPORTS file is a separate Google Spreadsheet containing template sheets
- File ID resolved via: `resolveFileIdForScope('report', '')` which checks `APP.Config[reportFileID]`
- Each template sheet (e.g., `Report.ProductList`) is the source for cloning
- Template design tips:
  - **Frozen rows** in the template repeat on every PDF page automatically
  - **Margins** are controlled via `pdfOptions` in the report config (sheet print settings are ignored by the export API)
  - Use cell references (e.g., `B2`) in input mappings to inject dynamic data
  - Formulas in the template recalculate after data injection (via `SpreadsheetApp.flush()`)

### 1.9 Frontend Integration Pattern

```javascript
// In any page that needs reports:
import { useReports } from 'src/composables/useReports'

// Pass the resource name as a ref/computed/string
const { initiateReport, getToolbarReports, getRecordReports, ... } = useReports(currentResource)

// Toolbar reports (page-level buttons)
const toolbarReports = computed(() => getToolbarReports(config.value))

// Record reports (per-row buttons in detail dialog)
const recordReports = computed(() => getRecordReports(config.value))

// Trigger generation
initiateReport(report)          // toolbar-level
initiateReport(report, record)  // record-level (injects record fields)
```

### 1.10 Known Behaviors & Gotchas

1. **Margins are NOT inherited from sheet print settings.** Google's PDF export API ignores the template's print configuration. Margins must be set via `pdfOptions` in the report config JSON.
2. **Frozen rows always repeat.** The `fzr=true` parameter is hardcoded. If the template has frozen rows, they appear on every page.
3. **Temp sheet cleanup is guaranteed.** The `finally` block in `generateReportPdf()` always deletes the temp sheet, even on errors.
4. **Cache invalidation is critical.** After modifying report configs (via Report Manager UI or direct sheet edit), the resource config cache must be cleared. The Report Manager UI does this automatically. Direct sheet edits require manual cache clear (AQL 🚀 > Setup & Refactor > Sync APP Resources).
5. **Resource name must reach the backend.** The `useReports(resourceNameRef)` composable resolves the resource name and sends it in the API payload. Without it, the backend cannot look up `pdfOptions` from the config.
6. **Template sheets live in the REPORTS file**, not in the APP file. The REPORTS file ID is resolved from `APP.Config`.

---

## 2. Master Pages — 3-Tier Section-Level Component Architecture

### 2.1 Overview

All master/operation/accounts pages (Index, View, Add, Edit, Action, Resource/Record custom pages) use a **3-tier section-level component architecture** where each visual section is an independently replaceable component. The system supports **per-tenant customization** driven by `APP.Resources.CustomUIName`, with automatic fallback through three resolution tiers.

This means you can customize just the **header** of the Products page for a specific tenant without duplicating the entire page — all other sections continue using their defaults. Custom pages (`resource-page` and `record-page`) use file naming conventions like `{Entity}{PageSlug}.vue` and `{Entity}Record{PageSlug}.vue`.

### 2.2 Architecture Diagram

```
Route: /:scope(masters|operations)/:resourceSlug/(_add|:pageSlug|:code/(_view|_edit|_action/:action|:pageSlug))
         │
         ▼
ActionResolverPage.vue  ← Page-level 3-tier resolution
  Tier 1: ./_custom/{CustomUIName}/{Entity}.vue (or {Entity}{Action}.vue, or {Entity}{PageSlug}.vue)
  Tier 2: ./{Entity}/IndexPage.vue (or {Action}Page.vue, or {PageSlug}Page.vue)
  Tier 3: ./_common/IndexPage.vue (or {Action}Page.vue)  ← (No fallback for custom pages)
         │
         ▼
_common/{Action}Page.vue  ← Thin orchestrator (default)
  Uses: useSectionResolver({ resourceSlug, customUIName, sectionDefs })
         │
         ├── Tier 1 (tenant-custom):  components/Masters/_custom/{Code}/{Entity}{Section}.vue
         ├── Tier 2 (entity-custom):  components/Masters/{Entity}/{Section}.vue
         └── Tier 3 (default):        components/Masters/Master{Action}{Section}.vue
```

### 2.3 Three-Tier Discovery

There are **two independent discovery layers**, each with 3-tier resolution:

#### Page-Level Discovery (`ActionResolverPage.vue`)
Resolves the entire page component for a given action.

| Tier | Path Pattern | Example |
|------|-------------|---------|
| 1. Tenant-custom | `_custom/{CustomUIName}/{Entity}.vue` or `{Entity}{Action}.vue` | `_custom/A2930/Products.vue` |
| 2. Entity-custom | `{Entity}/{Action}Page.vue` | `Products/IndexPage.vue` |
| 3. Default | `_common/{Action}Page.vue` | `_common/IndexPage.vue` |

**Custom Page Fallbacks:**
Custom pages (`action: 'resource-page'` or `'record-page'`) resolve through Tier 1 and Tier 2 only, using the `pageSlug` URL parameter.
- `resource-page`: `_custom/{CustomUIName}/{Entity}{PascalCase(pageSlug)}.vue` → `{Entity}/{PascalCase(pageSlug)}Page.vue`
- `record-page`: `_custom/{CustomUIName}/{Entity}Record{PascalCase(pageSlug)}.vue` → `{Entity}/Record{PascalCase(pageSlug)}Page.vue`
If not found, it renders a "Page not found" card.

#### Section-Level Discovery (`useSectionResolver.js`)
Resolves individual sections within a default page.

| Tier | Path Pattern | Example |
|------|-------------|---------|
| 1. Tenant-custom | `_custom/{CustomUIName}/{Entity}{Section}.vue` | `_custom/A2930/ProductsListHeader.vue` |
| 2. Entity-custom | `{Entity}/{Section}.vue` | `Products/ListHeader.vue` |
| 3. Default | `Master{Action}{Section}.vue` | `MasterListHeader.vue` |

**Priority**: If a full custom page exists at tier 1 or 2, section-level discovery is bypassed (the custom page controls its own sections).

**`CustomUIName`**: Stored in `APP.Resources` per resource. Delivered to frontend via auth payload at `config.ui.customUIName`. The same value drives both page-level and section-level resolution.

### 2.4 Action Pages & Their Sections

#### Index Page (`_common/IndexPage.vue`)
| Section | Default Component | Props | Events |
|---------|-------------------|-------|--------|
| ListHeader | `MasterListHeader.vue` | `config, filteredCount, totalCount, loading, backgroundSyncing` | `reload` |
| ListReportBar | `MasterListReportBar.vue` | `reports, isGenerating` | `generate-report(report)` |
| ListToolbar | `MasterListToolbar.vue` | `searchTerm` | `update:searchTerm(value)` |
| ListViewSwitcher | `MasterListViewSwitcher.vue` | `views, activeViewName, counts` | `update:activeViewName(name)` |
| ListRecords | `MasterListRecords.vue` | `items, loading, resolvedFields, childCountMap` | `navigate-to-view(row)` |

**List Views Filtering Flow:**
- `useListViews` composable evaluates filter trees from `APP.Resources.ListViews` JSON.
- `ListViews` mode is derived from the same cell:
  - blank (`""`) => auto mode
  - `[]` => off mode
  - non-empty array => custom mode
- In custom mode, configured views fully override defaults (no merge).
- In auto mode with `Status` header, frontend auto-generates `Active` (default) and `Inactive`.
- In off mode (or auto mode without `Status`), no view switcher is shown.
- View chip counts are computed from the full item set (ignoring search text).
- Search is applied on top of the selected view filter.
- Current runtime mode: local state switching (no URL query sync), so list view changes do not remount the page shell.

**Manage Lists Admin Flow (Sheet UI):**
- Menu: `AQL > Resources > Manage Lists`.
- If a resource has custom views, dialog shows list view cards (add/edit/delete).
- If a resource has no custom views, dialog shows one select + `Update`:
  - Fallback option -> writes blank `ListViews` cell (auto mode).
  - Off option -> writes `[]` (off mode).
- Adding a new view writes non-empty JSON (custom mode).
- Deleting the last custom view writes `[]` (off mode).

#### View Page (`_common/ViewPage.vue`)
| Section | Default Component | Props | Events |
|---------|-------------------|-------|--------|
| ViewHeader | `MasterViewHeader.vue` | `config, record, resourceName, code, primaryText` | — |
| ViewActionBar | `MasterViewActionBar.vue` | `config, record, code, resourceSlug, scope, additionalActions, permissions` | — |
| ViewDetails | `MasterViewDetails.vue` | `record, resolvedFields, resourceHeaders` | — |
| ViewAudit | `MasterViewAudit.vue` | `record` | — |
| ViewChildren | `MasterViewChildren.vue` | `childResources, record, code` | — |

#### Add Page (`_common/AddPage.vue`)
| Section | Default Component | Props | Events |
|---------|-------------------|-------|--------|
| AddHeader | `MasterAddHeader.vue` | `config, resourceName` | — |
| AddForm | `MasterAddForm.vue` | `resolvedFields, parentForm, resourceHeaders` | `update:field(header, value)` |
| AddChildren | `MasterAddChildren.vue` | `childResources, childRecords` | `add-child, remove-child, update-child-field` |
| AddActions | `MasterAddActions.vue` | `saving, submitLabel` | `cancel, submit` |

#### Edit Page (`_common/EditPage.vue`)
| Section | Default Component | Props | Events |
|---------|-------------------|-------|--------|
| EditHeader | `MasterEditHeader.vue` | `config, resourceName, code` | — |
| EditForm | `MasterEditForm.vue` | `resolvedFields, parentForm, resourceHeaders, code` | `update:field(header, value)` |
| EditChildren | `MasterEditChildren.vue` | `childResources, childRecords` | `add-child, remove-child, update-child-field` |
| EditActions | `MasterEditActions.vue` | `saving, submitLabel` | `cancel, submit` |

#### Action Page (`_common/ActionPage.vue`)
| Section | Default Component | Props | Events |
|---------|-------------------|-------|--------|
| ActionHeader | `MasterActionHeader.vue` | `config, record, code, actionConfig, primaryText` | — |
| ActionForm | `MasterActionForm.vue` | `actionConfig, actionFields, actionForm` | `update:field(key, value), update:outcome(value)` |
| ActionActions | `MasterActionActions.vue` | `actionConfig, saving, submitDisabled` | `cancel, submit` |

### 2.5 Files Involved

| File | Role |
|---|---|
| `FRONTENT/src/composables/resources/useSectionResolver.js` | Generic 3-tier section resolver composable |
| `FRONTENT/src/pages/Masters/ActionResolverPage.vue` | 3-tier page-level resolver with `CustomUIName` support |
| `FRONTENT/src/pages/Masters/_common/IndexPage.vue` | Index (list) orchestrator — layout, composables, FAB, dialog |
| `FRONTENT/src/pages/Masters/_common/ViewPage.vue` | View orchestrator — record details, children, actions, reports |
| `FRONTENT/src/pages/Masters/_common/AddPage.vue` | Add orchestrator — composite form, children, submit |
| `FRONTENT/src/pages/Masters/_common/EditPage.vue` | Edit orchestrator — load record, composite form, submit |
| `FRONTENT/src/pages/Masters/_common/ActionPage.vue` | Action orchestrator — additional action form + outcome |
| `FRONTENT/src/components/Masters/Master*.vue` | 20 default section components (4 Index + 5 View + 4 Add + 4 Edit + 3 Action) |
| `FRONTENT/src/components/Masters/MasterRecordCard.vue` | Individual record card (used by MasterListRecords) |
| `FRONTENT/src/pages/Masters/_custom/REGISTRY.md` | Registry for tenant-custom full pages |
| `FRONTENT/src/components/Masters/_custom/REGISTRY.md` | Registry for tenant-custom section components |

### 2.6 How to Create Custom Overrides

#### Option A: Tenant-Custom Section (Most Common)

For a specific tenant (identified by `CustomUIName` in `APP.Resources`), override one section:

```
FRONTENT/src/components/Masters/_custom/{CustomUIName}/{Entity}{Section}.vue
```

Example: Custom list header for Products under tenant code `A2930`:
```
FRONTENT/src/components/Masters/_custom/A2930/ProductsListHeader.vue
```

#### Option B: Entity-Custom Section (All Tenants)

Override one section for an entity across all tenants:

```
FRONTENT/src/components/Masters/{Entity}/{Section}.vue
```

Example: Custom view details for all Products:
```
FRONTENT/src/components/Masters/Products/ViewDetails.vue
```

#### Option C: Tenant-Custom Full Page (Rare)

Replace the entire page for a specific tenant:

```
FRONTENT/src/pages/Masters/_custom/{CustomUIName}/{Entity}.vue          → Index
FRONTENT/src/pages/Masters/_custom/{CustomUIName}/{Entity}{Action}.vue  → Other actions
```

#### Guidelines
- Custom components should be **tiny layout shells** that reuse shared composables and components.
- Props and events must match the default component's contract.
- No registration needed — `import.meta.glob` auto-discovers files at build time.
- Dev server restart may be needed after creating new files.
- PascalCase is strict: `products` → `Products`, `warehouse-storages` → `WarehouseStorages`.

### 2.7 Glob Patterns

```js
// useSectionResolver.js — section-level
const entitySectionModules = import.meta.glob([
  '../components/Masters/*/*.vue',
  '!../components/Masters/_custom/**',
  '!../components/Masters/BulkUpload/**'
])
const customSectionModules = import.meta.glob('../components/Masters/_custom/**/*.vue')

// ActionResolverPage.vue — page-level
const customPageModules = import.meta.glob(['./*/*.vue', '!./_custom/**', '!./_common/**'])
const customTenantModules = import.meta.glob('./_custom/**/*.vue')
```

All globs are **lazy** — components are only loaded when navigated to.

### 2.8 Resolution Flow (Runtime Example)

```
User navigates to /masters/products
  │
  ▼
ActionResolverPage watches route change
  → slug = "products", action = "index", customUIName = "A2930"
  │
  ├── Tier 1: ./_custom/A2930/Products.vue exists? NO
  ├── Tier 2: ./Products/IndexPage.vue exists? NO
  └── Tier 3: ./_common/IndexPage.vue → LOAD
  │
  ▼
_common/IndexPage.vue mounts
  → useSectionResolver({ resourceSlug, customUIName: "A2930", sectionDefs })
  → entityName = "Products"
  │
  ├── resolveSection("Products", "ListHeader", MasterListHeader, "A2930")
  │     → Tier 1: _custom/A2930/ProductsListHeader.vue? → Found → USE
  │
  ├── resolveSection("Products", "ListReportBar", MasterListReportBar, "A2930")
  │     → Tier 1: not found → Tier 2: Products/ListReportBar.vue? → not found
  │     → Tier 3: MasterListReportBar (default)
  │
  └── ... (same for Toolbar, Records)
  │
  ▼
sectionsReady = true → template renders all <component :is="...">
```

### 2.9 APP.Resources.CustomUIName Column

- Added to all 32 resources in `GAS/syncAppResources.gs` (default: empty string).
- Read in `GAS/resourceRegistry.gs` and delivered in auth payload at `ui.customUIName`.
- Empty value = skip tier 1 resolution (go straight to entity-custom → default).
- Same value can be shared across resources for one tenant, or unique per resource.

### 2.10 Known Behaviors & Rules

1. **Mix and match**: Override just one section while all others use defaults. Each section resolves independently.
2. **Full page override takes priority**: If a custom page exists at tier 1 or 2, section-level discovery is bypassed entirely.
3. **Props must match**: Custom components receive the same props as the default.
4. **Events must match**: Custom components must emit the same event names for the orchestrator to function.
5. **Dev server restart**: After creating new files, Vite may need a restart to pick up new glob matches.
6. **PascalCase is strict**: Directory/file names must match the PascalCase conversion of the slug exactly.
7. **Registries**: Tenant-custom overrides should be registered in the `_custom/REGISTRY.md` files. Default components are in `components/REGISTRY.md`.
8. **Tiny custom files**: Custom components should be small layout glue over shared composables/components — not duplicated logic.

### 2.11 Architecture Contract Link

- All frontend implementation under this module must follow `Documents/ARCHITECTURE RULES.md`.
- Core defaults are mandatory: `useDataStore`, `useWorkflowStore`, `useSyncStore`, `useClientCacheStore`, `useResourceNav`, `useSectionResolver`, `useActionResolver`.
- API transport must use canonical request/response envelopes with request correlation; resource payload ingestion must be generic and header-light by default.

---

## 3. Operation Pages — 3-Tier Architecture

### 3.1 Overview

Operations pages use an identical 3-tier discovery mechanism as Masters, but with a different default section set — particularly for the `ViewPage`. 

Operations data generally flows top-down (e.g. Purchase Requisitions → Purchase Orders → Receipts) and tracks complex lifecycles via `additionalActions`. Operations views exclude the generic `ViewAudit` section and substitute a `ViewParent` section.

```
Route: /:scope(masters|operations)/:resourceSlug/(_add|:pageSlug|:code/(_view|_edit|_action/:action|:pageSlug))
```

### 3.2 Key Differences vs Masters

- **Router Split**: Operations route dynamic block (`/operations/:resourceSlug/...`) hits `pages/Operations/ActionResolverPage.vue`, completely detached from the masters/accounts routing block.
- **Section Resolver Scope**: `useSectionResolver` takes an optional `scope` parameter (`'operations'`). When set, it uses independent glob maps pointing to `components/Operations/`.
- **ViewPage Orchestrator**: The default operations `ViewPage.vue` orchestrator includes `ViewHeader`, `ViewActionBar`, `ViewDetails`, `ViewParent`, and `ViewChildren`.
- **ViewDetails Filtering**: The default `OperationViewDetails` dynamically filters out both audit columns (`CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`) and any action stamp columns dynamically generated from the resource's `additionalActions` configuration (e.g. `ApprovedBy`, `ApprovedAt`, `RejectedBy`, `RejectedAt`).
- **ViewParent Handling**: `OperationViewParent` automatically fetches the parent record (based on the `{ParentName}Code` header resolution logic). 
  - If the parent record has a `Name` field, it displays as a minimal inline link: `Name (Code)`.
  - If the parent record has no `Name` field, it displays a full embedded data card excluding audit/action fields.

### 3.3 Files Involved

| File | Role |
|---|---|
| `FRONTENT/src/pages/Operations/ActionResolverPage.vue` | 3-tier page-level resolver for Operations scope |
| `FRONTENT/src/pages/Operations/_common/ViewPage.vue` | View orchestrator for Operations (custom section set) |
| `FRONTENT/src/pages/Operations/_common/{Add,Edit,Action,Index}Page.vue` | Other orchestrators (structural mirrors of Masters) |
| `FRONTENT/src/components/Operations/_common/Operation*.vue` | 22 default section components for Operations |
| `FRONTENT/src/pages/Operations/_custom/REGISTRY.md` | Registry for tenant-custom full pages |
| `FRONTENT/src/components/Operations/_custom/REGISTRY.md` | Registry for tenant-custom section components |
| `FRONTENT/src/composables/resources/useResourceNav.js` | Composable for route navigation logic across scopes. |

### 3.4 Architecture Contract Link

- Operations frontend flows must comply with `Documents/ARCHITECTURE RULES.md` and the same core defaults listed in section 2.11.
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

### 5.1 Overview

Menu Access Control enables fine-grained permission-based visibility of resources in the sidebar and route protection using a flexible `menuAccess` rule inside the `Menu` JSON column of `APP.Resources`. Rules support single-resource permission checks and cross-resource AND/OR logic.

### 5.2 Architecture

**Backend (GAS):**
- `GAS/syncAppResources.gs` — Defines `menuAccess` inside each entry of the `Menu` JSON array for every resource, so multiple sidebar menu rows can share one resource entry.
- `GAS/resourceRegistry.gs` — Parses the `Menu` array, normalizes each entry, and exposes it in the auth payload as `entry.ui.menus` so the frontend can evaluate visibility per menu item.

**Frontend:**
- `FRONTENT/src/composables/useMenuAccess.js` — Reusable composable that accepts `resource` plus an optional `menuItem` (the matched entry from `ui.menus`) to evaluate permission rules, defaulting to `canRead` when no rule exists.
- `FRONTENT/src/layouts/MainLayout/MainLayout.vue` — Iterates over every `menu` entry in `resource.ui.menus`, calling `evaluateMenuAccess(resource, menu)` and rendering one sidebar row per visible entry.
- `FRONTENT/src/router/index.js` — Matches `to.path` against all `ui.menus` entries and passes the matched entry to `evaluateMenuAccessInline()` before allowing navigation.

### 5.3 `menuAccess` Rule Formats

All rules evaluate against the current logged-in user's permissions (from auth store). If `menuAccess` is absent, the fallback is `canRead` on the resource itself.

**Format 1: No rule (absent)**
```json
// No menuAccess field → fallback to canRead
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
- **Operation resources**: `OutletVisits`, `OutletRestocks`, `OutletRestockItems`, `OutletDeliveries`, `OutletConsumption`, `OutletConsumptionItems`, `OutletMovements`, and `OutletStorages`.
- **Source of truth**: `OutletMovements` is the stock ledger. `OutletStorages` is the derived current outlet balance keyed by `OutletCode + SKU`.
- **Delivery truth**: `OutletDeliveries.ItemsJSON` stores lowercase scheduled/delivered rows and is aggregated against `OutletRestockItems.Quantity` to derive restock fulfillment.

### 11.2 Visit Workflow
1. Field users create planned visits with only `OutletCode`, `Date`, `Status = PLANNED`, and optional `StatusComment`.
2. A planned visit can be completed, postponed, or cancelled only from `PLANNED`.
3. Completion updates the same row to `Status = COMPLETED` and stores any completion note in `StatusComment`.
4. Cancellation requires a comment and updates the same row to `Status = CANCELLED` with `StatusComment`.
5. Postponement requires a reason and new date. The flow updates the original visit to `Status = POSTPONED` with `StatusComment`, then creates a new `PLANNED` visit for the same outlet/date without previous/next link columns.

### 11.3 Restock Workflow
1. Sales executives create restock drafts in `DRAFT` or revise the same document in `REVISION_REQUIRED`.
2. Draft saves use `OutletRestocks` + `OutletRestockItems` composite save. Request quantities use `Quantity`, must be positive, and SKUs must not duplicate inside the same restock.
3. Submitting a new request first saves the draft, reads the generated restock code from the composite response, and then executes the configured `Submit` action to set `Progress = PENDING_APPROVAL`. Resubmitting from `REVISION_REQUIRED` requires a creator comment.
4. Approvers can approve, reject, or send back pending requests. Approval stamps `ApprovedUser` with the readable approver name and stores each line's warehouse storage allocation in `OutletRestockItems.StorageAllocationJSON`.
5. `StorageAllocationJSON` is approver-owned and must total the requested `Quantity` for each SKU before approval. Approved item rows are read-only. Send-back uses the same parent/child rows for revision rather than creating a replacement restock; the creator can edit/update/add/deactivate child rows only in `REVISION_REQUIRED`.

### 11.4 Delivery Workflow
1. Deliveries can be created only for restocks with `Progress = APPROVED` or `PARTIALLY_DELIVERED`.
2. The UI schedules from approved `StorageAllocationJSON` storage rows into `OutletDeliveries.ItemsJSON` and prevents another active scheduled OD for the same ORS.
3. Delivery action posts positive `OutletMovements` with `ReferenceType = RestockDelivery` and updates `OutletRestocks.Progress`.
4. Progress moves to `PARTIALLY_DELIVERED` when cumulative delivered quantity is below requested quantity and to `DELIVERED` when cumulative delivered quantity reaches the requested total.
5. Delivery matching uses restock items for requested `Quantity`; no delivery child item sheet exists and delivery does not update `OutletRestockItems`.

### 11.5 Consumption Workflow
1. Consumption can be recorded for an outlet with `Progress = CONFIRMED` independently of visits.
2. The UI validates consumed quantities against current `OutletStorages` for the same outlet/storage/SKU.
3. Save creates `OutletConsumption` + `OutletConsumptionItems`, then creates negative `OutletMovements` with `ReferenceType = Consumption`.
4. Outlet stock balance changes only through the outlet movement post-write hook.

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
