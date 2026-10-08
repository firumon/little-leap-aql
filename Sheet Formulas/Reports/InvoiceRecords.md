# InvoiceRecords Report

The **InvoiceRecords Report** provides a filtered search and checklist log for Outlet Consumption Invoices. It filters invoice records by date, username, and progress status, sorting by date descending, and displays nested item details, pricing, and totals for each matched invoice.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A15`
- **User Input Dependencies**:
  - Cell **`$J$11`**: Invoice Date Filter (supports specific date or `"All Date"` / blank for no filter).
  - Cell **`$J$12`**: Username Filter (supports specific username or `"Any User"` / blank for no filter).
  - Cell **`$J$13`**: Progress status Filter (supports specific progress or `"All Progress"` / blank for no filter).
- **Default Behavior**: If no filters are active, the report displays the **latest 15 consumption invoice records** sorted from newest to oldest.

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

  DateInput, TRIM($J$11),
  UserInput, TRIM($J$12),
  ProgressInput, TRIM($J$13),

  DateFilter, IF(OR(DateInput = "", DateInput = "All Date", DateInput = "Any Date"), "", DateInput),
  UserFilter, IF(OR(UserInput = "", UserInput = "Any User", UserInput = "All User"), "", UserInput),
  ProgressFilter, IF(OR(ProgressInput = "", ProgressInput = "All Progress", ProgressInput = "Any Progress"), "", ProgressInput),

  HasInput, OR(DateFilter <> "", UserFilter <> "", ProgressFilter <> ""),

  FilterDateSerial, IF(DateFilter = "", 0, LET(num, IFERROR(VALUE(DateFilter), 0), IF(num > 100000000000, INT(25569 + num / 86400000), IFERROR(INT(DateFilter), IFERROR(DATEVALUE(LEFT(DateFilter, 10)), 0))))),

  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),

  InvoicesWithData, IFERROR(FILTER(RawInvoices, INDEX(RawInvoices, 0, 1) <> ""), ""),
  HasAnyInvoices, AND(INDEX(InvoicesWithData, 1, 1) <> "", INDEX(InvoicesWithData, 1, 1) <> "#N/A"),

  AllTrue, IF(HasAnyInvoices, MAP(INDEX(InvoicesWithData, 0, 1), LAMBDA(x, TRUE)), TRUE),

  UserMatch, IF(
    NOT(HasAnyInvoices),
    TRUE,
    IF(
      UserFilter = "",
      AllTrue,
      MAP(INDEX(InvoicesWithData, 0, 5), INDEX(InvoicesWithData, 0, 6), LAMBDA(c5, c6, ((UPPER(TRIM(c5)) = UPPER(UserFilter)) + (UPPER(TRIM(c6)) = UPPER(UserFilter))) > 0))
    )
  ),

  DateMatch, IF(
    NOT(HasAnyInvoices),
    TRUE,
    IF(
      DateFilter = "",
      AllTrue,
      MAP(INDEX(InvoicesWithData, 0, 3), LAMBDA(d, LET(num, IFERROR(VALUE(d), 0), d_serial, IF(num > 100000000000, INT(25569 + num / 86400000), IFERROR(INT(d), IFERROR(DATEVALUE(LEFT(d, 10)), -1))), d_serial = FilterDateSerial)))
    )
  ),

  ProgressMatch, IF(
    NOT(HasAnyInvoices),
    TRUE,
    IF(
      ProgressFilter = "",
      AllTrue,
      MAP(INDEX(InvoicesWithData, 0, 17), LAMBDA(p, UPPER(TRIM(p)) = UPPER(ProgressFilter)))
    )
  ),

  StatusMatch, IF(
    NOT(HasAnyInvoices),
    TRUE,
    MAP(INDEX(InvoicesWithData, 0, 30), LAMBDA(st, OR(TRIM(st) = "", UPPER(TRIM(st)) = "ACTIVE")))
  ),

  Filtered, IF(
    HasAnyInvoices,
    IF(
      HasInput,
      IFERROR(FILTER(InvoicesWithData, StatusMatch, UserMatch, DateMatch, ProgressMatch), ""),
      IFERROR(FILTER(InvoicesWithData, StatusMatch), "")
    ),
    ""
  ),
  HasData, AND(INDEX(Filtered, 1, 1) <> "", INDEX(Filtered, 1, 1) <> "#N/A"),

  SortedData, IF(HasData, IFERROR(SORT(Filtered, 3, FALSE), Filtered), Filtered),
  LimitRows, IF(NOT(HasData), 0, IF(HasInput, ROWS(SortedData), MIN(15, ROWS(SortedData)))),
  SortedDataLimited, IF(LimitRows > 0, CHOOSEROWS(SortedData, SEQUENCE(LimitRows)), SortedData),

  FallbackText, IF(HasInput, "No invoice records matched the selected filters.", "No active invoice records found."),

  DynamicPart, IF(
    HasData,
    REDUCE("", SEQUENCE(LimitRows), LAMBDA(acc, k, LET(
      row_arr, CHOOSEROWS(SortedDataLimited, k),

      InvoiceCode, INDEX(row_arr, 1, 1),
      InvoiceDate, INDEX(row_arr, 1, 3),
      Raw_Col5, INDEX(row_arr, 1, 5),
      Raw_Col6, INDEX(row_arr, 1, 6),
      OutletCode, IF(LEFT(TRIM(Raw_Col5), 3) = "OUT", TRIM(Raw_Col5), IF(LEFT(TRIM(Raw_Col6), 3) = "OUT", TRIM(Raw_Col6), TRIM(Raw_Col5))),
      Username, IF(TRIM(OutletCode) = TRIM(Raw_Col5), TRIM(Raw_Col6), TRIM(Raw_Col5)),
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

      OutletNameLookup, IFERROR(XLOOKUP(OutletCode, OutletCodes, OutletNames, OutletCode), OutletCode),
      OutletName, IF(TRIM(OutletNameLookup) = "", OutletCode, OutletNameLookup),
      FormattedDate, FormatEpochDateOnly(InvoiceDate),

      Row_1, RowFn({4, FormattedDate & " / " & InvoiceCode; 29, OrderProgress}),
      Row_2, RowFn({4, OutletName}),

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
        Row_1,
        Row_2,
        CleanItemRows,
        InvoiceSummaryRow,
        RowFn({0, ""})
      ),

      IF(k = 1, InvoiceBlock, VSTACK(acc, InvoiceBlock))
    ))),
    RowFn({4, FallbackText})
  ),

  ReportData, DynamicPart,

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula queries data from four spreadsheet files (using `MasterFileID` / `masterFileID`, `OutletFileID` / `OperationFileID`, and `ViewFileID` from Config):
1. **`OutletConsumptionInvoices`** (`OutletConsumptionInvoices!A2:AD` in Outlet Spreadsheet):
   - Column 1 (`A`): Invoice Code
   - Column 3 (`C`): Date (compared to `$J$11`)
   - Column 5 (`E`): Outlet Code / Username
   - Column 6 (`F`): Username / Outlet Code (compared to `$J$12`)
   - Column 8 (`H`): Subtotal
   - Column 9 (`I`): Discount
   - Column 11 (`K`): Total Tax Amount
   - Column 14 (`N`): Return Deduction Total
   - Column 17 (`Q`): Progress status (compared to `$J$13`)
   - Column 30 (`AD`): Record status (`"Active"`)
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

1. **User Filter Inputs**: Resolves search filters from cells `$J$11` (Date), `$J$12` (Username), and `$J$13` (Progress). If set to defaults (`"All Date"`, `"Any User"`, or `"All Progress"`), they are treated as empty.
2. **Dynamic Filtering**:
   - Parses date fields into standard serial numbers.
   - Filters `OutletConsumptionInvoices` where the row status is `"Active"` (or blank) and matches all provided filter inputs.
3. **Sorting & Slicing**:
   - Sorts results descending by invoice date.
   - If no search filters are active, limits the output array to the **latest 15 rows**.
4. **Stacked Record Reduction**:
   - Loops through each invoice record.
   - Row 1: Displays date and invoice code in a single merged string at Column D (index 4), and progress status at Column AC (index 29).
   - Row 2: Displays Outlet Name starting at Column D (index 4).
   - Filters and displays corresponding items under that invoice code from `OutletConsumptionInvoiceItems`.
     - Line 1: ProductName at E (index 5), Rate at S (index 19), Qty UOM at AA (index 27), Total at AG (index 33).
     - Line 2: SKU Code / Variants at E (index 5), Discount at S (index 19), Tax Amount at AA (index 27).
   - Appends an Invoice Summary Row after the items of each invoice: Prepared By at G (index 7), Invoice Discount at S (index 19), and Net Payable (`Subtotal - Discount + Tax - ReturnDeduction`) at AG (index 33). All numeric values are explicitly cast to string representations (using a `ToTextAmt` Lambda) to prevent value clipping inside cells.
   - Outputs a blank space between records.
5. **Final Output Assembly**: Outputs only the dynamic records, omitting any report heading strings.
