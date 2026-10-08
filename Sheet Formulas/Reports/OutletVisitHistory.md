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
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:K"),
  MatchingOutlets, IFERROR(FILTER(RawOutlets, INDEX(RawOutlets, 0, 1) = $H$11), ""),

  IF(
    OR($H$11 = "", INDEX(MatchingOutlets, 1, 1) = ""),
    "Please select a valid Outlet Code in H11",
    LET(
      name, INDEX(MatchingOutlets, 1, 2),
      contact, INDEX(MatchingOutlets, 1, 4),
      phone, INDEX(MatchingOutlets, 1, 5),
      country, INDEX(MatchingOutlets, 1, 7),
      province, INDEX(MatchingOutlets, 1, 8),
      city, INDEX(MatchingOutlets, 1, 9),
      area, INDEX(MatchingOutlets, 1, 10),
      address_parts, TEXTJOIN(", ", TRUE, area, city, province, country),

      name & IF(address_parts <> "", " - " & address_parts, "") & 
      IF(contact <> "", CHAR(10) & "Contact Person: " & contact, "") & 
      IF(phone <> "", CHAR(10) & "Phone: " & phone, "")
    )
  )
)
```

### 2. Status Counter Dashboard (Cells `U10`, `U15`, `AD10`, `AD15`)
Calculates the count of visits assigned to different progress stages for the active outlet.

- **Planned Visits (Cell `U10`)**:
  ```excel
  =LET(
    OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),
    RawVisits, IMPORTRANGE(OutletFileID, "OutletVisits!A2:R"),
    Matching, IFERROR(FILTER(INDEX(RawVisits, 0, 1), INDEX(RawVisits, 0, 2) = $H$11, INDEX(RawVisits, 0, 5) = "PLANNED", INDEX(RawVisits, 0, 18) = "Active"), ""),
    IF(OR($H$11 = "", INDEX(Matching, 1, 1) = ""), 0, ROWS(Matching))
  )
  ```
- **Postponed Visits (Cell `U15`)**:
  *Identical to `U10`, but filters for `INDEX(RawVisits, 0, 5) = "POSTPONED"`.*
- **Completed Visits (Cell `AD10`)**:
  *Identical to `U10`, but filters for `INDEX(RawVisits, 0, 5) = "COMPLETED"`.*
- **Cancelled Visits (Cell `AD15`)**:
  *Identical to `U10`, but filters for `INDEX(RawVisits, 0, 5) = "CANCELLED"`.*

### 3. Chronological Visit Timeline (Cell `A20`)
Generates a formatted chronological timeline of visits, calculating relative days (e.g. `"X Days Ago"`, `"Today"`, `"In X Days"`) and displaying phase-specific comments.

```excel
=LET(
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),
  RawVisits, IMPORTRANGE(OutletFileID, "OutletVisits!A2:R"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),

  FilteredVisits, IFERROR(FILTER(RawVisits, INDEX(RawVisits, 0, 2) = $H$11, INDEX(RawVisits, 0, 18) = "Active"), {"", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""}),
  HasData, AND($H$11 <> "", INDEX(FilteredVisits, 1, 1) <> ""),

  SortedVisits, IF(HasData, IFERROR(SORT(FilteredVisits, 3, TRUE), FilteredVisits), FilteredVisits),

  DynamicPart, REDUCE(
    IFERROR(1/0, ""),
    SEQUENCE(ROWS(SortedVisits)),
    LAMBDA(acc, k,
      LET(
        vdate_raw, INDEX(SortedVisits, k, 3),
        current_date, IFERROR(INT(vdate_raw), IFERROR(DATEVALUE(LEFT(vdate_raw, 10)), TODAY())),
        FormattedDate, TEXT(current_date, "yyyy-mm-dd"),

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
                prev_date_raw, INDEX(SortedVisits, MAX(1, k - 1), 3),
                prev_date, IFERROR(INT(prev_date_raw), IFERROR(DATEVALUE(LEFT(prev_date_raw, 10)), current_date)),
                diff, current_date - prev_date,
                IF(diff = 0, "On same day", diff & " Day" & IF(diff = 1, "", "s") & " After")
              )
            )
          )
        ),

        ItemProgress, INDEX(SortedVisits, k, 5),
        PlannedComment, INDEX(SortedVisits, k, 8),
        CompletedComment, INDEX(SortedVisits, k, 11),
        PostponedComment, INDEX(SortedVisits, k, 14),
        CancelledComment, INDEX(SortedVisits, k, 17),

        ProgressComment, SWITCH(UPPER(ItemProgress), "COMPLETED", CompletedComment, "POSTPONED", PostponedComment, "CANCELLED", CancelledComment, ""),

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

        IF(k = 1, ItemRows, VSTACK(acc, ItemRows))
      )
    )
  ),

  ReportData, IF(
    HasData,
    DynamicPart,
    VSTACK(
      RowFn({4, "No visit records found for this outlet."}),
      RowFn({0, ""})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formulas import data from the Master Spreadsheet (`MasterFileID`) and Outlet Spreadsheet (`OutletFileID`):
1. **`Outlets`** (`Outlets!A2:K` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code (compared with `$H$11`)
   - Column 2 (`B`): Outlet Name
   - Column 4 (`D`): Contact Person
   - Column 5 (`E`): Phone
   - Columns 7, 8, 9, 10 (`G:J`): Address components (Country, Province, City, Area)
2. **`OutletVisits`** (`OutletVisits!A2:R` in Outlet Spreadsheet):
   - Column 1 (`A`): Visit Code
   - Column 2 (`B`): Outlet Code (compared with `$H$11`)
   - Column 3 (`C`): Visit Date
   - Column 4 (`D`): Respond Date *(not read by this report)*
   - Column 5 (`E`): Visit Progress status (`"PLANNED"`, `"COMPLETED"`, `"POSTPONED"`, `"CANCELLED"`)
   - Column 8 (`H`): Planned Comment
   - Column 11 (`K`): Completed Comment
   - Column 14 (`N`): Postponed Comment
   - Column 17 (`Q`): Cancelled Comment
   - Column 18 (`R`): Record Status (`"Active"`)

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
