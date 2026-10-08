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
  MasterFileID, VLOOKUP("MasterFileID", Config!A:B, 2, 0),
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),

  OutletVisitRaw, IMPORTRANGE(OutletFileID, "OutletVisits!A2:R"),
  Visits, IFERROR(FILTER(OutletVisitRaw, IFERROR(INDEX(OutletVisitRaw, 0, 18) = "Active", FALSE), IFERROR(INDEX(OutletVisitRaw, 0, 5) = "PLANNED", FALSE)), {"", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""}),
  OutletsRaw, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),

  overdue_visits_raw, IFERROR(FILTER(Visits, MAP(SEQUENCE(ROWS(Visits)), LAMBDA(r_idx, LET(d_val, INDEX(Visits, r_idx, 3), (IFERROR(INT(d_val), 0) < TODAY()))))), {"", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""}),
  overdue_visits, IFERROR(SORT(overdue_visits_raw, 3, TRUE), overdue_visits_raw),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),

  total_count, IF(INDEX(overdue_visits, 1, 1) = "", 0, ROWS(overdue_visits)),

  overdue_rows,
  REDUCE(
    IFERROR(1/0, ""),
    SEQUENCE(ROWS(overdue_visits)),
    LAMBDA(accum, r_idx,
      LET(
        vdate_raw, INDEX(overdue_visits, r_idx, 3),
        vdate, IFERROR(INT(vdate_raw), IFERROR(DATEVALUE(LEFT(vdate_raw, 10)), 0)),
        prev_date_raw, IF(r_idx = 1, "", INDEX(overdue_visits, r_idx - 1, 3)),
        prev_date, IF(r_idx = 1, 0, IFERROR(INT(prev_date_raw), IFERROR(DATEVALUE(LEFT(prev_date_raw, 10)), 0))),
        is_new_group, (vdate <> prev_date),

        days_overdue, TODAY() - vdate,
        due_str, "Due by " & days_overdue & " Days",

        outlet_code, INDEX(overdue_visits, r_idx, 2),
        planned_comment, INDEX(overdue_visits, r_idx, 8),
        outlet_name, IFERROR(VLOOKUP(outlet_code, OutletsRaw, 2, FALSE), ""),

        group_head, IF(r_idx = 1, VSTACK(RowFn({5, due_str}), RowFn({0, ""})), VSTACK(RowFn({0, ""}), RowFn({5, due_str}), RowFn({0, ""}))),

        row_shop, RowFn({5, r_idx; 7, outlet_name}),
        row_comment, IF(TRIM(planned_comment) <> "", VSTACK(RowFn({8, planned_comment}), RowFn({0, ""})), RowFn({0, ""})),

        curr_rows, IF(
          is_new_group,
          VSTACK(group_head, row_shop, row_comment),
          VSTACK(row_shop, row_comment)
        ),

        IF(
          r_idx = 1,
          curr_rows,
          VSTACK(accum, curr_rows)
        )
      )
    )
  ),

  ReportData,
  VSTACK(
    RowFn({4, "Total Overdue Visits - " & total_count}),
    RowFn({0, ""}),

    IF(
      INDEX(overdue_visits, 1, 1) = "",
      VSTACK(RowFn({10, "No overdue visits found."}), RowFn({0, ""})),
      overdue_rows
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

1. **`OutletVisits`** (`OutletVisits!A2:R` in Outlet Spreadsheet):
   - Column 1 (`A`): Visit ID Code
   - Column 2 (`B`): Outlet Code
   - Column 3 (`C`): Visit Date (compared against `TODAY()`)
   - Column 4 (`D`): Respond Date *(not read by this report)*
   - Column 5 (`E`): Visit Progress status (filters for `"PLANNED"`)
   - Column 8 (`H`): Planned Comment
   - Column 18 (`R`): Visit Record Status (filters for `"Active"`)
2. **`Outlets`** (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name (resolved via `VLOOKUP`)

---

## Detailed Logic Breakdown

1. **Visits Filter**: Imports visit records and filters them to isolate entries with Progress status `"PLANNED"` and Record Status `"Active"`.
2. **Date Categorization**: Filters visits scheduled before `TODAY()`, sorted by date ascending.
3. **`RowFn` Layout Generation**: A helper LAMBDA `RowFn(idx_val_pairs)` builds a single row spanning 39 columns.
4. **Visits Accumulator (`REDUCE`)**:
   - Detects date boundaries with `is_new_group`.
   - Renders `"Due by X Days"` group header at Column 5 without numbers.
   - Assigns continuous serial numbering to each shop row across all groups.
   - Renders planned comment on the following line when present.
5. **Output Assembly**: Displays the total overdue visits header and dynamic grouped rows.
