# ProductReturnHistory Report

The **ProductReturnHistory Report** formats and displays a historical log of the 12 most recent sales return records for a specific parent Product. The layout distributes record details over multiple lines to accommodate all attributes cleanly without exceeding standard width, and places a date-anchored record heading in Column D (index 4) for clear row conditional formatting separation.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: Cell **`$AB$6`** (Product Code). The formula reads `$AB$6` to filter returns matching any SKU belonging to that parent product.
- **Purpose**: Generates a dynamic log of the 12 most recent returns of the product. If `$AB$6` is blank or matches no records, it outputs a default header and a warning message.

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

  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  ProductCodesInSKUs, TOCOL(CHOOSECOLS(RawSKUs, 3)),
  ProductNamesInSKUs, TOCOL(CHOOSECOLS(RawSKUs, 4)),

  ProductName, IFERROR(XLOOKUP($AB$6, ProductCodesInSKUs, ProductNamesInSKUs, "Unknown Product"), "Unknown Product"),

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),
  WarehouseCodes, TOCOL(CHOOSECOLS(RawWarehouses, 1)),
  WarehouseNames, TOCOL(CHOOSECOLS(RawWarehouses, 2)),

  ReturnCodes, TOCOL(CHOOSECOLS(RawReturns, 1)),
  OutletCodesInReturns, TOCOL(CHOOSECOLS(RawReturns, 2)),
  DatesInReturns, TOCOL(CHOOSECOLS(RawReturns, 3)),
  SKUCodesInReturns, TOCOL(CHOOSECOLS(RawReturns, 5)),
  StatusInReturns, TOCOL(CHOOSECOLS(RawReturns, 23)),

  ProductCodesInReturns, MAP(SKUCodesInReturns, LAMBDA(sku, IFERROR(XLOOKUP(sku, SKU_Codes, ProductCodesInSKUs, ""), ""))),

  FilteredReturns, IFERROR(FILTER(RawReturns, (ProductCodesInReturns = $AB$6) * (StatusInReturns = "Active")), ""),
  HasData, AND(NOT(ISERR(FilteredReturns)), CHOOSEROWS(CHOOSECOLS(FilteredReturns, 1), 1) <> ""),

  SortedReturns, IF(HasData, SORT(FilteredReturns, 3, FALSE), MAKEARRAY(1, 28, LAMBDA(r, c, ""))),
  RecentReturns, IF(HasData, CHOOSEROWS(SortedReturns, SEQUENCE(MIN(12, ROWS(SortedReturns)))), MAKEARRAY(1, 28, LAMBDA(r, c, ""))),

  FormattedNow, TEXT(NOW(), "yyyy-mm-dd"),

  HeaderRows, VSTACK(
    RowFn({4, ProductName; 30, FormattedNow}),
    RowFn({0, ""})
  ),

  DummyRow, RowFn({0, "DUMMY"}),

  DynamicPart, REDUCE(DummyRow, SEQUENCE(IF(HasData, ROWS(RecentReturns), 1)), LAMBDA(acc, k, LET(
    row_arr, CHOOSEROWS(RecentReturns, k),
    
    ReturnCode, CHOOSEROWS(CHOOSECOLS(row_arr, 1), 1),
    OutletCode, CHOOSEROWS(CHOOSECOLS(row_arr, 2), 1),
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

    OutletName, IFERROR(XLOOKUP(OutletCode, OutletCodes, OutletNames, OutletCode), OutletCode),

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
      RowFn({4, FormattedDate & " / " & ReturnCode & " / " & OutletName & " / " & Username; 30, OrderProgress; 37, " "}),
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
      RowFn({4, "No return records found for this product."})
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
   - Column 2 (`B`): Outlet Code (resolved to Outlet Name)
   - Column 3 (`C`): Date (sorted descending)
   - Column 4 (`D`): Username
   - Column 5 (`E`): SKU (used to map SKU to its parent Product Code)
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
   - Column 3 (`C`): ProductCode (used to filter returns by parent Product Code)
   - Column 4 (`D`): Product Name
   - Column 6 (`F`): Variant Values
4. **`Warehouses`** (`Warehouses!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Warehouse Code
   - Column 2 (`B`): Warehouse Name

---

## Detailed Logic Breakdown

1. **Product Resolution**:
   - Resolves the Product Name (`ProductName`) from the `SKU` view by doing an `XLOOKUP` of `$AB$6` (Product Code) in the `ProductCodesInSKUs` column.
2. **Product SKU Mapping**:
   - Compares the SKU code of each return record in `OutletReturns` with the SKU-to-ProductCode mapping inside the `SKU` view, generating a virtual list `ProductCodesInReturns`.
   - Filters return records where `ProductCodesInReturns` equals the target `$AB$6` and the return record's status is `"Active"`.
3. **Chronological Sorting & Recent Selection**:
   - Sorts the filtered returns descending by return date (Col 3).
   - Selects the top 12 rows of return records using `CHOOSEROWS`.
4. **Header Alignment (Column Intent)**:
   - Row 10 (Metadata Header): Displays the resolved Product Name in Column D (index 4) and the Document Generation Date in Column AD (index 30).
5. **Multi-line Record Layout (Column Intent)**:
   - For each matching return, a details card is stacked:
     - **Line 1 (Heading Anchor)**: Date, Code, Outlet Name, and Username string in Column D (index 4) to act as a formatting anchor. Column AD (index 30) contains the return Progress, and Column AK (index 37) has a single space `" "` to clip text.
     - **Line 2 (Product Row)**: Displays the Qty in Column E (index 5), SKU Name/variants in Column F (index 6), and price details in Column AD (index 30).
     - **Line 3 (Reason Row)**: Displays Reason and Comment in Column F (index 6).
     - **Lines 4 & 5 (Conditional Rows)**:
       - **Financial Adjustment Row**: Rendered if adjustment is required.
       - **Warehouse Action Row**: Rendered if warehouse action is required.
