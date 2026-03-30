# AQL — Module Workflows

This document captures the **end-to-end workflow knowledge** for each major feature/module in the AQL system. It documents the complete data flow, responsible files, configuration surfaces, and known behaviors so that any AI agent (Claude, Codex, Gemini, etc.) can work on these features without re-discovering the architecture from scratch.

> **Maintenance Rule:** When a module workflow is added, modified, or a new module is built, update this file before closing the task. This is a living document — keep it accurate.

---

## Table of Contents

1. [Report Generation (PDF)](#1-report-generation-pdf)
2. [Master List Page — Section-Level Component Architecture](#2-master-list-page--section-level-component-architecture)

<!-- Future modules — add sections as they are built:
3. [Data Backup & Restore](#3-data-backup--restore)
4. [Bulk Upload](#4-bulk-upload)
5. [Dashboard Widgets](#5-dashboard-widgets)
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
│  _common/ListPage.vue                                               │
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
| `FRONTENT/src/pages/Masters/_common/ListPage.vue` | Integrates `useReports(currentResource)` with the master page |
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

## 2. Master List Page — Section-Level Component Architecture

### 2.1 Overview

The master/operation/accounts list page uses a **section-level component architecture** where each visual section of the page is an independently replaceable component. The system automatically discovers custom per-resource overrides and falls back to default components when no custom version exists.

This means you can customize just the **header** of the Products page without duplicating the entire list page — the search toolbar, record list, and report bar all continue using their defaults.

### 2.2 Architecture Diagram

```
Route: /:scope(masters|operations|accounts)/:resourceSlug
         │
         ▼
ActionResolverPage.vue  ← Page-level discovery (unchanged)
  Resolves: ./Products/ListPage.vue  OR  ./_common/ListPage.vue
         │
         ▼
_common/ListPage.vue  ← Thin orchestrator (default for all resources)
  Uses: useListSectionResolver(resourceSlug)
         │
         ├── Section 1: Header
         │     Custom:  pages/Masters/Products/ListHeader.vue
         │     Default: components/Masters/MasterListHeader.vue
         │
         ├── Section 2: ReportBar
         │     Custom:  pages/Masters/Products/ListReportBar.vue
         │     Default: components/Masters/MasterListReportBar.vue
         │
         ├── Section 3: Toolbar
         │     Custom:  pages/Masters/Products/ListToolbar.vue
         │     Default: components/Masters/MasterListToolbar.vue
         │
         ├── Section 4: Records
         │     Custom:  pages/Masters/Products/ListRecords.vue
         │     Default: components/Masters/MasterListRecords.vue
         │
         ├── FAB (Add button) ← always in ListPage, not a section
         └── ReportInputDialog ← always in ListPage, not a section
```

### 2.3 Two-Level Discovery: How It Works

There are **two independent discovery layers**:

1. **Page-level discovery** (`ActionResolverPage.vue`): Resolves the entire page component.
   - Custom: `pages/Masters/{EntityName}/ListPage.vue` → replaces the whole list page.
   - Fallback: `pages/Masters/_common/ListPage.vue`.

2. **Section-level discovery** (`useListSectionResolver.js`): Resolves individual sections within `_common/ListPage.vue`.
   - Custom: `pages/Masters/{EntityName}/List{Section}.vue` → replaces one section.
   - Fallback: `components/Masters/MasterList{Section}.vue`.

**Priority**: If a full custom `ListPage.vue` exists for an entity, page-level discovery picks it up and section-level discovery is never reached (because `_common/ListPage.vue` is never rendered).

**Typical usage**: Use section-level overrides. Only create a full custom `ListPage.vue` if you need to change the orchestrator layout itself (rare).

### 2.4 Files Involved

| File | Role |
|---|---|
| `FRONTENT/src/composables/useListSectionResolver.js` | Section resolver composable — glob-based discovery + fallback |
| `FRONTENT/src/pages/Masters/ActionResolverPage.vue` | Page-level resolver (existing, unchanged) |
| `FRONTENT/src/pages/Masters/_common/ListPage.vue` | Orchestrator — layout, composable wiring, FAB, dialog |
| `FRONTENT/src/components/Masters/MasterListHeader.vue` | Default header: title, description, visible/total counts, refresh |
| `FRONTENT/src/components/Masters/MasterListReportBar.vue` | Default report bar: toolbar-level report buttons (hidden if none) |
| `FRONTENT/src/components/Masters/MasterListToolbar.vue` | Default toolbar: search input |
| `FRONTENT/src/components/Masters/MasterListRecords.vue` | Default records: card grid with child count badges |
| `FRONTENT/src/components/Masters/MasterRecordCard.vue` | Individual record card (used by MasterListRecords) |

### 2.5 Section Props Contract

Each section receives a specific set of props from `ListPage.vue`. Custom components **must accept the same prop names** (they may ignore props they don't need).

| Section | Props | Events |
|---------|-------|--------|
| **Header** | `config: Object`, `filteredCount: Number`, `totalCount: Number`, `loading: Boolean`, `backgroundSyncing: Boolean` | `reload` |
| **ReportBar** | `reports: Array`, `isGenerating: Boolean` | `generate-report(report)` |
| **Toolbar** | `searchTerm: String` | `update:searchTerm(value)` |
| **Records** | `items: Array`, `loading: Boolean`, `resolvedFields: Array`, `childCountMap: Object` | `navigate-to-view(row)` |

### 2.6 How to Create a Custom Section Override

**Step-by-step example**: Custom header for Products showing Active/Inactive counts.

#### Step 1: Determine the directory name

Convert the resource slug to PascalCase:

| Resource Slug | PascalCase Directory |
|---------------|---------------------|
| `products` | `Products` |
| `warehouse-storages` | `WarehouseStorages` |
| `purchase-orders` | `PurchaseOrders` |
| `chart-of-accounts` | `ChartOfAccounts` |

#### Step 2: Create the file

Create the file at:
```
FRONTENT/src/pages/Masters/{EntityName}/List{Section}.vue
```

For Products custom header:
```
FRONTENT/src/pages/Masters/Products/ListHeader.vue
```

Valid section file names:
- `ListHeader.vue`
- `ListReportBar.vue`
- `ListToolbar.vue`
- `ListRecords.vue`

#### Step 3: Implement the component

The custom component receives the same props as the default. Use what you need:

```vue
<template>
  <q-card flat bordered class="header-card">
    <q-card-section class="q-pa-sm">
      <div class="header-title">{{ config?.ui?.pageTitle || config?.name }}</div>
      <div class="row q-col-gutter-sm q-mt-sm">
        <div class="col-4">
          <div class="mini-stat">
            <div class="mini-label">Active</div>
            <div class="mini-value">{{ activeCount }}</div>
          </div>
        </div>
        <div class="col-4">
          <div class="mini-stat">
            <div class="mini-label">Inactive</div>
            <div class="mini-value">{{ totalCount - activeCount }}</div>
          </div>
        </div>
        <div class="col-4">
          <div class="mini-stat">
            <div class="mini-label">Total</div>
            <div class="mini-value">{{ totalCount }}</div>
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  config: { type: Object, default: null },
  filteredCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  backgroundSyncing: { type: Boolean, default: false }
})

defineEmits(['reload'])

const activeCount = computed(() => props.filteredCount)
</script>
```

#### Step 4: That's it — no registration needed

The `useListSectionResolver` composable uses `import.meta.glob` to auto-discover files matching `pages/Masters/*/List*.vue`. The new file is picked up automatically on next dev server restart (or HMR in most cases).

**No changes needed in**: router, ListPage.vue, any config file, or any registry.

### 2.7 Glob Pattern Details

The resolver composable (`useListSectionResolver.js`) uses this glob:

```js
const customSectionModules = import.meta.glob('../pages/Masters/*/List*.vue')
```

This matches:
- `../pages/Masters/Products/ListHeader.vue` — YES
- `../pages/Masters/WarehouseStorages/ListRecords.vue` — YES
- `../pages/Masters/_common/ListPage.vue` — NO (starts with `_`)
- `../pages/Masters/Products/ViewPage.vue` — NO (doesn't start with `List`)
- `../pages/Masters/Products/helpers.js` — NO (not `.vue`)

The glob is **lazy** (not eager) — custom components are only loaded when their resource is navigated to.

### 2.8 Resolution Flow (Runtime)

```
User navigates to /masters/products
  │
  ▼
ActionResolverPage watches route change
  → slug = "products", action = "list"
  → Checks: ./Products/ListPage.vue exists? NO
  → Loads: ./_common/ListPage.vue
  │
  ▼
_common/ListPage.vue mounts
  → useListSectionResolver(resourceSlug) called with "products"
  → toPascalCase("products") = "Products"
  │
  ├── resolveSection("Products", "Header", MasterListHeader)
  │     → Check glob: ../pages/Masters/Products/ListHeader.vue ?
  │     → Found? → async import → use custom
  │     → Not found? → use MasterListHeader (default)
  │
  ├── resolveSection("Products", "ReportBar", MasterListReportBar)
  │     → same pattern...
  │
  ├── resolveSection("Products", "Toolbar", MasterListToolbar)
  │     → same pattern...
  │
  └── resolveSection("Products", "Records", MasterListRecords)
        → same pattern...
  │
  ▼
sectionsReady = true → template renders all 4 <component :is="...">
```

### 2.9 Known Behaviors & Rules

1. **Mix and match**: You can override just one section (e.g., only `ListHeader.vue`) while all other sections use defaults. Each section resolves independently.
2. **Full page override takes priority**: If `pages/Masters/Products/ListPage.vue` exists, `ActionResolverPage.vue` loads it directly and section-level discovery is bypassed entirely.
3. **Props must match**: Custom components receive the same props as the default. Unrecognized props are silently ignored by Vue, so you can accept only the ones you need.
4. **Events must match**: If a section emits events (e.g., `reload`, `navigate-to-view`), the custom component must emit the same event names for the orchestrator to function correctly.
5. **Dev server restart**: After creating a new custom file, Vite may need a dev server restart to pick up new glob matches (the `import.meta.glob` result is determined at build/startup time).
6. **PascalCase is strict**: The directory name must exactly match the PascalCase conversion of the slug. `products` → `Products`, `warehouse-storages` → `WarehouseStorages`. Mismatch = custom file ignored.
7. **Registries**: Custom section overrides in `pages/Masters/{Entity}/` are page-specific, NOT reusable components. Do **not** add them to `components/REGISTRY.md`. Only default components in `components/Masters/` are registered.

---

<!--
## 3. Data Backup & Restore
(To be documented when implemented)

## 4. Bulk Upload
(To be documented when implemented)

## 5. Dashboard Widgets
(To be documented when implemented)
-->

