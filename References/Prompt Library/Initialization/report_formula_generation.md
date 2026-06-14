# AQL Report Formula Generation & Maintenance

> **Scope boundary**: This document covers Google Sheets report formulas and template configuration only — printable headers, LAMBDA row functions, virtual array calculations. Its references to frontend composables and backend GAS files are read-only — read them by path. Do NOT load frontend_modification.md or backend_gas_implementation.md unless the task explicitly requires modifying that code.

Use this document to initialize an AI agent session when building, refactoring, or extending Google Sheets reporting formulas, template configurations, or report action bindings in the AQL system.

---

## 1. System Architecture & Coordination

AQL utilizes a hybrid architecture where the web frontend displays data and triggers actions, while Google Sheets hosts report templates, runs formulas, and exports PDF files.

### A. The End-to-End Workflow
1. **Frontend Trigger**: A user clicks a report action in Quasar (e.g., in a toolbar or record detail dialog). The Quasar page calls a composable that dispatches the `generateReport` action to the backend.
2. **Metadata Registry**: Report definitions are configured in `APP.Resources` in the `Reports` JSON column. The registry records the report name, destination sheet name, template name, parameter injection cell (e.g. `$AB$6`), and PDF settings (margins, orientation).
3. **Apps Script Execution**: The backend (`GAS/reportGenerator.gs`) clones the specified template sheet in the REPORTS spreadsheet, injects parameters (e.g., a specific Order ID) into the target cell, recalculates formulas using `SpreadsheetApp.flush()`, exports the sheet as a PDF blob, deletes the temporary sheet, and returns a Base64 string to the frontend.
4. **Sheet Menu Connection**: Admin actions under the Google Sheet `AQL 🚀` menu (e.g. `Sync APP.Resources from Code`) load the report configs from code to sheet, and `Regenerate App Cache` warms up metadata.

