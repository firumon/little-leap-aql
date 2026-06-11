# AQL Report Formula Generation Prompt

Use this document to initialize an AI agent session when building, refactoring, or extending Google Sheets reporting formulas for the AQL system.

---

## 1. System Overview & Context

AQL utilizes a hybrid architecture where the web frontend displays data and triggers actions, but the underlying database and reporting templates live in Google Sheets. Reports are generated dynamically by cloning a pre-designed spreadsheet template, injecting context or inputs into target cells, and exporting the results.

For the full technical details of the AQL PDF export engine, template registry, and backend/frontend coordination, refer to the [AQL Module Workflows Guide](file:///f:/LITTLE%20LEAP/AQL/Documents/MODULE_WORKFLOWS.md#1-report-generation-pdf).

### The Primary Objective
Your main aim as the AI agent is to **construct a single-cell Google Sheets formula** placed in the designated start cell (typically `A10` or `A15`) that dynamically generates the entire structured dataset (including headers, metrics, listings, and spacer rows) based on the user's requirements and input cells.

*Note: If requirements are unclear or layout coordinates are ambiguous, you are encouraged to ask clarifying questions in the chat to align on a perfect design.*

---

## 2. Sheet Layout & Grid Sizing Constraints

To maintain visual alignment across pdf exports, every reporting sheet follows strict design bounds:
* **Grid Sizing:** Every cell in the report sheet is configured to a width and height of exactly 20 pixels.
* **Row 1 to 8:** Reserved for a pre-designed corporate report header (containing logo, titles, metadata).
* **Borders & Margins:**
  * **Column A (index 1)** and **Column AM (index 39)** are left entirely empty to serve as the outer border.
  * **Columns B and C (indexes 2 and 3)** are left empty to serve as the left margin.
  * **Columns AK and AL (indexes 37 and 38)** are left empty to serve as the right margin.
* **Data Zone:** The actual space available for displaying data is **Columns D through AJ (indexes 4 through 36)**. All generated headers, tables, and details must stay within these bounds.

---

## 3. Coding Patterns & Shape-Safety Rules

To ensure formulas evaluate cleanly without dimension mismatches, `#REF!`, or calculation crashes, strictly enforce the following rules:

### A. Dynamic 39-column Row Generator (`RowFn`)
Define a helper function named `RowFn` using `LAMBDA` at the beginning of the `LET` block. This function maps index-value pairs over a `SEQUENCE(1, 39)` to construct exactly 39 columns per row. This is the only way rows should be generated:
```excel
RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
```
*Example usage:*
* Spacer row: `RowFn({0, ""})`
* Data row: `RowFn({4, "Outlet Name"; 20, "Address"; 36, "Comments"})`

### B. Shape-Safe Virtual Arrays
* **No `INDEX(array, 0, col)`:** When extracting column vectors from in-memory arrays (like those returned by `FILTER` or `MAP`), never use `INDEX` with a `0` or blank row parameter. Always use `CHOOSECOLS(array, col)` instead.
* **No `INDEX(array, 1, 0)`:** When extracting rows from virtual arrays, always use `CHOOSEROWS(array, row)`.
* **Flatten vectors:** Always wrap extracted columns in `TOCOL()` (e.g. `TOCOL(CHOOSECOLS(array, 1))`) before passing them to matching functions like `MAP` to prevent size-mismatch errors.
* **Avoid Cell Reference Name Collisions:** Do not name variables inside `LET` blocks using words that can resolve to cell coordinates (e.g., `Row1`, `Row2`, `R1`, `C1`). Instead, use names with underscores (e.g., `Row_1`, `Row_2`) which are invalid cell references.

### C. No `SUMIF` / `SUMIFS` / `COUNTIF` / `COUNTIFS` on Memory Arrays
These functions only accept physical cell ranges (like `A2:A`) and will crash on in-memory/virtual arrays. 
* To sum or count virtual arrays based on criteria, always use a combination of `SUM` and `FILTER` wrapped in `IFERROR`:
  * Summing: `SUM(IFERROR(FILTER(qtys, (codes = target_code)), 0))`
  * Counting: `SUM(IFERROR(FILTER(OnesVector, (codes = target_code)), 0))`

### D. Dynamic Config Sheet Lookups
Retrieve external spreadsheet IDs dynamically from a local sheet named `Config` (columns Key, Value):
`VLOOKUP("TargetFileID", Config!A:B, 2, 0)`

---

## 4. Hierarchical Data Assembly Pattern

To stack headers, section dividers, and list records, assemble the report dynamically using `VSTACK` and loops (`REDUCE` or `MAP`). Here is the standard structural framework to follow:

```excel
=LET(
  MasterFileID, VLOOKUP("MasterFileID", Config!A:B, 2, 0),
  DataFileID, VLOOKUP("DataFileID", Config!A:B, 2, 0),

  RawData, IMPORTRANGE(DataFileID, "SheetName!A2:J"),
  Filtered, IFERROR(FILTER(RawData, ...), {"", "", "", ..., 0}),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),

  // [Process and group data here...]

  ReportData,
  VSTACK(
    RowFn({4, "Section Header"}),
    RowFn({4, "Field 1"; 20, "Field 2"; 36, "Field 3"}),
    RowFn({0, ""}), // Spacer
    
    // [Dynamically generated rows or fallback rows...]
  ),

  ReportData
)
```

Please let me know once you are ready..