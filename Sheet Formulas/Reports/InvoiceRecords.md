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
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),
  SKUFileID, VLOOKUP("ViewFileID", Config!A:B, 2, 0),
  MasterFileID, VLOOKUP("masterFileID", Config!A:B, 2, 0),

  RawInvoices, IMPORTRANGE(OutletFileID, "OutletConsumptionInvoices!A2:AA"),
  RawItems, IMPORTRANGE(OutletFileID, "OutletConsumptionInvoiceItems!A2:K"),
  RawSKUs, IMPORTRANGE(SKUFileID, "SKU!A2:I"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
  FormatEpochDateOnly, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd"), val))),
  ToTextAmt, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), TEXT(num, "0.00"))),

  DateFilter, IF(OR($J$11 = "", $J$11 = "All Date"), "", $J$11),
  UserFilter, IF(OR($J$12 = "", $J$12 = "Any User"), "", $J$12),
  ProgressFilter, IF(OR($J$13 = "", $J$13 = "All Progress"), "", $J$13),

  HasInput, OR(DateFilter <> "", UserFilter <> "", ProgressFilter <> ""),

  InvoicesCode, TOCOL(CHOOSECOLS(RawInvoices, 1)),
  InvoicesDate, TOCOL(CHOOSECOLS(RawInvoices, 3)),
  InvoicesOutletCode, TOCOL(CHOOSECOLS(RawInvoices, 4)),
  InvoicesUser, TOCOL(CHOOSECOLS(RawInvoices, 5)),
  InvoicesProgress, TOCOL(CHOOSECOLS(RawInvoices, 14)),
  InvoicesStatus, TOCOL(CHOOSECOLS(RawInvoices, 27)),

  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),

  ParsedDates, MAP(InvoicesDate, LAMBDA(d, IFERROR(IF(ISNUMBER(d), d, DATEVALUE(LEFT(d, 10))), 0))),
  ParsedDateFilter, IFERROR(IF(ISNUMBER(DateFilter), DateFilter, DATEVALUE(LEFT(DateFilter, 10))), 0),

  Filtered, IFERROR(
    FILTER(
      RawInvoices,
      (InvoicesStatus = "Active") *
      (IF(
        HasInput,
        ((UserFilter = "") + (InvoicesUser = UserFilter)) *
        ((DateFilter = "") + (ParsedDates = ParsedDateFilter)) *
        ((ProgressFilter = "") + (InvoicesProgress = ProgressFilter)),
        SEQUENCE(ROWS(RawInvoices))*0 + 1
      ))
    ),
    MAKEARRAY(1, 27, LAMBDA(r, c, ""))
  ),

  FirstCell, CHOOSEROWS(CHOOSECOLS(Filtered, 1), 1),
  HasData, AND(NOT(ISERR(Filtered)), FirstCell <> ""),

  F_Date, IF(HasData, TOCOL(CHOOSECOLS(Filtered, 3)), TODAY()),
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

    InvoiceCode, CHOOSEROWS(CHOOSECOLS(row_arr, 1), 1),
    InvoiceDate, CHOOSEROWS(CHOOSECOLS(row_arr, 3), 1),
    OutletCode, CHOOSEROWS(CHOOSECOLS(row_arr, 4), 1),
    Username, CHOOSEROWS(CHOOSECOLS(row_arr, 5), 1),
    OrderProgress, CHOOSEROWS(CHOOSECOLS(row_arr, 14), 1),
    Subtotal, CHOOSEROWS(CHOOSECOLS(row_arr, 7), 1),
    Discount, CHOOSEROWS(CHOOSECOLS(row_arr, 8), 1),
    SubtotalVal, IFERROR(VALUE(Subtotal), 0),
    DiscountVal, IFERROR(VALUE(Discount), 0),

    OutletName, IFERROR(XLOOKUP(OutletCode, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"),
    FormattedDate, FormatEpochDateOnly(InvoiceDate),

    Row_1, RowFn({4, FormattedDate & " / " & InvoiceCode; 29, OrderProgress}),
    Row_2, RowFn({4, OutletName}),

    ItemMatches, IFERROR(
      FILTER(RawItems, (TOCOL(CHOOSECOLS(RawItems, 2)) = InvoiceCode) * (TOCOL(CHOOSECOLS(RawItems, 11)) = "Active")),
      MAKEARRAY(1, 11, LAMBDA(r, c, ""))
    ),
    HasItems, CHOOSEROWS(CHOOSECOLS(ItemMatches, 1), 1) <> "",

    ItemRows, REDUCE(DummyRow, SEQUENCE(IF(HasItems, ROWS(ItemMatches), 1)), LAMBDA(inner_acc, item_k, LET(
      item_row, CHOOSEROWS(ItemMatches, item_k),
      ItemSku, CHOOSEROWS(CHOOSECOLS(item_row, 3), 1),
      ItemQty, CHOOSEROWS(CHOOSECOLS(item_row, 4), 1),
      ItemPrice, CHOOSEROWS(CHOOSECOLS(item_row, 5), 1),
      ItemTotal, CHOOSEROWS(CHOOSECOLS(item_row, 6), 1),
      ItemDiscount, CHOOSEROWS(CHOOSECOLS(item_row, 7), 1),
      ItemTaxAmount, CHOOSEROWS(CHOOSECOLS(item_row, 9), 1),

      SKU_Row, XLOOKUP(ItemSku, SKU_Codes, RawSKUs, MAKEARRAY(1, 9, LAMBDA(r, c, ""))),
      ProdName, CHOOSEROWS(CHOOSECOLS(SKU_Row, 4), 1),
      SKU_Code, CHOOSEROWS(CHOOSECOLS(SKU_Row, 2), 1),
      VarValues, CHOOSEROWS(CHOOSECOLS(SKU_Row, 6), 1),
      UOMName, CHOOSEROWS(CHOOSECOLS(SKU_Row, 9), 1),
      ItemNameSuffix, IF(VarValues <> "", VarValues, SKU_Code),
      ItemDisplayName, ProdName & IF(ItemNameSuffix <> "", " - " & ItemNameSuffix, ""),

      VSTACK(
        inner_acc,
        RowFn({5, ProdName; 19, "Rate: " & ToTextAmt(ItemPrice); 27, ItemQty & " " & UOMName; 33, ToTextAmt(ItemTotal)}),
        RowFn({5, ItemSku & IF(VarValues <> "", " / " & VarValues, ""); 19, "Discount: " & ToTextAmt(ItemDiscount); 27, "Tax: " & ToTextAmt(ItemTaxAmount)})
      )
    ))),

    CleanItemRows, IF(
      HasItems,
      CHOOSEROWS(ItemRows, SEQUENCE(MAX(1, ROWS(ItemRows) - 1), 1, 2)),
      RowFn({6, "No items found in this invoice."})
    ),

    InvoiceSummaryRow, RowFn({7, "Prepared By: " & Username; 19, "Invoice Discount: " & ToTextAmt(DiscountVal); 33, ToTextAmt(SubtotalVal - DiscountVal)}),

    VSTACK(
      acc,
      Row_1,
      Row_2,
      CleanItemRows,
      InvoiceSummaryRow,
      RowFn({0, ""})
    )
  ))),

  FallbackText, IF(HasInput, "No invoice records matched the selected filters.", "No active invoice records found."),

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

