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
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),
  SKUFileID, VLOOKUP("ViewFileID", Config!A:B, 2, 0),
  MasterFileID, VLOOKUP("masterFileID", Config!A:B, 2, 0),

  RawInvoices, IMPORTRANGE(OutletFileID, "OutletConsumptionInvoices!A2:AB"),
  RawItems, IMPORTRANGE(OutletFileID, "OutletConsumptionInvoiceItems!A2:K"),
  RawSKUs, IMPORTRANGE(SKUFileID, "SKU!A2:I"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
  FormatEpochDateOnly, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd"), val))),
  ToTextAmt, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), TEXT(num, "0.00"))),

  InvoicesOutletCode, TOCOL(CHOOSECOLS(RawInvoices, 5)),
  InvoicesProgress, TOCOL(CHOOSECOLS(RawInvoices, 15)),
  InvoicesStatus, TOCOL(CHOOSECOLS(RawInvoices, 28)),

  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),

  Ones, MAP(InvoicesOutletCode, LAMBDA(x, 1)),

  PendingPaymentCount, SUM(IFERROR(FILTER(Ones, (InvoicesOutletCode = $AB$6) * (InvoicesStatus = "Active") * (InvoicesProgress = "PENDING_PAYMENT")), 0)),
  PartiallyPaidCount, SUM(IFERROR(FILTER(Ones, (InvoicesOutletCode = $AB$6) * (InvoicesStatus = "Active") * (InvoicesProgress = "PARTIALLY_PAID")), 0)),
  PaidCount, SUM(IFERROR(FILTER(Ones, (InvoicesOutletCode = $AB$6) * (InvoicesStatus = "Active") * (InvoicesProgress = "PAID")), 0)),
  CancelledCount, SUM(IFERROR(FILTER(Ones, (InvoicesOutletCode = $AB$6) * (InvoicesStatus = "Active") * (InvoicesProgress = "CANCELLED")), 0)),
  TotalNumber, PendingPaymentCount + PartiallyPaidCount + PaidCount + CancelledCount,

  OutletName, IFERROR(XLOOKUP($AB$6, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"),

  Filtered, IFERROR(
    FILTER(
      RawInvoices,
      (InvoicesOutletCode = $AB$6) * (InvoicesStatus = "Active")
    ),
    MAKEARRAY(1, 28, LAMBDA(r, c, ""))
  ),

  FirstCell, CHOOSEROWS(CHOOSECOLS(Filtered, 1), 1),
  HasData, AND(NOT(ISERR(Filtered)), FirstCell <> ""),

  F_Date, IF(HasData, TOCOL(CHOOSECOLS(Filtered, 3)), TODAY()),
  F_ParsedDate, MAP(F_Date, LAMBDA(d, IFERROR(IF(ISNUMBER(d), d, DATEVALUE(LEFT(d, 10))), TODAY()))),

  F_Indices, SEQUENCE(ROWS(Filtered)),
  F_Data, HSTACK(F_Indices, F_ParsedDate),
  SortedData, SORT(F_Data, 2, FALSE),

  S_Idx, TOCOL(CHOOSECOLS(SortedData, 1)),

  DummyRow, RowFn({0, "DUMMY"}),

  DashboardRows, VSTACK(
    RowFn({4, "Outlet Code"; 24, "Pending Payment"; 25, PendingPaymentCount}),
    RowFn({4, $AB$6; 24, "Partially Paid"; 25, PartiallyPaidCount}),
    RowFn({4, "Outlet Name"; 24, "Paid"; 25, PaidCount}),
    RowFn({4, OutletName; 24, "Cancelled"; 25, CancelledCount}),
    RowFn({4, "Total Invoices"}),
    RowFn({4, TotalNumber}),
    RowFn({4, "History Generation Date"}),
    RowFn({4, TEXT(NOW(), "yyyy-mm-dd HH:mm:ss")}),
    RowFn({0, ""}),
    RowFn({0, ""})
  ),

  DynamicPart, REDUCE(DummyRow, SEQUENCE(ROWS(SortedData)), LAMBDA(acc, k, LET(
    idx, CHOOSEROWS(S_Idx, k),
    row_arr, CHOOSEROWS(Filtered, idx),

    InvoiceCode, CHOOSEROWS(CHOOSECOLS(row_arr, 1), 1),
    InvoiceDate, CHOOSEROWS(CHOOSECOLS(row_arr, 3), 1),
    Username, CHOOSEROWS(CHOOSECOLS(row_arr, 6), 1),
    OrderProgress, CHOOSEROWS(CHOOSECOLS(row_arr, 15), 1),
    Subtotal, CHOOSEROWS(CHOOSECOLS(row_arr, 8), 1),
    Discount, CHOOSEROWS(CHOOSECOLS(row_arr, 9), 1),
    SubtotalVal, IFERROR(VALUE(Subtotal), 0),
    DiscountVal, IFERROR(VALUE(Discount), 0),

    FormattedDate, FormatEpochDateOnly(InvoiceDate),

    ParentRow, RowFn({4, FormattedDate & " / " & InvoiceCode; 27, OrderProgress}),

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
      CHOOSEROWS(ItemRows, SEQUENCE(ROWS(ItemRows) - 1, 1, 2)),
      RowFn({6, "No items found in this invoice."})
    ),

    InvoiceSummaryRow, RowFn({7, "Prepared By: " & Username; 19, "Invoice Discount: " & ToTextAmt(DiscountVal); 33, ToTextAmt(SubtotalVal - DiscountVal)}),

    VSTACK(
      acc,
      ParentRow,
      CleanItemRows,
      InvoiceSummaryRow,
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
      RowFn({4, "No invoice records found for this outlet."})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula imports data from three files (using `masterFileID`, `OutletFileID`, and `ViewFileID` from Config):
1. **`OutletConsumptionInvoices`** (`OutletConsumptionInvoices!A2:AB` in Outlet Spreadsheet):
   - Column 1 (`A`): Invoice Code
   - Column 3 (`C`): Invoice Date
   - Column 4 (`D`): Due Date *(not read by this report)*
   - Column 5 (`E`): Outlet Code (compared with `$AB$6`)
   - Column 6 (`F`): Username
   - Column 8 (`H`): Subtotal
   - Column 9 (`I`): Discount
   - Column 15 (`O`): Progress status (`"PENDING_PAYMENT"`, `"PARTIALLY_PAID"`, `"PAID"`, `"CANCELLED"`)
   - Column 28 (`AB`): Status (`"Active"`)
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

1. **Dashboard Calculations**:
   - Counts active invoices grouped by progress status states (`PENDING_PAYMENT`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`) for the selected outlet code.
2. **Dashboard Output**: Generates structured KPI labels and counts for the dashboard header.
3. **Chronological Sorting**: Retrieves and sorts the consumption invoice records for the outlet code `$AB$6` by date descending.
4. **Invoice Record Accumulator (`REDUCE`)**:
   - Loops through each sorted invoice record.
   - Appends a Parent Row showing the date and invoice code in a single merged string at Column D (index 4), and progress status at Column AA (index 27). (Username and Net Payable are excluded from parent header row).
   - Filters `OutletConsumptionInvoiceItems` for active item entries under that invoice code.
   - Appends item description rows detailing:
     - Line 1: ProductName at E (index 5), Rate at S (index 19), Qty UOM at AA (index 27), Total at AG (index 33).
     - Line 2: SKUCode / CSV Variants at E (index 5), Discount at S (index 19), Tax Amount at AA (index 27).
   - Appends an Invoice Summary Row after the items of each invoice: Prepared By at G (index 7), Invoice Discount at S (index 19), and Subtotal-Discount at AG (index 33). All numeric values are explicitly cast to string representations (using a `ToTextAmt` Lambda) to prevent value clipping inside cells.
5. **Final Assembly**: Stacks the KPI dashboard header rows and dynamic invoice records into a 39-column wide report array.
