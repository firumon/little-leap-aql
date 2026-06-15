# PaymentRecords Report

The **PaymentRecords Report** provides a filtered search and checklist log for Outlet Payments. It filters payment records by date, username, and payment mode, sorting by date descending, and displays a simplified two-row summary card showing payment code/date, amount, outlet name, mode, and collector username.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A15`
- **User Input Dependencies**:
  - Cell **`$J$11`**: Date Filter (supports specific date or `"All Date"` / blank for no filter).
  - Cell **`$J$12`**: Username Filter (supports specific username or `"Any User"` / blank for no filter).
  - Cell **`$J$13`**: Payment Mode Filter (supports specific mode or `"Every Mode"` / blank for no filter).
- **Default Behavior**: If no filters are active, the report displays the **latest 15 payment records** sorted from newest to oldest.

---

## Google Sheet Formula

```excel
=LET(
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),
  MasterFileID, VLOOKUP("masterFileID", Config!A:B, 2, 0),

  RawPayments, IMPORTRANGE(OutletFileID, "OutletPayments!A2:Q"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
  FormatEpochDateOnly, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd"), val))),
  ToTextAmt, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), TEXT(num, "0.00"))),

  DateFilter, IF(OR($J$11 = "", $J$11 = "All Date"), "", $J$11),
  UserFilter, IF(OR($J$12 = "", $J$12 = "Any User"), "", $J$12),
  ModeFilter, IF(OR($J$13 = "", $J$13 = "Every Mode"), "", $J$13),

  HasInput, OR(DateFilter <> "", UserFilter <> "", ModeFilter <> ""),

  PaymentsCode, TOCOL(CHOOSECOLS(RawPayments, 1)),
  PaymentsDate, TOCOL(CHOOSECOLS(RawPayments, 2)),
  PaymentsOutletCode, TOCOL(CHOOSECOLS(RawPayments, 3)),
  PaymentsAmount, TOCOL(CHOOSECOLS(RawPayments, 5)),
  PaymentsMode, TOCOL(CHOOSECOLS(RawPayments, 6)),
  PaymentsUser, TOCOL(CHOOSECOLS(RawPayments, 8)),
  PaymentsStatus, TOCOL(CHOOSECOLS(RawPayments, 16)),

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),

  ParsedDates, MAP(PaymentsDate, LAMBDA(d, IFERROR(IF(ISNUMBER(d), d, DATEVALUE(LEFT(d, 10))), 0))),
  ParsedDateFilter, IFERROR(IF(ISNUMBER(DateFilter), DateFilter, DATEVALUE(LEFT(DateFilter, 10))), 0),

  Filtered, IFERROR(
    FILTER(
      RawPayments,
      (PaymentsStatus = "Active") *
      (IF(
        HasInput,
        ((UserFilter = "") + (PaymentsUser = UserFilter)) *
        ((DateFilter = "") + (ParsedDates = ParsedDateFilter)) *
        ((ModeFilter = "") + (PaymentsMode = ModeFilter)),
        SEQUENCE(ROWS(RawPayments))*0 + 1
      ))
    ),
    MAKEARRAY(1, 17, LAMBDA(r, c, ""))
  ),

  FirstCell, CHOOSEROWS(CHOOSECOLS(Filtered, 1), 1),
  HasData, AND(NOT(ISERR(Filtered)), FirstCell <> ""),

  F_Date, IF(HasData, TOCOL(CHOOSECOLS(Filtered, 2)), TODAY()),
  F_ParsedDate, MAP(F_Date, LAMBDA(d, IFERROR(IF(ISNUMBER(d), d, DATEVALUE(LEFT(d, 10))), TODAY()))),

  F_Indices, SEQUENCE(ROWS(Filtered)),
  F_Data, HSTACK(F_Indices, F_ParsedDate),
  SortedData, SORT(F_Data, 2, FALSE),

  LimitRows, IF(HasInput, ROWS(SortedData), MIN(15, ROWS(SortedData))),
  SortedDataLimited, CHOOSEROWS(SortedData, SEQUENCE(LimitRows)),

  S_Idx, TOCOL(CHOOSECOLS(SortedDataLimited, 1)),

  DummyRow, RowFn({0, "DUMMY"}),

  DynamicPart, REDUCE(DummyRow, SEQUENCE(LimitRows), LAMBDA(acc, k, LET(
    idx, CHOOSEROWS(S_Idx, k),
    row_arr, CHOOSEROWS(Filtered, idx),

    PaymentCode, CHOOSEROWS(CHOOSECOLS(row_arr, 1), 1),
    PaymentDate, CHOOSEROWS(CHOOSECOLS(row_arr, 2), 1),
    OutletCode, CHOOSEROWS(CHOOSECOLS(row_arr, 3), 1),
    Amount, CHOOSEROWS(CHOOSECOLS(row_arr, 5), 1),
    Mode, CHOOSEROWS(CHOOSECOLS(row_arr, 6), 1),
    Username, CHOOSEROWS(CHOOSECOLS(row_arr, 8), 1),

    OutletName, IFERROR(XLOOKUP(OutletCode, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"),
    FormattedDate, FormatEpochDateOnly(PaymentDate),

    Record_Row_1, RowFn({4, FormattedDate & " / " & PaymentCode; 27, ToTextAmt(Amount)}),
    Record_Row_2, RowFn({4, OutletName; 27, Mode & " by " & Username}),

    VSTACK(
      acc,
      Record_Row_1,
      Record_Row_2,
      RowFn({0, ""})
    )
  ))),

  FallbackText, IF(HasInput, "No payment records matched the selected filters.", "No active payment records found."),

  ReportData, IF(
    HasData,
    CHOOSEROWS(DynamicPart, SEQUENCE(MAX(1, ROWS(DynamicPart) - 1), 1, 2)),
    RowFn({4, FallbackText})
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula queries data from two spreadsheet files (`OutletFileID` and `masterFileID` keys from Config):
1. **`OutletPayments`** (`OutletPayments!A2:Q` in Outlet Spreadsheet):
   - Column 1 (`A`): Code
   - Column 2 (`B`): Date (compared to `$J$11`)
   - Column 3 (`C`): Outlet Code
   - Column 5 (`E`): Payment Amount
   - Column 6 (`F`): Payment Mode (compared to `$J$13`)
   - Column 8 (`H`): Username (compared to `$J$12`)
   - Column 16 (`P`): Status (`"Active"`)
2. **`Outlets`** (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name

---

## Detailed Logic Breakdown

1. **User Filter Inputs**: Resolves search filters from cells `$J$11` (Date), `$J$12` (Username), and `$J$13` (Payment Mode). Default parameters (`"All Date"`, `"Any User"`, or `"Every Mode"`) are evaluated as blank.
2. **Dynamic Filtering**:
   - Compares record statuses to ensure only `"Active"` payments are evaluated.
   - Filters the table dynamically using cross-multiplication (`*`) for active conditions.
3. **Sorting & Slicing**:
   - Sorts results descending by payment date.
   - Limits output results to the **latest 15 rows** if no filters are active.
4. **Stacked Record Reduction**:
   - Loops through each matching payment transaction.
   - `Record_Row_1`: Date and Payment Code at Column D (index 4), and Amount at Column AA (index 27).
   - `Record_Row_2`: Outlet Name starting at Column D (index 4), and Payment Mode + collector username string (e.g. `"Cash by firumon"`) at Column AA (index 27).
   - Separates each payment log card with a spacer row.
5. **Final Output Assembly**: Outputs only the dynamic records, omitting any report heading strings.
