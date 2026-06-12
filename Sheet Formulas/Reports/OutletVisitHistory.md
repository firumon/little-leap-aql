# OutletVisitHistory Report

The **OutletVisitHistory Report** compiles a complete record card, visit status counter dashboard, and historical timeline for a specific outlet. It uses multiple cooperating formulas spread across different cells in the report sheet.

---

## User Input Dependency

- **User Input Cell**: Cell **`$H$11`** (Outlet Code).
- **Purpose**: All formulas on this sheet read `$H$11` to fetch and filter visits, details, and logs.

---

## Cooperating Cell Formulas

### 1. Outlet Detail Card (Cell `E12`)
Retrieves and formats basic outlet registry details (Name, Address details, Contact Person, and Phone) into a text card.

```excel
=LET(
  MasterFileID, VLOOKUP("MasterFileID", Config!A:B, 2, 0),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:J"),
  Outlet,FILTER(RawOutlets, CHOOSECOLS(RawOutlets, 1) = $H$11),
  TEXTJOIN(", ",TRUE,CHOOSECOLS(Outlet,2,9,8,7,6)) & CHAR(10) & "Contact Person: " & INDEX(Outlet,1,3) & CHAR(10) & "Phone: " & INDEX(Outlet,1,4)
)
```

### 2. Status Counter Dashboard (Cells `U10`, `U15`, `AD10`, `AD15`)
Calculates the count of visits assigned to different progress stages for the active outlet.

- **Planned Visits (Cell `U10`)**:
  ```excel
  =LET(
    OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),
    RawVisits, IMPORTRANGE(OutletFileID, "OutletVisits!A2:V"),
    Progress, "PLANNED",
    VisitsOutletCode, TOCOL(CHOOSECOLS(RawVisits, 2)),
    VisitsProgress, TOCOL(CHOOSECOLS(RawVisits, 4)),
    VisitsStatus, TOCOL(CHOOSECOLS(RawVisits, 17)),
    Ones, MAP(VisitsOutletCode, LAMBDA(x, 1)),
    SUM(IFERROR(FILTER(Ones, (VisitsOutletCode = $H$11) * (VisitsProgress = Progress) * (VisitsStatus = "Active")), 0))
  )
  ```
- **Postponed Visits (Cell `U15`)**:
  *Identical to `U10`, but sets `Progress, "POSTPONED"`.*
- **Cancelled Visits (Cell `AD15`)**:
  *Identical to `U10`, but sets `Progress, "CANCELLED"`.*
- **Completed Visits (Cell `AD10`)**:
  *Identical to `U10`, but sets `Progress, "COMPLETED"`.*

### 3. Chronological Visit Timeline (Cell `A20`)
Generates a formatted chronological timeline of visits, calculating relative days (e.g. `"X Days Ago"`, `"Today"`, `"In X Days"`) and displaying phase-specific comments.

