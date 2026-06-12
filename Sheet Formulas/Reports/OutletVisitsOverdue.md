# OutletVisitsOverdue Report

The **OutletVisitsOverdue Report** aggregates all planned visits that have not been completed and are past their scheduled date. It groups them by the number of days they are overdue, showing a summary count and details for each outlet.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: *None*. The report runs dynamically relative to `TODAY()`.

---

## Google Sheet Formula

```excel
=LET(
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),
  MasterFileID, VLOOKUP("masterFileID", Config!A:B, 2, 0),

  RawVisits, IMPORTRANGE(OutletFileID, "OutletVisits!A2:V"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:U"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),

  VisitsCode, TOCOL(CHOOSECOLS(RawVisits, 1)),
  VisitsOutletCode, TOCOL(CHOOSECOLS(RawVisits, 2)),
  VisitsDate, TOCOL(CHOOSECOLS(RawVisits, 3)),
  VisitsProgress, TOCOL(CHOOSECOLS(RawVisits, 4)),
  VisitsComment, TOCOL(CHOOSECOLS(RawVisits, 7)),
  VisitsStatus, TOCOL(CHOOSECOLS(RawVisits, 17)),

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),

  ParsedDates, MAP(VisitsDate, LAMBDA(d, IFERROR(IF(ISNUMBER(d), d, DATEVALUE(LEFT(d, 10))), 0))),

  Filtered, IFERROR(
    FILTER(
      RawVisits,
      (VisitsProgress = "PLANNED") * (VisitsStatus = "Active") * (ParsedDates > 0) * (ParsedDates < TODAY())
    ),
    MAKEARRAY(1, 22, LAMBDA(r, c, ""))
  ),

  FirstCell, CHOOSEROWS(CHOOSECOLS(Filtered, 1), 1),
  HasOverdue, AND(NOT(ISERR(Filtered)), FirstCell <> ""),

  F_OutletCode, IF(HasOverdue, TOCOL(CHOOSECOLS(Filtered, 2)), ""),
  F_Date, IF(HasOverdue, TOCOL(CHOOSECOLS(Filtered, 3)), TODAY()),
  F_Comment, IF(HasOverdue, TOCOL(CHOOSECOLS(Filtered, 7)), ""),

  F_ParsedDate, MAP(F_Date, LAMBDA(d, IFERROR(IF(ISNUMBER(d), d, DATEVALUE(LEFT(d, 10))), TODAY()))),
  F_DaysOverdue, MAP(F_ParsedDate, LAMBDA(pd, TODAY() - pd)),
  F_Data, HSTACK(F_OutletCode, F_DaysOverdue, F_Comment),
  SortedData, SORT(F_Data, 2, FALSE),

  S_OutletCode, TOCOL(CHOOSECOLS(SortedData, 1)),
  S_DaysOverdue, TOCOL(CHOOSECOLS(SortedData, 2)),
  S_Comment, TOCOL(CHOOSECOLS(SortedData, 3)),

  S_OutletName, MAP(S_OutletCode, LAMBDA(c, IF(HasOverdue, IFERROR(XLOOKUP(c, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"), ""))),
  UniqueDays, SORT(UNIQUE(S_DaysOverdue), 1, FALSE),

  DummyRow, RowFn({0, "DUMMY"}),

  DynamicPart, REDUCE(DummyRow, UniqueDays, LAMBDA(acc, d, LET(
    GroupIndices, FILTER(SEQUENCE(ROWS(SortedData)), S_DaysOverdue = d),
    GroupCount, ROWS(GroupIndices),
    SectionHeader, RowFn({4, "Due by " & d & " Day" & IF(d = 1, "", "s") & " - " & GroupCount & " Outlet" & IF(GroupCount = 1, "", "s")}),
    GroupRows, REDUCE(RowFn({0, "DUMMY_INNER"}), SEQUENCE(GroupCount), LAMBDA(inner_acc, k, LET(
      idx, CHOOSEROWS(GroupIndices, k),
      ItemSerial, k,
      ItemName, CHOOSEROWS(S_OutletName, idx),
      ItemComment, CHOOSEROWS(S_Comment, idx),
      VSTACK(
        inner_acc,
        RowFn({5, ItemSerial; 7, ItemName}),
        RowFn({7, ItemComment}),
        RowFn({0, ""})
      )
    ))),
    CleanGroupRows, CHOOSEROWS(GroupRows, SEQUENCE(ROWS(GroupRows) - 1, 1, 2)),
    VSTACK(
      acc,
      SectionHeader,
      RowFn({0, ""}),
      CleanGroupRows
    )
  ))),

  ReportData, IF(
    HasOverdue,
    VSTACK(
      RowFn({4, "Total Overdue Visits - " & ROWS(SortedData)}),
      RowFn({0, ""}),
      CHOOSEROWS(DynamicPart, SEQUENCE(ROWS(DynamicPart) - 1, 1, 2))
    ),
    VSTACK(
      RowFn({4, "Total Overdue Visits - 0"}),
      RowFn({0, ""}),
      RowFn({4, "No overdue visits found."})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

1. **`OutletVisits`** (`OutletVisits!A2:V` in Outlet Spreadsheet):
   - Column 1 (`A`): Visit ID Code
   - Column 2 (`B`): Outlet Code
   - Column 3 (`C`): Visit Date (parsed and compared against `TODAY()`)
   - Column 4 (`D`): Visit Progress status (filters for `"PLANNED"`)
   - Column 7 (`G`): Planned Comment
   - Column 17 (`Q`): Visit Record Status (filters for `"Active"`)
2. **`Outlets`** (`Outlets!A2:U` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code (matches visit records)
   - Column 2 (`B`): Outlet Name (resolved via `XLOOKUP`)

---

## Detailed Logic Breakdown

1. **Past Date Parsing**: Conversions handle raw text dates using `DATEVALUE(LEFT(d, 10))` to ensure string dates are parsed into serial numbers.
2. **Filtering**: Filters `OutletVisits` where progress is `"PLANNED"`, status is `"Active"`, and the date is earlier than `TODAY()`.
3. **Calculation of Days Overdue**: Computes `TODAY() - ScheduledDate` to get a numerical index representing overdue days.
4. **Grouping & Sorting**:
   - `UniqueDays`: Retrieves the unique values of overdue days, sorted in descending order (longest overdue first).
5. **Section Reduction (`REDUCE`)**:
   - Loops through each unique number of overdue days.
   - Computes count of outlets in this bracket.
   - Renders a section header: `"Due by D Days - G Outlets"` (Col 4).
   - Renders child rows for each overdue outlet in that group:
     - Row 1: Serial number (Col 5) and Outlet Name (Col 7).
     - Row 2: Visit Comment (Col 7).
     - Row 3: Blank spacing row.
6. **Summary Header**: Prepends `"Total Overdue Visits - X"` (Col 4) at the top of the output table. Outputs a fallback empty state if no overdue visits are found.
