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
  MasterFileID, IFERROR(VLOOKUP("MasterFileID", Config!A:B, 2, 0), VLOOKUP("masterFileID", Config!A:B, 2, 0)),
  OutletFileID, IFERROR(VLOOKUP("OutletFileID", Config!A:B, 2, 0), VLOOKUP("OperationFileID", Config!A:B, 2, 0)),

  RawPayments, IMPORTRANGE(OutletFileID, "OutletPayments!A2:U"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
  FormatEpochDateOnly, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(TRIM(val) = "", "", IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd"), IFERROR(TEXT(INT(val), "yyyy-mm-dd"), IFERROR(TEXT(DATEVALUE(LEFT(val, 10)), "yyyy-mm-dd"), val)))))),
  ToTextAmt, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), TEXT(num, "0.00"))),

  PaymentsOutletCode, TOCOL(CHOOSECOLS(RawPayments, 3)),
  PaymentsStatus, TOCOL(CHOOSECOLS(RawPayments, 20)),

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),

  CleanInput, TRIM($AB$6),
  HasInput, AND(CleanInput <> "", CleanInput <> "#N/A"),

  OutletName, IF(HasInput, IFERROR(XLOOKUP(CleanInput, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"), ""),
  FormattedNow, TEXT(NOW(), "yyyy-mm-dd HH:mm:ss"),

  MatchingPayments, IF(
    HasInput,
    IFERROR(FILTER(RawPayments, (PaymentsOutletCode = CleanInput) * ((PaymentsStatus = "Active") + (PaymentsStatus = ""))), ""),
    ""
  ),
  HasData, AND(INDEX(MatchingPayments, 1, 1) <> "", INDEX(MatchingPayments, 1, 1) <> "#N/A"),

  TotalNumber, IF(HasData, ROWS(MatchingPayments), 0),
  Amounts, IF(HasData, TOCOL(CHOOSECOLS(MatchingPayments, 6)), 0),
  Progs, IF(HasData, TOCOL(CHOOSECOLS(MatchingPayments, 10)), ""),
  TotalAmountVal, IF(HasData, SUM(IFERROR(FILTER(Amounts, Progs <> "CANCELLED"), 0)), 0),

  SortedPayments, IF(HasData, IFERROR(SORT(MatchingPayments, 2, FALSE), MatchingPayments), MatchingPayments),

  DashboardRows, VSTACK(
    RowFn({4, "Outlet Code"; 24, "Total No. of Payments"}),
    RowFn({4, CleanInput; 24, TotalNumber}),
    RowFn({4, "Outlet Name"; 24, "Total Amount Collected"}),
    RowFn({4, OutletName; 24, ToTextAmt(TotalAmountVal)}),
    RowFn({4, "History Generation Date"}),
    RowFn({4, FormattedNow}),
    RowFn({0, ""}),
    RowFn({0, ""})
  ),

  DynamicPart, IF(
    HasData,
    REDUCE("", SEQUENCE(ROWS(SortedPayments)), LAMBDA(acc, k, LET(
      row_arr, CHOOSEROWS(SortedPayments, k),

      PaymentCode, INDEX(row_arr, 1, 1),
      PaymentDate, INDEX(row_arr, 1, 2),
      Amount, INDEX(row_arr, 1, 6),
      Mode, INDEX(row_arr, 1, 7),
      Username, INDEX(row_arr, 1, 9),

      FormattedDate, FormatEpochDateOnly(PaymentDate),

      ParentRow, RowFn({4, FormattedDate & " / " & PaymentCode; 27, ToTextAmt(Amount)}),
      Detail_Row, RowFn({5, "Collected By: " & Username; 27, Mode}),

      PaymentBlock, VSTACK(ParentRow, Detail_Row, RowFn({0, ""})),

      IF(k = 1, PaymentBlock, VSTACK(acc, PaymentBlock))
    ))),
    RowFn({4, "No payment records found for this outlet."})
  ),

  ReportData, IF(
    HasInput,
    VSTACK(DashboardRows, DynamicPart),
    VSTACK(
      RowFn({4, "OUTLET PAYMENT HISTORY"}),
      RowFn({0, ""}),
      RowFn({4, "Please enter a valid Outlet Code in cell AB6."})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula imports data from two files (using `MasterFileID` / `masterFileID` and `OutletFileID` / `OperationFileID` keys from Config):
1. **`OutletPayments`** (`OutletPayments!A2:U` in Outlet Spreadsheet):
   - Column 1 (`A`): Payment Code
   - Column 2 (`B`): Payment Date
   - Column 3 (`C`): Outlet Code (compared with `$AB$6`)
   - Column 6 (`F`): Payment Amount
   - Column 7 (`G`): Payment Mode
   - Column 9 (`I`): Username
   - Column 10 (`J`): Progress (`"SUBMITTED"`, `"APPROVED"`, `"CANCELLED"`)
   - Column 20 (`T`): Status (`"Active"`)
2. **`Outlets`** (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name

---

## Detailed Logic Breakdown

1. **Dashboard Calculations**:
   - `TotalNumber`: Counts total active payments for the outlet.
   - `TotalAmountVal`: Sums collected payment amounts for active payments excluding `"CANCELLED"`.
2. **Dashboard Output**: Displays Outlet Code/Name on the left and Total No. of Payments / Total Amount Collected on the right (Column X / index 24).
3. **Chronological Sorting**: Retrieves and sorts all active payment records for the outlet code `$AB$6` by payment date descending.
4. **Payment Record Accumulator (`REDUCE`)**:
   - Loops through each sorted payment record without dummy placeholder rows.
   - `ParentRow`: Displays formatted date and payment code starting at Column D (index 4) and the payment amount at Column AA (index 27).
   - `Detail_Row`: Displays the collector username starting at Column E (index 5) and the payment mode at Column AA (index 27).
   - Separates each payment record block with a blank spacer row.
5. **Final Assembly**: Stacks the KPI dashboard header rows and dynamic payment cards into a 39-column wide report array.
