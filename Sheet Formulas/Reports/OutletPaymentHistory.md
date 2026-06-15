# OutletPaymentHistory Report

The **OutletPaymentHistory Report** calculates total payment counts and collected amounts (KPI Dashboard) at Column X and displays a simplified chronological log of all payment transactions recorded for a specific outlet.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: Cell **`$AB$6`** (Outlet Code). The formula reads `$AB$6` to filter and summarize payment history for that specific outlet.

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

  PaymentsOutletCode, TOCOL(CHOOSECOLS(RawPayments, 3)),
  PaymentsProgress, TOCOL(CHOOSECOLS(RawPayments, 9)),
  PaymentsStatus, TOCOL(CHOOSECOLS(RawPayments, 16)),

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),

  Ones, MAP(PaymentsOutletCode, LAMBDA(x, 1)),

  TotalNumber, SUM(IFERROR(FILTER(Ones, (PaymentsOutletCode = $AB$6) * (PaymentsStatus = "Active")), 0)),

  PaymentsAmountCol, TOCOL(CHOOSECOLS(RawPayments, 5)),
  TotalAmountVal, SUM(IFERROR(FILTER(PaymentsAmountCol, (PaymentsOutletCode = $AB$6) * (PaymentsStatus = "Active") * (PaymentsProgress = "SUBMITTED")), 0)),

  OutletName, IFERROR(XLOOKUP($AB$6, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"),

  Filtered, IFERROR(
    FILTER(
      RawPayments,
      (PaymentsOutletCode = $AB$6) * (PaymentsStatus = "Active")
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

  S_Idx, TOCOL(CHOOSECOLS(SortedData, 1)),

  DummyRow, RowFn({0, "DUMMY"}),

  DashboardRows, VSTACK(
    RowFn({4, "Outlet Code"; 24, "Total No. of Payments"}),
    RowFn({4, $AB$6; 24, TotalNumber}),
    RowFn({4, "Outlet Name"; 24, "Total Amount Collected"}),
    RowFn({4, OutletName; 24, ToTextAmt(TotalAmountVal)}),
    RowFn({4, "History Generation Date"}),
    RowFn({4, TEXT(NOW(), "yyyy-mm-dd HH:mm:ss")}),
    RowFn({0, ""}),
    RowFn({0, ""})
  ),

  DynamicPart, REDUCE(DummyRow, SEQUENCE(ROWS(SortedData)), LAMBDA(acc, k, LET(
    idx, CHOOSEROWS(S_Idx, k),
    row_arr, CHOOSEROWS(Filtered, idx),

    PaymentCode, CHOOSEROWS(CHOOSECOLS(row_arr, 1), 1),
    PaymentDate, CHOOSEROWS(CHOOSECOLS(row_arr, 2), 1),
    Amount, CHOOSEROWS(CHOOSECOLS(row_arr, 5), 1),
    Mode, CHOOSEROWS(CHOOSECOLS(row_arr, 6), 1),
    Username, CHOOSEROWS(CHOOSECOLS(row_arr, 8), 1),

    FormattedDate, FormatEpochDateOnly(PaymentDate),

    ParentRow, RowFn({4, FormattedDate & " / " & PaymentCode; 27, ToTextAmt(Amount)}),
    Detail_Row, RowFn({5, "Collected By: " & Username; 27, Mode}),

    VSTACK(
      acc,
      ParentRow,
      Detail_Row,
      RowFn({0, ""})
    )
  ))),

  ReportData, IF(
    HasData,
    VSTACK(
      DashboardRows,
      CHOOSEROWS(DynamicPart, SEQUENCE(ROWS(DynamicPart) - 1, 1, 2))
    ),
    VSTACK(
      DashboardRows,
      RowFn({4, "No payment records found for this outlet."})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula imports data from two files (using `masterFileID` and `OutletFileID` keys from Config):
1. **`OutletPayments`** (`OutletPayments!A2:Q` in Outlet Spreadsheet):
   - Column 1 (`A`): Payment Code
   - Column 2 (`B`): Payment Date
   - Column 3 (`C`): Outlet Code (compared with `$AB$6`)
   - Column 5 (`E`): Payment Amount
   - Column 6 (`F`): Payment Mode
   - Column 8 (`H`): Username
   - Column 9 (`I`): Progress (`"SUBMITTED"`, `"CANCELLED"`)
   - Column 16 (`P`): Status (`"Active"`)
2. **`Outlets`** (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name

---

## Detailed Logic Breakdown

1. **Dashboard Calculations**:
   - `TotalNumber`: Counts total active payments for the outlet.
   - `TotalAmountVal`: Sums payment amounts for active payments in `"SUBMITTED"` progress state.
2. **Dashboard Output**: Displays Outlet Code/Name on the left and Total No. of Payments / Total Amount Collected on the right (Column X / index 24).
3. **Chronological Sorting**: Retrieves and sorts all active payment records for the outlet code `$AB$6` by payment date descending.
4. **Payment Record Accumulator (`REDUCE`)**:
   - Loops through each payment record.
   - `ParentRow`: Displays formatted date and payment code starting at Column D (index 4) and the payment amount at Column AA (index 27).
   - `Detail_Row`: Displays the username (prefixed with `"Collected By: "`) starting at Column E (index 5) and the payment mode at Column AA (index 27).
   - Separates each payment record block with a blank row.
5. **Final Assembly**: Stacks the KPI dashboard header rows and dynamic simplified payment cards into a 39-column wide report array.