```excel
=LET(
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),
  RawVisits, IMPORTRANGE(OutletFileID, "OutletVisits!A2:Q"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),

  VisitsOutletCode, TOCOL(CHOOSECOLS(RawVisits, 2)),
  VisitsDate, TOCOL(CHOOSECOLS(RawVisits, 3)),
  VisitsProgress, TOCOL(CHOOSECOLS(RawVisits, 4)),
  VisitsStatus, TOCOL(CHOOSECOLS(RawVisits, 17)),

  ParsedDates, MAP(VisitsDate, LAMBDA(d, IFERROR(IF(ISNUMBER(d), d, DATEVALUE(LEFT(d, 10))), 0))),

  Filtered, IFERROR(
    FILTER(
      RawVisits,
      (VisitsOutletCode = $H$11) * (VisitsStatus = "Active") * (ParsedDates > 0)
    ),
    MAKEARRAY(1, 17, LAMBDA(r, c, ""))
  ),

  FirstCell, CHOOSEROWS(CHOOSECOLS(Filtered, 1), 1),
  HasData, AND(NOT(ISERR(Filtered)), FirstCell <> ""),

  F_Date, IF(HasData, TOCOL(CHOOSECOLS(Filtered, 3)), TODAY()),
  F_Progress, IF(HasData, TOCOL(CHOOSECOLS(Filtered, 4)), ""),
  F_ParsedDate, MAP(F_Date, LAMBDA(d, IFERROR(IF(ISNUMBER(d), d, DATEVALUE(LEFT(d, 10))), TODAY()))),

  F_Indices, SEQUENCE(ROWS(Filtered)),
  F_Data, HSTACK(F_Indices, F_ParsedDate),
  SortedData, SORT(F_Data, 2, TRUE),

  S_Idx, TOCOL(CHOOSECOLS(SortedData, 1)),
  S_ParsedDate, TOCOL(CHOOSECOLS(SortedData, 2)),

  DummyRow, RowFn({0, "DUMMY"}),

  DynamicPart, REDUCE(DummyRow, SEQUENCE(ROWS(SortedData)), LAMBDA(acc, k, LET(
    idx, CHOOSEROWS(S_Idx, k),
    current_date, CHOOSEROWS(S_ParsedDate, k),
    
    HeaderText, IF(
      current_date > TODAY(),
      LET(
        future_diff, current_date - TODAY(),
        "In " & future_diff & " Day" & IF(future_diff = 1, "", "s")
      ),
      IF(
        current_date = TODAY(),
        "Today",
        IF(
          k = 1,
          LET(
            past_diff, TODAY() - current_date,
            past_diff & " Day" & IF(past_diff = 1, "", "s") & " Ago"
          ),
          LET(
            prev_date, CHOOSEROWS(S_ParsedDate, MAX(1, k - 1)),
            diff, current_date - prev_date,
            IF(diff = 0, "On same day", diff & " Day" & IF(diff = 1, "", "s") & " After")
          )
        )
      )
    ),
    
    row_arr, CHOOSEROWS(Filtered, idx),
    ItemProgress, CHOOSEROWS(F_Progress, idx),
    FormattedDate, TEXT(current_date, "yyyy-mm-dd"),
    
    PlannedComment, CHOOSEROWS(CHOOSECOLS(row_arr, 7), 1),
    
    ProgressComment, LET(
      p, UPPER(ItemProgress),
      IF(p = "PLANNED", CHOOSEROWS(CHOOSECOLS(row_arr, 7), 1),
      IF(p = "COMPLETED", CHOOSEROWS(CHOOSECOLS(row_arr, 10), 1),
      IF(p = "POSTPONED", CHOOSEROWS(CHOOSECOLS(row_arr, 13), 1),
      IF(p = "CANCELLED", CHOOSEROWS(CHOOSECOLS(row_arr, 16), 1),
      ""))))
    ),
    
    ItemRows, IF(
      UPPER(ItemProgress) = "PLANNED",
      VSTACK(
        RowFn({4, HeaderText}),
        RowFn({6, "On: " & FormattedDate; 14, PlannedComment}),
        RowFn({0, ""})
      ),
      VSTACK(
        RowFn({4, HeaderText}),
        RowFn({6, "On: " & FormattedDate; 14, PlannedComment}),
        RowFn({6, ItemProgress; 14, ProgressComment}),
        RowFn({0, ""})
      )
    ),
    
    VSTACK(acc, ItemRows)
  ))),

  ReportData, IF(
    HasData,
    CHOOSEROWS(DynamicPart, SEQUENCE(ROWS(DynamicPart) - 1, 1, 2)),
    VSTACK(
      RowFn({4, "No visit records found for this outlet."})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formulas import data from the Master Spreadsheet (`MasterFileID`) and Outlet Spreadsheet (`OutletFileID`):
1. **`Outlets`** (`Outlets!A2:J` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code (compared with `$H$11`)
   - Column 2 (`B`): Outlet Name
   - Column 3 (`C`): Contact Person
   - Column 4 (`D`): Phone
   - Column 6, 7, 8, 9 (`F:I`): Address components (City, Area, Province, Country)
2. **`OutletVisits`** (`OutletVisits!A2:V` or `A2:Q` in Outlet Spreadsheet):
   - Column 2 (`B`): Outlet Code (compared with `$H$11`)
   - Column 3 (`C`): Visit Date
   - Column 4 (`D`): Visit Progress status (`"PLANNED"`, `"COMPLETED"`, `"POSTPONED"`, `"CANCELLED"`)
   - Column 7 (`G`): Planned Comment
   - Column 10 (`J`): Completed Comment
   - Column 13 (`M`): Postponed Comment
   - Column 16 (`P`): Cancelled Comment
   - Column 17 (`Q`): Record Status (`"Active"`)

---

## Detailed Logic Breakdown

1. **Card Parsing (`E12`)**: Filters `Outlets` for the code `$H$11`. Concatenates name, city, area, state, and country. Appends contact person and phone with line breaks (`CHAR(10)`).
2. **Dashboard Counters**: Filter active rows in `OutletVisits` where the Outlet matches `$H$11` and the progress status matches the specific target (e.g. `"POSTPONED"`). Returns the count of records.
3. **Timeline Sorting & Grouping (`A20`)**:
   - Parses date inputs to date serial numbers.
   - Filters visits for the active outlet code.
   - Sorts records chronologically.
   - Loops through index mapping using `REDUCE`.
   - **Relative Header Calculation**: Calculates date offsets to display `"Today"`, `"In X Days"`, `"X Days Ago"`, or relative steps `"X Days After"`.
   - **Comment Extraction**: Resolves which comment index to read based on progress status (e.g., if Status is `"COMPLETED"`, reads the Completed Comment from Col 10).
   - Generates a 39-column layout block per visit entry.