The formula queries data from four spreadsheet files (`OutletFileID`, `ViewFileID`, `masterFileID`):
1. **`OutletConsumptionInvoices`** (`OutletConsumptionInvoices!A2:AA` in Outlet Spreadsheet):
   - Column 1 (`A`): Code
   - Column 3 (`C`): Date (compared to `$J$11`)
   - Column 4 (`D`): Outlet Code
   - Column 5 (`E`): Username (compared to `$J$12`)
   - Column 7 (`G`): Subtotal
   - Column 8 (`H`): Discount
   - Column 14 (`N`): Progress status (compared to `$J$13`)
   - Column 27 (`AA`): Record status (`"Active"`)
2. **`OutletConsumptionInvoiceItems`** (`OutletConsumptionInvoiceItems!A2:K` in Outlet Spreadsheet):
   - Column 2 (`B`): Outlet Consumption Invoice Code
   - Column 3 (`C`): SKU Code
   - Column 4 (`D`): Quantity
   - Column 5 (`E`): Price
   - Column 6 (`F`): Total
   - Column 7 (`G`): Discount
   - Column 9 (`I`): Tax Amount
   - Column 11 (`K`): Record Status (`"Active"`)
3. **`Outlets`** (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name
4. **`SKU`** (`SKU!A2:I` in Views Spreadsheet):
   - Column 1 (`A`): SKU Code
   - Column 2 (`B`): SKUCode
   - Column 4 (`D`): Product Name
   - Column 6 (`F`): Variant Values
   - Column 9 (`I`): UOM Name

---

## Detailed Logic Breakdown

1. **User Filter Inputs**: Resolves search filters from cells `$J$11` (Date), `$J$12` (Username), and `$J$13` (Progress). If set to defaults (`"All Date"`, `"Any User"`, or `"All Progress"`), they are treated as empty.
2. **Dynamic Filtering**:
   - Parses date fields into standard serial numbers.
   - Filters `OutletConsumptionInvoices` where the row status is `"Active"` and matches all provided filter inputs.
3. **Sorting & Slicing**:
   - Sorts results descending by invoice date.
   - If no search filters are active, limits the output array to the **latest 15 rows**.
4. **Stacked Record Reduction**:
   - Loops through each invoice record.
   - Row 1: Displays date and invoice code in a single merged string at Column D (index 4), and progress status at Column AC (index 29).
   - Row 2: Displays Outlet Name starting at Column D (index 4).
   - Filters and displays corresponding items under that invoice code from `OutletConsumptionInvoiceItems`.
     - Line 1: ProductName at E (index 5), Rate at S (index 19), Qty UOM at AA (index 27), Total at AG (index 33).
     - Line 2: SKUCode / CSV Variants at E (index 5), Discount at S (index 19), Tax Amount at AA (index 27).
   - Appends an Invoice Summary Row after the items of each invoice: Prepared By at G (index 7), Invoice Discount at S (index 19), and Subtotal-Discount at AG (index 33). All numeric values are explicitly cast to string representations (using a `ToTextAmt` Lambda) to prevent value clipping inside cells.
   - Outputs a blank space between records.
5. **Final Output Assembly**: Outputs only the dynamic records, omitting any report heading strings.
