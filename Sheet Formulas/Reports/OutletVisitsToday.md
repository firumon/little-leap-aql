# OutletVisitsToday Report

The **OutletVisitsToday Report** compiles a listing of planned outlet visits scheduled for today, alongside overdue planned visits from past dates.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: *None*. This report is calculated dynamically relative to the current system date (`TODAY()`).

---

## Google Sheet Formula

```excel
=LET(
  MasterFileID, VLOOKUP("MasterFileID", Config!A:B, 2, 0),
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),

  OutletVisitRaw, IMPORTRANGE(OutletFileID, "OutletVisits!A2:Q"),
  Visits, IFERROR(FILTER(OutletVisitRaw, IFERROR(INDEX(OutletVisitRaw, 0, 17) = "Active", FALSE), IFERROR(INDEX(OutletVisitRaw, 0, 4) = "PLANNED", FALSE)), {"", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""}),
  OutletsRaw, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),

  today_visits, IFERROR(FILTER(Visits, MAP(SEQUENCE(ROWS(Visits)), LAMBDA(r_idx, IFERROR(INT(INDEX(Visits, r_idx, 3)), 0) = TODAY()))), {"", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""}),
  overdue_visits_raw, IFERROR(FILTER(Visits, MAP(SEQUENCE(ROWS(Visits)), LAMBDA(r_idx, LET(d_val, INDEX(Visits, r_idx, 3), (IFERROR(INT(d_val), 0) < TODAY()))))), {"", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""}),
  overdue_visits, IFERROR(SORT(overdue_visits_raw, 3, TRUE), overdue_visits_raw),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),

  today_rows,
  REDUCE(
    IFERROR(1/0, ""),
    SEQUENCE(ROWS(today_visits)),
    LAMBDA(accum, r_idx,
      LET(
        outlet_code, INDEX(today_visits, r_idx, 2),
        planned_comment, INDEX(today_visits, r_idx, 7),
        outlet_name, IFERROR(VLOOKUP(outlet_code, OutletsRaw, 2, FALSE), ""),

        row_1, RowFn({5, r_idx; 7, outlet_name}),
        row_2, IF(TRIM(planned_comment) <> "",VSTACK(RowFn({8, planned_comment}),RowFn({0, ""})),RowFn({0, ""})),

        IF(
          r_idx = 1,
          VSTACK(row_1, row_2),
          VSTACK(accum, row_1, row_2)
        )
      )
    )
  ),

  overdue_rows,
  REDUCE(
    IFERROR(1/0, ""),
    SEQUENCE(ROWS(overdue_visits)),
    LAMBDA(accum, r_idx,
      LET(
        vdate, INDEX(overdue_visits, r_idx, 3),
        outlet_code, INDEX(overdue_visits, r_idx, 2),
        planned_comment, INDEX(overdue_visits, r_idx, 7),
        outlet_name, IFERROR(VLOOKUP(outlet_code, OutletsRaw, 2, FALSE), ""),

        days_overdue, TODAY() - IFERROR(INT(vdate), TODAY()),
        due_str, "Due by " & days_overdue & " Days",

        row_1, RowFn({5, r_idx; 7, due_str}),
        row_2, RowFn({7, outlet_name}),
        row_3, IF(TRIM(planned_comment)<>"",VSTACK(RowFn({8, planned_comment}),RowFn({0, ""})),RowFn({0, ""})),

        IF(
          r_idx = 1,
          VSTACK(row_1, row_2, row_3),
          VSTACK(accum, row_1, row_2, row_3)
        )
      )
    )
  ),

  ReportData,
  VSTACK(
    RowFn({4, "Scheduled Visits - Today"}),
    RowFn({0, ""}),

    IF(
      INDEX(today_visits, 1, 1) = "",
      VSTACK(RowFn({10, "No visits scheduled for today"}), RowFn({0, ""})),
      today_rows
    ),

    RowFn({0, ""}),

    RowFn({4, "Overdue Visits"}),
    RowFn({0, ""}),

    IF(
      INDEX(overdue_visits, 1, 1) = "",
      VSTACK(RowFn({10, "No overdue visits"}), RowFn({0, ""})),
      overdue_rows
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

1. **`OutletVisits`** (`OutletVisits!A2:Q` in Outlet Spreadsheet):
   - Column 1 (`A`): Visit ID Code
   - Column 2 (`B`): Outlet Code
   - Column 3 (`C`): Visit Date (compared against `TODAY()`)
   - Column 4 (`D`): Visit Progress status (filters for `"PLANNED"`)
   - Column 7 (`G`): Planned Comment
   - Column 17 (`Q`): Visit Record Status (filters for `"Active"`)
2. **`Outlets`** (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name (resolved via `VLOOKUP`)

---

## Detailed Logic Breakdown

1. **Visits Filter**: Imports visit records and filters them to isolate entries with Progress status `"PLANNED"` and Record Status `"Active"`.
2. **Date Categorization**:
   - `today_visits`: Filters visits scheduled for `TODAY()`.
   - `overdue_visits`: Filters visits scheduled for dates before `TODAY()` (sorted by date ascending).
3. **`RowFn` Layout Generation**: 
   - A helper LAMBDA `RowFn(idx_val_pairs)` builds a single row spanning 39 columns. It places values at specified indexes and fills other columns with empty spaces.
4. **Visits Accumulator (`REDUCE`)**:
   - **Today's Visits**: Lists visits. Displays serial index (Col 5) and Outlet Name (Col 7). If a planned comment exists, it outputs it on the subsequent line (Col 8).
   - **Overdue Visits**: Lists overdue visits. Displays relative duration due string (e.g. `"Due by X Days"` in Col 7) on the first row, Outlet Name (Col 7) on the second, and the comment (Col 8) on the third.
5. **Output Assembly**: Combines both lists under their respective headers (`"Scheduled Visits - Today"` and `"Overdue Visits"`).
