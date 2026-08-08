# OutletVisitsTomorrowAndUpcomig Report

The **OutletVisitsTomorrowAndUpcomig Report** compiles a listing of planned outlet visits scheduled for tomorrow, along with upcoming planned visits scheduled for future dates.

> [!NOTE]
> The filename and formula reference use the spelling **`OutletVisitsTomorrowAndUpcomig`** (omitting the "n" in "Upcoming") to align with the sheet naming convention in the Google Sheet.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: *None*. This report is calculated dynamically relative to the current system date (`TODAY() + 1` for tomorrow and `> TODAY() + 1` for upcoming visits).

---

## Google Sheet Formula

```excel
=LET(
  MasterFileID, VLOOKUP("MasterFileID", Config!A:B, 2, 0),
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),

  OutletVisitRaw, IMPORTRANGE(OutletFileID, "OutletVisits!A2:R"),
  Visits, IFERROR(FILTER(OutletVisitRaw, IFERROR(INDEX(OutletVisitRaw, 0, 18) = "Active", FALSE), IFERROR(INDEX(OutletVisitRaw, 0, 5) = "PLANNED", FALSE)), {"", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""}),
  OutletsRaw, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),

  tomorrow_visits, IFERROR(FILTER(Visits, MAP(SEQUENCE(ROWS(Visits)), LAMBDA(r_idx, IFERROR(INT(INDEX(Visits, r_idx, 3)), 0) = TODAY() + 1))), {"", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""}),
  upcoming_visits_raw, IFERROR(FILTER(Visits, MAP(SEQUENCE(ROWS(Visits)), LAMBDA(r_idx, LET(d_val, INDEX(Visits, r_idx, 3), (IFERROR(INT(d_val), 0) > TODAY() + 1))))), {"", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""}),
  upcoming_visits, IFERROR(SORT(upcoming_visits_raw, 3, TRUE), upcoming_visits_raw),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),

  tomorrow_rows,
  REDUCE(
    IFERROR(1/0, ""),
    SEQUENCE(ROWS(tomorrow_visits)),
    LAMBDA(accum, r_idx,
      LET(
        outlet_code, INDEX(tomorrow_visits, r_idx, 2),
        planned_comment, INDEX(tomorrow_visits, r_idx, 8),
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

  upcoming_rows,
  REDUCE(
    IFERROR(1/0, ""),
    SEQUENCE(ROWS(upcoming_visits)),
    LAMBDA(accum, r_idx,
      LET(
        vdate, INDEX(upcoming_visits, r_idx, 3),
        outlet_code, INDEX(upcoming_visits, r_idx, 2),
        planned_comment, INDEX(upcoming_visits, r_idx, 8),
        outlet_name, IFERROR(VLOOKUP(outlet_code, OutletsRaw, 2, FALSE), ""),

        days_upcoming, IFERROR(INT(vdate), TODAY()) - TODAY(),
        in_str, "In " & days_upcoming & " Days",

        row_1, RowFn({5, r_idx; 7, in_str}),
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
    RowFn({4, "Scheduled Visits - Tomorrow"}),
    RowFn({0, ""}),

    IF(
      INDEX(tomorrow_visits, 1, 1) = "",
      VSTACK(RowFn({10, "No visits scheduled for tomorrow"}), RowFn({0, ""})),
      tomorrow_rows
    ),

    RowFn({0, ""}),

    RowFn({4, "Upcoming Schedules"}),
    RowFn({0, ""}),

    IF(
      INDEX(upcoming_visits, 1, 1) = "",
      VSTACK(RowFn({10, "No upcoming visits scheduled"}), RowFn({0, ""})),
      upcoming_rows
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
2. **Date Categorization**:
   - `tomorrow_visits`: Filters visits scheduled for `TODAY() + 1` (tomorrow).
   - `upcoming_visits`: Filters visits scheduled for dates after `TODAY() + 1` (sorted by date ascending).
3. **`RowFn` Layout Generation**: 
   - A helper LAMBDA `RowFn(idx_val_pairs)` builds a single row spanning 39 columns. It places values at specified indexes and fills other columns with empty spaces.
4. **Visits Accumulator (`REDUCE`)**:
   - **Tomorrow's Visits**: Lists tomorrow's visits. Displays serial index (Col 5) and Outlet Name (Col 7). If a planned comment exists, it outputs it on the subsequent line (Col 8).
   - **Upcoming Visits**: Lists upcoming visits. Displays relative duration string (e.g. `"In X Days"` in Col 7) on the first row, Outlet Name (Col 7) on the second, and the comment (Col 8) on the third.
5. **Output Assembly**: Combines both lists under their respective headers (`"Scheduled Visits - Tomorrow"` and `"Upcoming Schedules"`).
