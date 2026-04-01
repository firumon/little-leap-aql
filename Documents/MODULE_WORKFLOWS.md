# AQL — Module Workflows

This document captures the **end-to-end workflow knowledge** for each major feature/module in the AQL system. It documents the complete data flow, responsible files, configuration surfaces, and known behaviors so that any AI agent (Claude, Codex, Gemini, etc.) can work on these features without re-discovering the architecture from scratch.

> **Maintenance Rule:** When a module workflow is added, modified, or a new module is built, update this file before closing the task. This is a living document — keep it accurate.

---

## Table of Contents

1. [Report Generation (PDF)](#1-report-generation-pdf)
2. [Master Pages - 3-Tier Section-Level Component Architecture](#2-master-pages--3-tier-section-level-component-architecture)
3. [Products Variant Management (Custom Pages)](#3-products-variant-management-custom-pages)

<!-- Future modules -- add sections as they are built:
4. [Data Backup & Restore](#4-data-backup--restore)
5. [Bulk Upload](#5-bulk-upload)
6. [Dashboard Widgets](#6-dashboard-widgets)
-->

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
Tier 2: CacheService ('AQL_RESOURCE_CONFIG_MAP_V1') ← 5-min TTL
Tier 3: APP.Metadata sheet (permanent fallback)     ← survives cold starts
```

**Cache invalidation** (via `clearResourceConfigCache()`):
- Clears all 3 tiers (in-memory, CacheService, and Metadata row)
- Called by: `handleAddResource()`, `handleEditResource()`, `app_saveResourceReports()`
- The next `getResourceConfig()` call rebuilds from the `APP.Resources` sheet and re-populates all 3 tiers

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

All master/operation/accounts pages (Index, View, Add, Edit, Action) use a **3-tier section-level component architecture** where each visual section is an independently replaceable component. The system supports **per-tenant customization** driven by `APP.Resources.CustomUIName`, with automatic fallback through three resolution tiers.

This means you can customize just the **header** of the Products page for a specific tenant without duplicating the entire page — all other sections continue using their defaults.

### 2.2 Architecture Diagram

```
Route: /:scope(masters|operations|accounts)/:resourceSlug/:code?/:action?
         │
         ▼
ActionResolverPage.vue  ← Page-level 3-tier resolution
  Tier 1: ./_custom/{CustomUIName}/{Entity}.vue (or {Entity}{Action}.vue)
  Tier 2: ./{Entity}/IndexPage.vue (or {Action}Page.vue)
  Tier 3: ./_common/IndexPage.vue (or {Action}Page.vue)
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
| ListRecords | `MasterListRecords.vue` | `items, loading, resolvedFields, childCountMap` | `navigate-to-view(row)` |

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
| `FRONTENT/src/composables/useSectionResolver.js` | Generic 3-tier section resolver composable |
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

---

## 3. Products Variant Management (Custom Pages)

### 3.1 Overview

Products now use entity-custom pages under `FRONTENT/src/pages/Masters/Products/` for variant-aware UX across index, view, add, and edit actions.

- Parent resource: `Products`
- Child resource: `SKUs` (joined by `SKUs.ProductCode = Products.Code`)
- Variant schema source: `Products.VariantTypes` (CSV)
- Variant mapping: CSV position maps to `SKUs.Variant1` to `SKUs.Variant5`

### 3.2 Files Involved

| File | Role |
|---|---|
| `FRONTENT/src/composables/useProductVariants.js` | Shared helper for parsing `VariantTypes`, building dynamic columns, SKU variant validation, and duplicate variant-set detection |
| `FRONTENT/src/pages/Masters/Products/IndexPage.vue` | Custom list page with combined search (product fields + SKU variant values) and SKU counts |
| `FRONTENT/src/pages/Masters/Products/ViewPage.vue` | Custom detail page with dynamic SKU table columns labeled from `VariantTypes` |
| `FRONTENT/src/pages/Masters/Products/AddPage.vue` | Composite create page for Product + SKU rows with dynamic variant inputs |
| `FRONTENT/src/pages/Masters/Products/EditPage.vue` | Composite edit page with variant type impact handling and SKU row lifecycle controls |

### 3.3 Runtime Flow

1. Route resolver picks `Products/IndexPage.vue`, `ViewPage.vue`, `AddPage.vue`, `EditPage.vue` via entity-custom page tier.
2. Pages load Products with `useResourceData(resourceName)`.
3. SKU data is loaded through `fetchMasterRecords('SKUs')` and filtered by `ProductCode`.
4. `useProductVariants` converts `VariantTypes` CSV into dynamic variant columns.
5. Add/Edit pages manage Product + SKUs through `useCompositeForm(config)` and save atomically using `compositeSave`.

### 3.4 Validation and Behavior Rules

1. Variant dimension count is capped at 5.
2. Variant labels are user-defined and displayed as dynamic column headers.
3. SKU rows must fill all active variant columns before save.
4. Duplicate active SKU variant-value sets are blocked before save.
5. SKU delete in Edit follows existing composite pattern (`_action = deactivate`, `Status = Inactive`), not hard delete.
6. Edit page variant removal prompts for confirmation and remaps SKU variant columns in-memory before save.

<!--
## 4. Data Backup & Restore
(To be documented when implemented)

## 5. Bulk Upload
(To be documented when implemented)

## 6. Dashboard Widgets
(To be documented when implemented)
-->


