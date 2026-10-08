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
  MasterFileID, IFERROR(VLOOKUP("MasterFileID", Config!A:B, 2, 0), VLOOKUP("masterFileID", Config!A:B, 2, 0)),
  OutletFileID, IFERROR(VLOOKUP("OutletFileID", Config!A:B, 2, 0), VLOOKUP("OperationFileID", Config!A:B, 2, 0)),

  RawPayments, IMPORTRANGE(OutletFileID, "OutletPayments!A2:U"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
  FormatEpochDateOnly, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(TRIM(val) = "", "", IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd"), IFERROR(TEXT(INT(val), "yyyy-mm-dd"), IFERROR(TEXT(DATEVALUE(LEFT(val, 10)), "yyyy-mm-dd"), val)))))),
  ToTextAmt, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), TEXT(num, "0.00"))),

  DateInput, TRIM($J$11),
  UserInput, TRIM($J$12),
  ModeInput, TRIM($J$13),

  DateFilter, IF(OR(DateInput = "", DateInput = "All Date", DateInput = "Any Date"), "", DateInput),
  UserFilter, IF(OR(UserInput = "", UserInput = "Any User", UserInput = "All User"), "", UserInput),
  ModeFilter, IF(OR(ModeInput = "", ModeInput = "Every Mode", ModeInput = "All Mode", ModeInput = "Any Mode"), "", ModeInput),

  HasInput, OR(DateFilter <> "", UserFilter <> "", ModeFilter <> ""),

  FilterDateSerial, IF(DateFilter = "", 0, LET(num, IFERROR(VALUE(DateFilter), 0), IF(num > 100000000000, INT(25569 + num / 86400000), IFERROR(INT(DateFilter), IFERROR(DATEVALUE(LEFT(DateFilter, 10)), 0))))),

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),

  PaymentsWithData, IFERROR(FILTER(RawPayments, INDEX(RawPayments, 0, 1) <> ""), ""),
  HasAnyPayments, AND(INDEX(PaymentsWithData, 1, 1) <> "", INDEX(PaymentsWithData, 1, 1) <> "#N/A"),

  AllTrue, IF(HasAnyPayments, MAP(INDEX(PaymentsWithData, 0, 1), LAMBDA(x, TRUE)), TRUE),

  UserMatch, IF(
    NOT(HasAnyPayments),
    TRUE,
    IF(
      UserFilter = "",
      AllTrue,
      MAP(INDEX(PaymentsWithData, 0, 9), LAMBDA(u, UPPER(TRIM(u)) = UPPER(UserFilter)))
    )
  ),

  DateMatch, IF(
    NOT(HasAnyPayments),
    TRUE,
    IF(
      DateFilter = "",
      AllTrue,
      MAP(INDEX(PaymentsWithData, 0, 2), LAMBDA(d, LET(num, IFERROR(VALUE(d), 0), d_serial, IF(num > 100000000000, INT(25569 + num / 86400000), IFERROR(INT(d), IFERROR(DATEVALUE(LEFT(d, 10)), -1))), d_serial = FilterDateSerial)))
    )
  ),

  ModeMatch, IF(
    NOT(HasAnyPayments),
    TRUE,
    IF(
      ModeFilter = "",
      AllTrue,
      MAP(INDEX(PaymentsWithData, 0, 7), LAMBDA(m, UPPER(TRIM(m)) = UPPER(ModeFilter)))
    )
  ),

  StatusMatch, IF(
    NOT(HasAnyPayments),
    TRUE,
    MAP(INDEX(PaymentsWithData, 0, 20), LAMBDA(st, OR(TRIM(st) = "", UPPER(TRIM(st)) = "ACTIVE")))
  ),

  Filtered, IF(
    HasAnyPayments,
    IF(
      HasInput,
      IFERROR(FILTER(PaymentsWithData, StatusMatch, UserMatch, DateMatch, ModeMatch), ""),
      IFERROR(FILTER(PaymentsWithData, StatusMatch), "")
    ),
    ""
  ),
  HasData, AND(INDEX(Filtered, 1, 1) <> "", INDEX(Filtered, 1, 1) <> "#N/A"),

  SortedData, IF(HasData, IFERROR(SORT(Filtered, 2, FALSE), Filtered), Filtered),
  LimitRows, IF(NOT(HasData), 0, IF(HasInput, ROWS(SortedData), MIN(15, ROWS(SortedData)))),
  SortedDataLimited, IF(LimitRows > 0, CHOOSEROWS(SortedData, SEQUENCE(LimitRows)), SortedData),

  FallbackText, IF(HasInput, "No payment records matched the selected filters.", "No active payment records found."),

  DynamicPart, IF(
    HasData,
    REDUCE("", SEQUENCE(LimitRows), LAMBDA(acc, k, LET(
      row_arr, CHOOSEROWS(SortedDataLimited, k),

      PaymentCode, INDEX(row_arr, 1, 1),
      PaymentDate, INDEX(row_arr, 1, 2),
      OutletCode, INDEX(row_arr, 1, 3),
      Amount, INDEX(row_arr, 1, 6),
      Mode, INDEX(row_arr, 1, 7),
      Username, INDEX(row_arr, 1, 9),

      OutletNameLookup, IFERROR(XLOOKUP(OutletCode, OutletCodes, OutletNames, OutletCode), OutletCode),
      OutletName, IF(TRIM(OutletNameLookup) = "", OutletCode, OutletNameLookup),
      FormattedDate, FormatEpochDateOnly(PaymentDate),

      Record_Row_1, RowFn({4, FormattedDate & " / " & PaymentCode; 27, ToTextAmt(Amount)}),
      Record_Row_2, RowFn({4, OutletName; 27, Mode & " by " & Username}),

      RecordBlock, VSTACK(Record_Row_1, Record_Row_2, RowFn({0, ""})),

      IF(k = 1, RecordBlock, VSTACK(acc, RecordBlock))
    ))),
    RowFn({4, FallbackText})
  ),

  ReportData, DynamicPart,

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula queries data from two spreadsheet files (using `MasterFileID` / `masterFileID` and `OutletFileID` / `OperationFileID` keys from Config):
1. **`OutletPayments`** (`OutletPayments!A2:U` in Outlet Spreadsheet):
   - Column 1 (`A`): Code
   - Column 2 (`B`): Date (compared to `$J$11`)
   - Column 3 (`C`): Outlet Code
   - Column 6 (`F`): Payment Amount
   - Column 7 (`G`): Payment Mode (compared to `$J$13`)
   - Column 9 (`I`): Username (compared to `$J$12`)
   - Column 20 (`T`): Status (`"Active"`)
2. **`Outlets`** (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name

---

## Detailed Logic Breakdown

1. **User Filter Inputs**: Resolves search filters from cells `$J$11` (Date), `$J$12` (Username), and `$J$13` (Payment Mode). Default parameters (`"All Date"`, `"Any User"`, or `"Every Mode"`) are evaluated as blank.
2. **Dynamic Filtering**:
   - Parses dates into uniform serial format.
   - Filters `OutletPayments` where record status is `"Active"` (or blank) and matches all active criteria.
3. **Sorting & Slicing**:
   - Sorts results descending by payment date.
   - Limits output results to the **latest 15 rows** if no filters are active.
4. **Stacked Record Reduction**:
   - Loops through each matching payment transaction without dummy placeholder rows.
   - `Record_Row_1`: Date and Payment Code at Column D (index 4), and Amount at Column AA (index 27).
   - `Record_Row_2`: Outlet Name at Column D (index 4), and Mode with collector username (e.g., `"Cash by firumon"`) at Column AA (index 27).
   - Separates each payment log card with a spacer row.
5. **Final Output Assembly**: Outputs only the dynamic records, omitting any report heading strings.
