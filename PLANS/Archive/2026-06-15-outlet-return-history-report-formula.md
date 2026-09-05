# PLAN: Create OutletReturnHistory Report Formula

**Status**: COMPLETED
**Created**: 2026-06-15
**Created By**: Brain Agent (Antigravity)
**Executed By**: Build Agent (Antigravity)

## Objective
Create the Google Sheets report formula and template documentation for `OutletReturnHistory` to display the 12 most recent return records for a specific outlet. The selected outlet code is injected into the header (cell `$AB$6`), and the sheet retrieves return details, item details, financial adjustments, and warehouse action logs in a printable, 39-column layout.

## Context
As per the user's strict instruction:
* **Formula and Documentation Only**: We will only create the Google Sheets report formula and its documentation under `Sheet Formulas/Reports/OutletReturnHistory.md` and update `Sheet Formulas/Reports/INDEX.md`.
* **No Code Edits**: We will not modify any frontend, backend, or database resource files.
* **Column Intent Formatting**: The layout will place starting columns in Column D (index 4) for headings, subheadings, and data to align with cell-fill and formatting anchor rules.

## Pre-Conditions
- [x] Renamed the previous report file to `Return.md` and updated `INDEX.md`.
- [x] Updated `References/Prompt Library/Initialization/report_formula_generation.md` with the new formatting rules.

## Steps

### Step 1: Create Report Documentation File
- [x] Create the documentation file `Sheet Formulas/Reports/OutletReturnHistory.md` containing:
  - Document details and input parameters.
  - The complete in-cell Google Sheets `LET` formula.
  - Source sheets and column index mapping.
  - Detailed logic breakdown of the spreadsheet components.

**Files**: [OutletReturnHistory.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/OutletReturnHistory.md)
**Pattern**: Matches the structure of [OutletRestockHistory.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/OutletRestockHistory.md).
**Rule**: Strictly uses the virtual array row generator (`RowFn`) to produce exactly 39 columns per row. Places anchors starting in Column D (index 4).

### Step 2: Update Reports Registry Index
- [x] Add the `OutletReturnHistory` entry to the index table in `Sheet Formulas/Reports/INDEX.md` referencing its cell destination (`A10`), parameter injection cell (`$AB$6`), and source sheet dependencies.

**Files**: [INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/INDEX.md)

---

## Acceptance Criteria
- [x] The new document [OutletReturnHistory.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/OutletReturnHistory.md) is created and contains the complete formula.
- [x] The stacked array within the formula is guaranteed to be exactly 39 columns wide for all output rows.
- [x] [INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/INDEX.md) table includes the `OutletReturnHistory` report.
- [x] Header fields (Outlet Name, Warehouse Name, Date of Gen) are correctly stacked on row 10.
- [x] Table records begin on row 12 onwards.
- [x] No frontend, backend, or other source code files are modified.

---

## Execution Self-Check Protocol

The Build Agent MUST update this checklist after completing each numbered sub-task. Mark `[x]` immediately after the task is done.

### Progress Log
- [x] Step 1 completed (Create OutletReturnHistory.md)
- [x] Step 2 completed (Update INDEX.md)

### Files Actually Changed
- `Sheet Formulas/Reports/OutletReturnHistory.md`
- `Sheet Formulas/Reports/INDEX.md`

### Validation Performed
- [x] Verify that `OutletReturnHistory.md` layout is exactly 39 columns wide.
- [x] Verify index mapping against `setupOperationSheets.gs` columns.
