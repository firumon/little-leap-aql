# OutletReturnHistory Report

The **OutletReturnHistory Report** formats and displays a historical log of the 12 most recent sales return records for a specific outlet. The layout distributes record details over multiple lines to accommodate all attributes cleanly without exceeding standard width, and places a date-anchored record heading in Column D (index 4) for clear row conditional formatting separation.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: Cell **`$AB$6`** (Outlet Code). The formula reads `$AB$6` to filter returns for that specific outlet.
- **Purpose**: Generates a dynamic log of the 12 most recent returns. If `$AB$6` is blank or matches no records, it outputs a default header and a warning message.

---

## Google Sheet Formula

```excel
=LET(
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),
  MasterFileID, VLOOKUP("masterFileID", Config!A:B, 2, 0),
  SKUFileID, VLOOKUP("ViewFileID", Config!A:B, 2, 0),

  RawReturns, IMPORTRANGE(OutletFileID, "OutletReturns!A2:AB"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),
  RawSKUs, IMPORTRANGE(SKUFileID, "SKU!A2:G"),
  RawWarehouses, IMPORTRANGE(MasterFileID, "Warehouses!A2:B"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
  ToYesNo, LAMBDA(val, IF(UPPER(val) = "TRUE", "Yes", "No")),
  FormatEpochDateTime, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd hh:mm"), val))),
  FormatEpochDateOnly, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd"), val))),

  ReturnCodes, TOCOL(CHOOSECOLS(RawReturns, 1)),
  OutletCodesInReturns, TOCOL(CHOOSECOLS(RawReturns, 2)),
  DatesInReturns, TOCOL(CHOOSECOLS(RawReturns, 3)),
  StatusInReturns, TOCOL(CHOOSECOLS(RawReturns, 23)),

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),
  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  WarehouseCodes, TOCOL(CHOOSECOLS(RawWarehouses, 1)),
  WarehouseNames, TOCOL(CHOOSECOLS(RawWarehouses, 2)),

  OutletName, IFERROR(XLOOKUP($AB$6, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"),

  FilteredReturns, IFERROR(FILTER(RawReturns, (OutletCodesInReturns = $AB$6) * (StatusInReturns = "Active")), ""),
  HasData, AND(NOT(ISERR(FilteredReturns)), CHOOSEROWS(CHOOSECOLS(FilteredReturns, 1), 1) <> ""),

  SortedReturns, IF(HasData, SORT(FilteredReturns, 3, FALSE), MAKEARRAY(1, 28, LAMBDA(r, c, ""))),
  RecentReturns, IF(HasData, CHOOSEROWS(SortedReturns, SEQUENCE(MIN(12, ROWS(SortedReturns)))), MAKEARRAY(1, 28, LAMBDA(r, c, ""))),

  FormattedNow, TEXT(NOW(), "yyyy-mm-dd"),

  HeaderRows, VSTACK(
    RowFn({4, OutletName; 30, FormattedNow}),
    RowFn({0, ""})
  ),

  DummyRow, RowFn({0, "DUMMY"}),

  DynamicPart, REDUCE(DummyRow, SEQUENCE(IF(HasData, ROWS(RecentReturns), 1)), LAMBDA(acc, k, LET(
    row_arr, CHOOSEROWS(RecentReturns, k),
    
    ReturnCode, CHOOSEROWS(CHOOSECOLS(row_arr, 1), 1),
    ReturnDate, CHOOSEROWS(CHOOSECOLS(row_arr, 3), 1),
    Username, CHOOSEROWS(CHOOSECOLS(row_arr, 4), 1),
    SKUCode, CHOOSEROWS(CHOOSECOLS(row_arr, 5), 1),
    Qty, CHOOSEROWS(CHOOSECOLS(row_arr, 6), 1),
    Price, CHOOSEROWS(CHOOSECOLS(row_arr, 7), 1),
    Reason, CHOOSEROWS(CHOOSECOLS(row_arr, 8), 1),
    ReasonComment, CHOOSEROWS(CHOOSECOLS(row_arr, 9), 1),
    InvoiceAdjRequired, CHOOSEROWS(CHOOSECOLS(row_arr, 10), 1),
    InvoiceAdjDone, CHOOSEROWS(CHOOSECOLS(row_arr, 11), 1),
    ConsumptionInvoice, CHOOSEROWS(CHOOSECOLS(row_arr, 12), 1),
    WhActionRequired, CHOOSEROWS(CHOOSECOLS(row_arr, 13), 1),
    WhActionCompleted, CHOOSEROWS(CHOOSECOLS(row_arr, 14), 1),
    WhCode, CHOOSEROWS(CHOOSECOLS(row_arr, 15), 1),
    WhAction, CHOOSEROWS(CHOOSECOLS(row_arr, 16), 1),
    OrderProgress, CHOOSEROWS(CHOOSECOLS(row_arr, 22), 1),

    SKU_Row, XLOOKUP(SKUCode, SKU_Codes, RawSKUs, MAKEARRAY(1, 7, LAMBDA(r, c, ""))),
    ProdName, CHOOSEROWS(CHOOSECOLS(SKU_Row, 4), 1),
    SKU_Code_Val, CHOOSEROWS(CHOOSECOLS(SKU_Row, 2), 1),
    VarValues, CHOOSEROWS(CHOOSECOLS(SKU_Row, 6), 1),
    ItemNameSuffix, IF(VarValues <> "", VarValues, SKU_Code_Val),
    ItemDisplayName, ProdName & IF(AND(ItemNameSuffix <> "", ItemNameSuffix <> SKUCode), " - " & ItemNameSuffix, "") & " (" & SKUCode & ")",

    WarehouseName, IF(WhCode <> "", IFERROR(XLOOKUP(WhCode, WarehouseCodes, WarehouseNames, WhCode), WhCode), "N/A"),

    TotalValue, Qty * Price,
    FormattedDate, FormatEpochDateOnly(ReturnDate),

    Fin_Row, IF(UPPER(InvoiceAdjRequired) = "TRUE",
      RowFn({6, "Financial Adjustment Required"; 20, IF(UPPER(InvoiceAdjDone) = "TRUE", "Completed", "Pending") & IF(ConsumptionInvoice <> "", " / " & ConsumptionInvoice, "")}),
      RowFn({1, "DUMMY"})
    ),
    Wh_Row, IF(UPPER(WhActionRequired) = "TRUE",
      RowFn({6, "Warehouse Action Required"; 20, WarehouseName & " / " & IF(UPPER(WhActionCompleted) = "TRUE", "Completed", "Pending")}),
      RowFn({1, "DUMMY"})
    ),
    Cond_Rows, VSTACK(Fin_Row, Wh_Row),
    Filtered_Cond_Rows, IFERROR(FILTER(Cond_Rows, CHOOSECOLS(Cond_Rows, 1) <> "DUMMY"), RowFn({0, ""})),

    VSTACK(
      acc,
      RowFn({4, FormattedDate & " / " & ReturnCode & " / " & Username; 30, OrderProgress; 37, " "}),
      RowFn({5, Qty & "x"; 6, ItemDisplayName; 30, "Price: " & Price & ", Total: " & TotalValue}),
      RowFn({6, "Reason: " & Reason & IF(ReasonComment <> "", " / " & ReasonComment, "")}),
      Filtered_Cond_Rows,
      RowFn({0, ""})
    )
  ))),

  ReportData, IF(
    HasData,
    VSTACK(
      HeaderRows,
      CHOOSEROWS(DynamicPart, SEQUENCE(ROWS(DynamicPart) - 1, 1, 2))
    ),
    VSTACK(
      HeaderRows,
      RowFn({4, "No return records found for this outlet."})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula queries data from four spreadsheet files (`OutletFileID`, `ViewFileID`, `masterFileID`):
1. **`OutletReturns`** (`OutletReturns!A2:AB` in Outlet Spreadsheet):
   - Column 1 (`A`): Code
   - Column 2 (`B`): Outlet Code (filtered against `$AB$6`)
   - Column 3 (`C`): Date (sorted descending)
   - Column 4 (`D`): Username
   - Column 5 (`E`): SKU
   - Column 6 (`F`): Qty
   - Column 7 (`G`): Price
   - Column 10 (`J`): Invoice Adjustment Required
   - Column 11 (`K`): Invoice Adjustment Done
   - Column 12 (`L`): Consumption Invoice Code
   - Column 13 (`M`): Warehouse Action Required
   - Column 14 (`N`): Warehouse Action Completed
   - Column 15 (`O`): Warehouse Code
   - Column 16 (`P`): Warehouse Action (`"Stocked"`, `"Disposed"`)
   - Column 23 (`W`): Status (`"Active"`)
2. **`Outlets`** (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name
3. **`SKU`** (`SKU!A2:G` in Views Spreadsheet):
   - Column 1 (`A`): SKU Code
   - Column 2 (`B`): SKUCode
   - Column 4 (`D`): Product Name
   - Column 6 (`F`): Variant Values
4. **`Warehouses`** (`Warehouses!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Warehouse Code
   - Column 2 (`B`): Warehouse Name

