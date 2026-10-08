# OutletInvoiceHistory Report

The **OutletInvoiceHistory Report** calculates invoice counts (KPI Dashboard) and displays a detailed chronological historical log of all stock consumption invoices and invoice items recorded for a specific outlet.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: Cell **`$AB$6`** (Outlet Code). The formula reads `$AB$6` to filter and summarize invoice history for that specific outlet.

---

## Google Sheet Formula

```excel
=LET(
  MasterFileID, IFERROR(VLOOKUP("MasterFileID", Config!A:B, 2, 0), VLOOKUP("masterFileID", Config!A:B, 2, 0)),
  OutletFileID, IFERROR(VLOOKUP("OutletFileID", Config!A:B, 2, 0), VLOOKUP("OperationFileID", Config!A:B, 2, 0)),
  SKUFileID, IFERROR(VLOOKUP("ViewFileID", Config!A:B, 2, 0), MasterFileID),

  RawInvoices, IMPORTRANGE(OutletFileID, "OutletConsumptionInvoices!A2:AD"),
  RawItems, IMPORTRANGE(OutletFileID, "OutletConsumptionInvoiceItems!A2:K"),
  RawSKUs, IMPORTRANGE(SKUFileID, "SKU!A2:I"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
  FormatEpochDateOnly, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(TRIM(val) = "", "", IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd"), IFERROR(TEXT(INT(val), "yyyy-mm-dd"), IFERROR(TEXT(DATEVALUE(LEFT(val, 10)), "yyyy-mm-dd"), val)))))),
  ToTextAmt, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), TEXT(num, "0.00"))),

  InvoicesOutletCode, TOCOL(CHOOSECOLS(RawInvoices, 5)),
  InvoicesUser, TOCOL(CHOOSECOLS(RawInvoices, 6)),

  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),

  CleanInput, TRIM($AB$6),
  HasInput, AND(CleanInput <> "", CleanInput <> "#N/A"),

  OutletName, IF(HasInput, IFERROR(XLOOKUP(CleanInput, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"), ""),
  FormattedNow, TEXT(NOW(), "yyyy-mm-dd HH:mm:ss"),

  MatchingInvoices, IF(HasInput, IFERROR(FILTER(RawInvoices, (InvoicesOutletCode = CleanInput) + (InvoicesUser = CleanInput)), ""), ""),
  HasData, AND(HasInput, INDEX(MatchingInvoices, 1, 1) <> "", INDEX(MatchingInvoices, 1, 1) <> "#N/A"),

  Progs, IF(HasData, TOCOL(CHOOSECOLS(MatchingInvoices, 17)), ""),
  PendingPaymentCount, IF(HasData, IFERROR(ROWS(FILTER(Progs, Progs = "PENDING_PAYMENT")), 0), 0),
  PartiallyPaidCount, IF(HasData, IFERROR(ROWS(FILTER(Progs, Progs = "PARTIALLY_PAID")), 0), 0),
  PaidCount, IF(HasData, IFERROR(ROWS(FILTER(Progs, Progs = "PAID")), 0), 0),
  CancelledCount, IF(HasData, IFERROR(ROWS(FILTER(Progs, Progs = "CANCELLED")), 0), 0),
  TotalNumber, PendingPaymentCount + PartiallyPaidCount + PaidCount + CancelledCount,

  SortedInvoices, IF(HasData, IFERROR(SORT(MatchingInvoices, 3, FALSE), MatchingInvoices), MatchingInvoices),

  DashboardRows, VSTACK(
    RowFn({4, "Outlet Code"; 24, "Pending Payment"; 25, PendingPaymentCount}),
    RowFn({4, CleanInput; 24, "Partially Paid"; 25, PartiallyPaidCount}),
    RowFn({4, "Outlet Name"; 24, "Paid"; 25, PaidCount}),
    RowFn({4, OutletName; 24, "Cancelled"; 25, CancelledCount}),
    RowFn({4, "Total Invoices"}),
    RowFn({4, TotalNumber}),
    RowFn({4, "History Generation Date"}),
    RowFn({4, FormattedNow}),
    RowFn({0, ""}),
    RowFn({0, ""})
  ),

  DynamicPart, IF(
    HasData,
    REDUCE("", SEQUENCE(ROWS(SortedInvoices)), LAMBDA(acc, k, LET(
      row_arr, CHOOSEROWS(SortedInvoices, k),

      InvoiceCode, INDEX(row_arr, 1, 1),
      InvoiceDate, INDEX(row_arr, 1, 3),
      Raw_User, INDEX(row_arr, 1, 6),
      Raw_Out, INDEX(row_arr, 1, 5),
      Username, IF(LEFT(TRIM(Raw_User), 3) = "OUT", Raw_Out, Raw_User),
      OrderProgress, INDEX(row_arr, 1, 17),
      Subtotal, INDEX(row_arr, 1, 8),
      Discount, INDEX(row_arr, 1, 9),
      TaxAmt, INDEX(row_arr, 1, 11),
      ReturnDeduction, INDEX(row_arr, 1, 14),

      SubtotalVal, IFERROR(VALUE(Subtotal), 0),
      DiscountVal, IFERROR(VALUE(Discount), 0),
      TaxVal, IFERROR(VALUE(TaxAmt), 0),
      ReturnVal, IFERROR(VALUE(ReturnDeduction), 0),
      NetPayable, MAX(0, SubtotalVal - DiscountVal + TaxVal - ReturnVal),

      FormattedDate, FormatEpochDateOnly(InvoiceDate),

      ParentRow, RowFn({4, FormattedDate & " / " & InvoiceCode; 27, OrderProgress}),

      ItemMatches, IFERROR(
        FILTER(RawItems, TOCOL(CHOOSECOLS(RawItems, 2)) = InvoiceCode),
        ""
      ),
      HasItems, AND(INDEX(ItemMatches, 1, 1) <> "", INDEX(ItemMatches, 1, 1) <> "#N/A"),

      CleanItemRows, IF(
        HasItems,
        REDUCE("", SEQUENCE(ROWS(ItemMatches)), LAMBDA(inner_acc, item_k, LET(
          item_row, CHOOSEROWS(ItemMatches, item_k),
          ItemSku, INDEX(item_row, 1, 3),
          ItemQty, INDEX(item_row, 1, 4),
          ItemPrice, INDEX(item_row, 1, 5),
          ItemTotal, INDEX(item_row, 1, 6),
          ItemDiscount, INDEX(item_row, 1, 7),
          ItemTaxAmount, INDEX(item_row, 1, 9),

          SKUMatchIdx, IFERROR(MATCH(ItemSku, SKU_Codes, 0), 0),
          SKU_Row, IF(SKUMatchIdx > 0, CHOOSEROWS(RawSKUs, SKUMatchIdx), MAKEARRAY(1, COLUMNS(RawSKUs), LAMBDA(r, c, ""))),
          ProdName, INDEX(SKU_Row, 1, 4),
          VarValues, INDEX(SKU_Row, 1, 6),
          UOMName, INDEX(SKU_Row, 1, 9),
          VarDisplay, IF(VarValues <> "", " / " & VarValues, ""),

          ItemBlock, VSTACK(
            RowFn({5, ProdName; 19, "Rate: " & ToTextAmt(ItemPrice); 27, ItemQty & " " & UOMName; 33, ToTextAmt(ItemTotal)}),
            RowFn({5, ItemSku & VarDisplay; 19, "Discount: " & ToTextAmt(ItemDiscount); 27, "Tax: " & ToTextAmt(ItemTaxAmount)})
          ),
          IF(item_k = 1, ItemBlock, VSTACK(inner_acc, ItemBlock))
        ))),
        RowFn({6, "No items found in this invoice."})
      ),

      InvoiceSummaryRow, RowFn({7, "Prepared By: " & Username; 19, "Invoice Discount: " & ToTextAmt(DiscountVal); 33, ToTextAmt(NetPayable)}),

      InvoiceBlock, VSTACK(
        ParentRow,
        CleanItemRows,
        InvoiceSummaryRow,
        RowFn({0, ""})
      ),

      IF(k = 1, InvoiceBlock, VSTACK(acc, InvoiceBlock))
    ))),
    RowFn({4, "No invoice records found for this outlet."})
  ),

  ReportData, IF(
    HasInput,
    VSTACK(DashboardRows, DynamicPart),
    VSTACK(
      RowFn({4, "OUTLET INVOICE HISTORY"}),
      RowFn({0, ""}),
      RowFn({4, "Please enter a valid Outlet Code in cell AB6."})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula imports data from three files (using `masterFileID` / `MasterFileID`, `OutletFileID` / `OperationFileID`, and `ViewFileID` from Config):
1. **`OutletConsumptionInvoices`** (`OutletConsumptionInvoices!A2:AD` in Outlet Spreadsheet):
   - Column 1 (`A`): Invoice Code
   - Column 3 (`C`): Invoice Date
   - Column 5 (`E`): Outlet Code / Username
   - Column 6 (`F`): Username / Outlet Code
   - Column 8 (`H`): Subtotal
   - Column 9 (`I`): Discount
   - Column 11 (`K`): Tax Amount
   - Column 14 (`N`): Return Deduction Total
   - Column 17 (`Q`): Progress status (`"PENDING_PAYMENT"`, `"PARTIALLY_PAID"`, `"PAID"`, `"CANCELLED"`)
2. **`OutletConsumptionInvoiceItems`** (`OutletConsumptionInvoiceItems!A2:K` in Outlet Spreadsheet):
   - Column 2 (`B`): Outlet Consumption Invoice Code
   - Column 3 (`C`): SKU Code
   - Column 4 (`D`): Quantity
   - Column 5 (`E`): Price
   - Column 6 (`F`): Total
   - Column 7 (`G`): Discount
   - Column 9 (`I`): Tax Amount
3. **`Outlets`** (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name
4. **`SKU`** (`SKU!A2:I` in Views Spreadsheet):
   - Column 1 (`A`): SKU Code
   - Column 4 (`D`): Product Name
   - Column 6 (`F`): Variant Values
   - Column 9 (`I`): UOM Name

---

## Detailed Logic Breakdown

1. **Dashboard Calculations**:
   - Counts invoices for the selected outlet code filtered by Progress states (`PENDING_PAYMENT`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`).
   - Calculates total invoice count.
2. **Dashboard Output**: Generates structured KPI labels and counts for the dashboard header.
3. **Chronological Sorting**: Retrieves and sorts the consumption invoice records for the outlet code `$AB$6` by invoice date descending.
4. **Invoice Record Accumulator (`REDUCE`)**:
   - Loops through each sorted invoice record.
   - Appends a Parent Row showing the date and invoice code at Column D (index 4), and progress status at Column AA (index 27).
   - Filters `OutletConsumptionInvoiceItems` for matching item entries under that invoice code.
   - Appends item description rows detailing:
     - Line 1: ProductName at E (index 5), Rate at S (index 19), Qty UOM at AA (index 27), Total at AG (index 33).
     - Line 2: SKUCode / Variants at E (index 5), Discount at S (index 19), Tax Amount at AA (index 27).
   - Appends an Invoice Summary Row after the items of each invoice: Prepared By at G (index 7), Invoice Discount at S (index 19), and Net Payable (`Subtotal - Discount + Tax - ReturnDeduction`) at AG (index 33).
5. **Final Assembly**: Stacks the KPI dashboard header rows and dynamic invoice records into a 39-column wide report array.
