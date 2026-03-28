# AQL — Module Workflows

This document captures the **end-to-end workflow knowledge** for each major feature/module in the AQL system. It documents the complete data flow, responsible files, configuration surfaces, and known behaviors so that any AI agent (Claude, Codex, Gemini, etc.) can work on these features without re-discovering the architecture from scratch.

> **Maintenance Rule:** When a module workflow is added, modified, or a new module is built, update this file before closing the task. This is a living document — keep it accurate.

---

## Table of Contents

1. [Report Generation (PDF)](#1-report-generation-pdf)

<!-- Future modules — add sections as they are built:
2. [Data Backup & Restore](#2-data-backup--restore)
3. [Bulk Upload](#3-bulk-upload)
4. [Dashboard Widgets](#4-dashboard-widgets)
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
│  MasterEntityPage.vue                                               │
│    ├── MasterToolbar.vue ──── toolbar-level report buttons          │
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
| `FRONTENT/src/pages/Masters/MasterEntityPage.vue` | Integrates `useReports(currentResource)` with the master page |
| `FRONTENT/src/components/Masters/MasterToolbar.vue` | Renders toolbar-level report buttons |
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

<!--
## 2. Data Backup & Restore
(To be documented when implemented)

## 3. Bulk Upload
(To be documented when implemented)

## 4. Dashboard Widgets
(To be documented when implemented)
-->