---

## Detailed Logic Breakdown

1. **Outlet Filter & Sorting**: Filters `OutletReturns` where the OutletCode matches `$AB$6` and the status is `"Active"`. It then sorts these records descending by the return date (Col 3).
2. **Recent 12 Selection**: Slices the top 12 rows of sorted return records using `CHOOSEROWS`.
3. **Registry Lookup**: Resolves the Outlet Name from `Outlets` based on `$AB$6`.
4. **Header Alignment (Column Intent)**:
   - Row 10 (Metadata Header): Displays the raw Outlet Name (Column D, index 4) without prefix and Document Generation Date (Column AD, index 30) formatted as `yyyy-mm-dd` using `TEXT(NOW(), "yyyy-mm-dd")`.
5. **Multi-line Record Layout (Column Intent)**:
   - For each return record, details are distributed over multiple lines:
     - **Line 1 (Heading Anchor)**: Placed in Column D (index 4) containing the formatted Return Date, Code, and Username (`FormattedDate & " / " & ReturnCode & " / " & Username`) to serve as a conditional formatting anchor, and the order Progress in Column AD (index 30). In Column AK (index 37), a space `" "` is placed to act as a text-clipping blocker for progress text.
     - **Line 2 (Product Row)**: Displays the Qty with suffix `"x"` in Column E (index 5), the Product Name/variant info in Column F (index 6), and the price detail (`Price: <Price>, Total: <Total>`) in Column AD (index 30). Warehouse details are not printed here.
     - **Line 3 (Reason Row)**: Displays the combined reason and comment string starting at Column F (index 6) as `"Reason: " & Reason & " / " & Comment` (if present).
     - **Lines 4 & 5 (Conditional Rows)**:
       - **Financial Adjustment Row**: Placed in Column F (index 6) (`Financial Adjustment Required`) and Column T (index 20) (`<Progress> / <InvCode>` if done, or `<Progress>` if pending). Rendered *only* if required.
       - **Warehouse Action Row**: Placed in Column F (index 6) (`Warehouse Action Required`) and Column T (index 20) (`<WHName> / <WH Progress>`). Rendered *only* if required.
       - Stacking filters out empty rows using a `"DUMMY"` tag logic.
   - Stacks the headers and dynamic rows into a 39-column wide report array.
