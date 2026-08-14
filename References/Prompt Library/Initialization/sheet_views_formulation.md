# AQL Sheet Views Formulation

> **Scope boundary**: This document covers Google Sheets View formulas only — denormalized data views, IMPORTRANGE, VLOOKUP, Config sheet patterns. Its pre-reads reference sheet structure docs — read them by path. Do NOT load other init prompts.

Use this document to initialize an AI agent session when the task involves creating, modifying, debugging, or documenting Google Sheets View formulas in the AQL system.

---

## 1. System Architecture & Coordination

AQL **Views** are specialized Google Sheets that consolidate, flatten, and denormalize data from multiple source sheets into a single unified table. They make complex multi-sheet data easily consumable by reports, frontend displays, and other processes.

### A. How Views Work
1. Each View sheet lives in a dedicated Google Spreadsheet.
2. The spreadsheet contains a `Config` sheet with key-value pairs (e.g., `MasterFileID`, `OperationFileID`) used to locate source spreadsheets.
3. View formulas use `IMPORTRANGE(VLOOKUP("FileID", Config!A:B, 2, 0), "SheetName!Range")` to pull data from external source spreadsheets.
4. Data is denormalized using `VLOOKUP`, `INDEX/MATCH`, `FILTER`, and `QUERY` functions.
5. The frontend reads View sheets as read-only data sources (no CRUD operations).

### B. Core File Coordinates
* **Views Index**: [Sheet Formulas/Views/INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Views/INDEX.md) — catalog of all view sheets and their dependencies
* **Reports Index**: [Sheet Formulas/Reports/INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Reports/INDEX.md) — catalog of all report templates
* **View Documentation Files**: Individual `.md` files under `Sheet Formulas/Views/` (e.g., [SKU.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Views/SKU.md), [WarehouseStock.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Views/WarehouseStock.md))

---

## 2. Mandatory Pre-Reads

Before writing or modifying any View formula:
* Views catalog: [Sheet Formulas/Views/INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Views/INDEX.md)
* The specific View's existing documentation under `Sheet Formulas/Views/`
* Source sheet structure docs: relevant file under `Documents/` (e.g., [SHEET_MASTER_STRUCTURE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/SHEET_MASTER_STRUCTURE.md), [SHEET_OPERATION_STRUCTURE.md](file:///f:/LITTLE%20LEAP/AQL/Documents/SHEET_OPERATION_STRUCTURE.md))

---

## 3. The Config Sheet Pattern

Every View spreadsheet contains a `Config` sheet:
- Stores key-value pairs: `MasterFileID`, `OperationFileID`, `OutletFileID`, `ViewFileID`, etc.
- Formulas reference it via: `VLOOKUP("MasterFileID", Config!A1:B, 2, 0)`
- **Never hardcode spreadsheet IDs** in formulas. Always retrieve them from Config.

---

## 4. Step-by-Step Implementation Checklist

### Creating or Modifying a View Formula
1. **Read source sheet structure**: Identify exact column positions (1-indexed) in the source sheets. Views use index-based VLOOKUPs, so column order matters.
2. **Map column dependencies**: Document which source sheet columns are referenced and their exact positions.
3. **Use Config for file IDs**: All `IMPORTRANGE` calls must use `VLOOKUP("FileID", Config!A:B, 2, 0)` — never hardcoded IDs.
4. **Test incrementally**: Build complex formulas in stages, verifying each `IMPORTRANGE` and `VLOOKUP` independently before combining.
5. **Handle edge cases**: Use `IFERROR` to gracefully handle missing data, empty ranges, or `#N/A` lookups.

### Documenting View Formulas
For each View, create or update a `.md` file under `Sheet Formulas/Views/` with:
1. **View purpose and description**
2. **Output schema** — list of output columns with descriptions
3. **Source sheets and column dependencies** — exact sheet names and column indexes referenced
4. **The raw Google Sheets formula**
5. **Detailed logic breakdown** — step-by-step explanation of what the formula does

Always update [INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Views/INDEX.md) when adding or modifying views.

---

## 5. Explicit Guardrails (DOs and DO NOTs)

- **DO NOT** hardcode spreadsheet file IDs in formulas. Always use the Config sheet VLOOKUP pattern.
- **DO NOT** use column letters in documentation. Use 1-indexed column numbers since Views reference by index.
- **DO NOT** modify source sheet column order without updating all dependent View formulas. Index-based VLOOKUPs will silently return wrong data.
- **DO** verify column indexes against the actual source sheet structure before writing formulas.
- **DO** use `IFERROR` wrappers for VLOOKUP and IMPORTRANGE calls.
- **DO** document every column dependency with its exact source sheet and column index.

> [!IMPORTANT]
> **Schema Change Warning**: Reordering, inserting, or removing columns in source sheets (Products, SKUs, UOMs, Outlets, etc.) will break View formulas. Always scan `Sheet Formulas/Views/` and `Sheet Formulas/Reports/` for dependent formulas before altering source schemas.

---

## 6. Targeted Verification Plan

1. **Formula Check**: Open the View sheet in Google Sheets and verify no `#REF!`, `#N/A`, or `#VALUE!` errors.
2. **Data Accuracy**: Spot-check 3-5 rows against the raw source sheets to verify correct denormalization.
3. **Documentation Sync**: Verify the `.md` file matches the live formula and [INDEX.md](file:///f:/LITTLE%20LEAP/AQL/Sheet%20Formulas/Views/INDEX.md) is updated.
4. **Downstream Impact**: If an existing View was modified, check if any Reports reference it (search `Sheet Formulas/Reports/`).
