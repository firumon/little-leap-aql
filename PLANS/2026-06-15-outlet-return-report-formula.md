# PLAN: Create OutletReturn Report Formula

**Status**: COMPLETED
**Created**: 2026-06-15
**Created By**: Brain Agent (Antigravity)
**Executed By**: Build Agent (Antigravity)

## Objective
Create the Google Sheets report formula and template documentation for `OutletReturn` to display the details of an outlet return transaction. The return code is injected into the header (cell `$AB$6`), and the sheet retrieves the return details, returned item details, and financial/warehouse processing statuses.

## Context
As per the user's strict instruction:
* **Formula and Documentation Only**: We will only create the Google Sheets report formula and its documentation under `Sheet Formulas/Reports/OutletReturn.md` and update `Sheet Formulas/Reports/INDEX.md`.
* **No Code Edits**: We will not modify any frontend, backend, or database resource files (e.g. `syncAppResources.gs` or frontend pages).

## Pre-Conditions
- [x] Required source schemas in [setupOperationSheets.gs](file:///f:/LITTLE%20LEAP/AQL/GAS/setupOperationSheets.gs#L268) were reviewed.
- [x] Reference reports like [Restock.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/Restock.md) and [Delivery.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/Delivery.md) were reviewed for shape safety and column indexes.

## Steps

### Step 1: Create Report Documentation File
- [x] Create the documentation file `Sheet Formulas/Reports/OutletReturn.md` containing:
  - Document details and input parameters.
  - The complete in-cell Google Sheets `LET` formula.
  - Source sheets and column index mapping.
  - Detailed logic breakdown of the spreadsheet components.

**Files**: [OutletReturn.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/OutletReturn.md)
**Pattern**: Matches the structure of [Restock.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/Restock.md).
**Rule**: Strictly uses the virtual array row generator (`RowFn`) to produce exactly 39 columns per row.

### Step 2: Update Reports Registry Index
- [x] Add the `OutletReturn` entry to the index table in `Sheet Formulas/Reports/INDEX.md` referencing its cell destination (`A10`), parameter injection cell (`$AB$6`), and source sheet dependencies.

**Files**: [INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/INDEX.md)

---

## Acceptance Criteria
- [x] The new document [OutletReturn.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/OutletReturn.md) is created and contains the complete formula.
- [x] The stacked array within the formula is guaranteed to be exactly 39 columns wide for all output rows.
- [x] [INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/INDEX.md) table includes the `OutletReturn` report.
- [x] No frontend, backend, or other source code files are modified.

---

## Execution Self-Check Protocol

The Build Agent MUST update this checklist after completing each numbered sub-task. Mark `[x]` immediately after the task is done.

### Progress Log
- [x] Step 1 completed (Create OutletReturn.md)
- [x] Step 2 completed (Update INDEX.md)

### Files Actually Changed
- `Sheet Formulas/Reports/OutletReturn.md`
- `Sheet Formulas/Reports/INDEX.md`

### Validation Performed
- [x] Verify that `OutletReturn.md` layout is exactly 39 columns wide.
- [x] Verify index mapping against `setupOperationSheets.gs` columns.