**Key File Locations**:
- Backend Code: [reportGenerator.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/reportGenerator.gs)
- Report Workflows: [MODULE_WORKFLOWS.md — Section 1](file:///f:/LITTLE%20LEAP/AQL/Documents/MODULE_WORKFLOWS.md#L97)
- Sheet Formulas Index: [Sheet Formulas/Reports/INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/INDEX.md)
- Resource Config Guide: [RESOURCE_COLUMNS_GUIDE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/RESOURCE_COLUMNS_GUIDE.md)

---

## 2. Sheet Layout & Grid Sizing Constraints

To maintain a consistent, high-premium printable visual structure, every reporting sheet template must follow these layout rules:
* **Grid Sizing**: Every cell is configured to a width and height of exactly 20 pixels.
* **Row 1 to 8**: Pre-designed corporate header containing logos, document title, and meta information.
* **Marginal Boundaries**:
  * **Outer Border**: Column A (1) and Column AM (39) are left empty.
  * **Left Margin**: Column B (2) and Column C (3) are left empty.
  * **Right Margin**: Column AK (37) and Column AL (38) are left empty.
* **Data Zone**: Data rows (tables, titles, details) must occupy exactly **Columns D through AJ (index 4 to 36)**.

---

## 3. Resolving Scopes, Columns, File IDs, and Views

If the user did not explicitly provide the resource name, scope, or column layout, resolve the target resource details, sheet layouts, and spreadsheet file IDs using this sequence:

### A. Resource and Scope Mapping
If only a report name is provided, map it to its resource constant and scope in [GAS/Constants.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/Constants.gs):
- **Master Scope**: `CONFIG.MASTER_SHEETS` (e.g., `Products`, `SKUs`, `Warehouses`).
- **Operation Scope**: `CONFIG.OPERATION_SHEETS` (e.g., `Procurements`, `PurchaseRequisitions`, `OutletRestocks`).
- **Accounts Scope**: `CONFIG.ACCOUNTS_SHEETS` (e.g., `ChartOfAccounts`, `TaxTransactions`).
- **Core Scope**: `CONFIG.SHEETS` (e.g., `Users`, `Roles`).

### B. Resolving Sheet Columns
Find the sheet columns/headers by reading the corresponding setup file for that scope under [GAS/](file:///f:/LITTLE%20LEAP/AQL/GAS/):
- **Master Scope**: Refer to [setupMasterSheets.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/setupMasterSheets.gs).
- **Operation Scope**: Refer to [setupOperationSheets.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/setupOperationSheets.gs).
- **Accounts Scope**: Refer to [setupAccountSheets.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAccountSheets.gs).
- **Core Scope**: Refer to [setupAppSheets.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs).

Inside the setup file, locate the resource's schema definition (e.g., `headers` array) to see exact field indexes and order.

### C. File ID Lookup via VLOOKUP
Spreadsheets for each scope are mapped in the `Config` sheet (which is imported in the report file using `IMPORTRANGE` as set up in [setupAppSheets.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/setupAppSheets.gs#L313-L335)). Use `VLOOKUP` to fetch their file IDs dynamically:
- `VLOOKUP("MasterFileID", Config!A:B, 2, 0)` -> Master Spreadsheet File ID
- `VLOOKUP("OperationFileID", Config!A:B, 2, 0)` -> Operation Spreadsheet File ID
- `VLOOKUP("ViewsFileID", Config!A:B, 2, 0)` -> Views Spreadsheet File ID
- `VLOOKUP("OutletFileID", Config!A:B, 2, 0)` -> Tenant-specific Outlet Spreadsheet File ID

Pass these resolved IDs into `IMPORTRANGE` calls inside the report's `LET` formula.

### D. Prioritizing Views for Data Aggregation
Before importing raw source sheets and building complex joins, always check if a pre-existing view matches the data requirements.
- **Why**: Views connect, flatten, and denormalize dependent records (e.g., combining SKU, product, and variant fields into a single `SKU` view). Refer to [Sheet Formulas/Views/INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Views/INDEX.md) for existing views (e.g., `SKU`, `Outlet`, `WarehouseStock`, `OutletStock`).
- **Priority**: Always use a view as your primary data source if one is available.

---

## 4. Shape-Safety & Coding Patterns

Google Sheets formula calculations will fail with `#REF!` or dimension mismatches unless these rules are strictly enforced:

### A. Dynamic 39-column Row Generator (`RowFn`)
Define and use a `RowFn` helper via `LAMBDA` at the beginning of the `LET` block to generate exactly 39 columns per row. Do not generate rows in any other way:
```excel
RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
```
- Spacer row: `RowFn({0, ""})`
- Data row: `RowFn({4, "Field 1"; 20, "Field 2"; 36, "Field 3"})`

### B. Virtual Array Manipulation
- **CHOOSECOLS/CHOOSEROWS**: Never use `INDEX(array, 0, col)` or `INDEX(array, row, 0)` on in-memory/virtual arrays (which returns `#REF!`). Always use `CHOOSECOLS(array, col)` or `CHOOSEROWS(array, row)`.
- **TOCOL**: Wrap extracted column vectors in `TOCOL()` (e.g. `TOCOL(CHOOSECOLS(array, 1))`) before passing them to matching functions like `MAP` to prevent size-mismatch errors.
- **Variable Collisions**: Do not name variables inside `LET` blocks using words that can resolve to cell coordinates (e.g., `Row1`, `R1`, `C1`). Use names with underscores (e.g., `Row_1`, `Row_2`).

### C. Aggregating Memory Arrays
`SUMIF`, `SUMIFS`, `COUNTIF`, and `COUNTIFS` only work on physical spreadsheet ranges. They fail on virtual arrays.
- To sum or count virtual arrays, always use `SUM` / `FILTER` wrapped in `IFERROR`:
  - Summing: `SUM(IFERROR(FILTER(qtys, (codes = target_code)), 0))`
  - Counting: `SUM(IFERROR(FILTER(OnesVector, (codes = target_code)), 0))`

### D. External spreadsheet ID Lookups
Retrieve external spreadsheet IDs dynamically from the local `Config` sheet (columns Key, Value):
`VLOOKUP("TargetFileID", Config!A:B, 2, 0)`

---

## 5. Documenting Report Formulas

When creating or modifying any reporting formula, you must document it in a markdown file under `Sheet Formulas/Reports/` using this template:

```markdown
# [Report Name] Report

Short description of the report's purpose and contents.

---

## Cell Destination & Input Details

- **Output Destination Cell**: Cell where formula is written (e.g. `A10`)
- **User Input Dependency**: Injection parameter target (e.g. `$AB$6`)

---

## Google Sheet Formula

```excel
=LET(
  ...
)
```

---

## Source Sheets & Column Dependencies

List all source sheets and column indexes referenced by the formula:
1. **Sheet Name** (FileID from Config):
   - Column 1 (A): [Field Name]
   - Column 2 (B): [Field Name]

---

## Detailed Logic Breakdown

Explain the phases of the formula (Order Search, Timeline, Item Loops, Stacking).
```

Always update the registry index [INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/INDEX.md) to record the new template and its dependencies.

---

## 6. Guardrails (DOs and DO NOTs)

- **DO NOT** use physical column ranges directly (e.g., `IMPORTRANGE(..., "Sheet!A:A")`) inside complex MAP loops; extract columns to variables first.
- **DO** verify target input cell locations (e.g., parameter injection target like `$AB$6`) and start destinations before writing formulas.
- **DO** verify that the final stacked array equals exactly 39 columns wide.

---

## 7. Targeted Verification Plan

### A. Formula Integrity
1. After writing or modifying a formula, use `SpreadsheetApp.flush()` to force recalculation.
2. Verify that the output array is exactly **39 columns wide** — any mismatch will cause `#REF!` errors.
3. Check for `#REF!`, `#VALUE!`, or `#N/A` errors in the output range.

### B. Documentation
1. Verify that the formula documentation file exists in `Sheet Formulas/Reports/`.
2. Verify that [INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/INDEX.md) has been updated with the new or modified report entry.

### C. Code Deployment (If Backend Changes Were Made)
1. Push GAS changes: `npm run gas:push` (or `cd GAS && clasp push`).
2. Instruct the user to run `AQL 🚀 > 🔄 Sync & Cache > Sync APP.Resources from Code` if report config metadata was modified.
