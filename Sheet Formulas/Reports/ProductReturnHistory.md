# ProductReturnHistory Report

The **ProductReturnHistory Report** formats and displays a historical log of the 12 most recent sales return records for a specific parent Product. The layout distributes record details over multiple lines to accommodate all attributes cleanly without exceeding standard width, and places a date-anchored record heading in Column D (index 4) for clear row conditional formatting separation.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: Cell **`$AB$6`** (Product Code, Product Name, or SKU Code).
- **Purpose**: Generates a dynamic log of the 12 most recent returns of the product. If `$AB$6` is blank or matches no records, it outputs a default header and a warning message.

---

## Google Sheet Formula

```excel
=LET(
  MasterFileID, IFERROR(VLOOKUP("MasterFileID", Config!A:B, 2, 0), VLOOKUP("masterFileID", Config!A:B, 2, 0)),
  OutletFileID, IFERROR(VLOOKUP("OutletFileID", Config!A:B, 2, 0), VLOOKUP("OperationFileID", Config!A:B, 2, 0)),

  RawReturns, IMPORTRANGE(OutletFileID, "OutletReturns!A2:AD"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),
  RawSKUs, IMPORTRANGE(MasterFileID, "SKUs!A2:C"),
  RawProducts, IMPORTRANGE(MasterFileID, "Products!A2:B"),
  RawWarehouses, IMPORTRANGE(MasterFileID, "Warehouses!A2:B"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
  FormatEpochDateOnly, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(TRIM(val) = "", "", IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd"), IFERROR(TEXT(INT(val), "yyyy-mm-dd"), IFERROR(TEXT(DATEVALUE(LEFT(val, 10)), "yyyy-mm-dd"), val)))))),

  Product_Codes, TOCOL(CHOOSECOLS(RawProducts, 1)),
  Product_Names, TOCOL(CHOOSECOLS(RawProducts, 2)),

  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  SKU_ProdCodes, TOCOL(CHOOSECOLS(RawSKUs, 2)),
  SKU_Variants, TOCOL(CHOOSECOLS(RawSKUs, 3)),

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),
  WarehouseCodes, TOCOL(CHOOSECOLS(RawWarehouses, 1)),
  WarehouseNames, TOCOL(CHOOSECOLS(RawWarehouses, 2)),

  CleanInput, TRIM($AB$6),
  HasInput, AND(CleanInput <> "", CleanInput <> "#N/A"),

  ProdByCode, IFERROR(XLOOKUP(CleanInput, Product_Codes, Product_Codes, ""), ""),
  ProdByName, IFERROR(XLOOKUP(CleanInput, Product_Names, Product_Codes, ""), ""),
  ProdBySku, IFERROR(XLOOKUP(CleanInput, SKU_Codes, SKU_ProdCodes, ""), ""),
  TargetProdCode, IF(ProdByCode <> "", ProdByCode, IF(ProdByName <> "", ProdByName, IF(ProdBySku <> "", ProdBySku, CleanInput))),

  ProductName, IF(HasInput, IFERROR(XLOOKUP(TargetProdCode, Product_Codes, Product_Names, CleanInput), CleanInput), "Unknown Product"),
  FormattedNow, TEXT(NOW(), "yyyy-mm-dd"),

  HeaderRows, VSTACK(
    RowFn({4, ProductName; 30, FormattedNow}),
    RowFn({0, ""})
  ),

  ReturnsWithData, IFERROR(FILTER(RawReturns, INDEX(RawReturns, 0, 1) <> ""), ""),
  HasAnyReturns, AND(INDEX(ReturnsWithData, 1, 1) <> "", INDEX(ReturnsWithData, 1, 1) <> "#N/A"),

  ReturnSKUs, IF(HasAnyReturns, TOCOL(CHOOSECOLS(ReturnsWithData, 5)), ""),
  ReturnStatuses, IF(HasAnyReturns, TOCOL(CHOOSECOLS(ReturnsWithData, 24)), ""),

  IsMatchProduct, IF(
    HasAnyReturns,
    MAP(ReturnSKUs, LAMBDA(sku,
      LET(
        clean_sku, TRIM(sku),
        prod_from_sku, IFERROR(TRIM(XLOOKUP(clean_sku, SKU_Codes, SKU_ProdCodes, "")), ""),
        OR(clean_sku = TargetProdCode, prod_from_sku = TargetProdCode)
      )
    )),
    FALSE
  ),

  IsActiveStatus, IF(
    HasAnyReturns,
    MAP(ReturnStatuses, LAMBDA(st, UPPER(TRIM(st)) = "ACTIVE")),
    FALSE
  ),

  FilteredReturns, IF(
    AND(HasInput, HasAnyReturns),
    IFERROR(FILTER(ReturnsWithData, IsMatchProduct, IsActiveStatus), ""),
    ""
  ),
  HasData, AND(HasInput, INDEX(FilteredReturns, 1, 1) <> "", INDEX(FilteredReturns, 1, 1) <> "#N/A"),

  SortedReturns, IF(HasData, IFERROR(SORT(FilteredReturns, 3, FALSE), FilteredReturns), FilteredReturns),
  LimitRows, IF(HasData, MIN(12, ROWS(SortedReturns)), 0),
  RecentReturns, IF(LimitRows > 0, CHOOSEROWS(SortedReturns, SEQUENCE(LimitRows)), SortedReturns),

  DynamicPart, IF(
    LimitRows > 0,
    REDUCE(
      IFERROR(1/0, ""),
      SEQUENCE(LimitRows),
      LAMBDA(acc, k,
        LET(
          row_arr, CHOOSEROWS(RecentReturns, k),

          ReturnCode, INDEX(row_arr, 1, 1),
          OutletCode, INDEX(row_arr, 1, 2),
          ReturnDate_raw, INDEX(row_arr, 1, 3),
          Username, INDEX(row_arr, 1, 4),
          SKUCode, INDEX(row_arr, 1, 5),
          Qty, INDEX(row_arr, 1, 6),
          Price, INDEX(row_arr, 1, 7),
          Reason, INDEX(row_arr, 1, 8),
          ReasonComment, INDEX(row_arr, 1, 9),
          InvoiceAdjRequired, INDEX(row_arr, 1, 10),
          InvoiceAdjDone, INDEX(row_arr, 1, 11),
          ConsumptionInvoice, INDEX(row_arr, 1, 12),
          SourceInvoice, INDEX(row_arr, 1, 13),
          WhActionRequired, INDEX(row_arr, 1, 14),
          WhActionCompleted, INDEX(row_arr, 1, 15),
          WhCode, INDEX(row_arr, 1, 16),
          WhAction, INDEX(row_arr, 1, 17),
          OrderProgress, INDEX(row_arr, 1, 23),

          OutletName, IFERROR(XLOOKUP(OutletCode, OutletCodes, OutletNames, OutletCode), OutletCode),

          sku_variant, IFERROR(XLOOKUP(SKUCode, SKU_Codes, SKU_Variants, ""), ""),
          ItemDisplayName, SKUCode & IF(sku_variant <> "", " / " & sku_variant, ""),

          WarehouseName, IF(WhCode <> "", IFERROR(XLOOKUP(WhCode, WarehouseCodes, WarehouseNames, WhCode), WhCode), "N/A"),

          TotalValue, IFERROR(Qty * Price, 0),
          FormattedDate, FormatEpochDateOnly(ReturnDate_raw),

          Fin_Needed, OR(UPPER(TRIM(InvoiceAdjRequired)) = "TRUE", InvoiceAdjRequired = TRUE),
          Wh_Needed, OR(UPPER(TRIM(WhActionRequired)) = "TRUE", WhActionRequired = TRUE),

          Fin_Done, OR(UPPER(TRIM(InvoiceAdjDone)) = "TRUE", InvoiceAdjDone = TRUE),
          Wh_Done, OR(UPPER(TRIM(WhActionCompleted)) = "TRUE", WhActionCompleted = TRUE),

          Fin_Row, RowFn({6, "Financial Adjustment Required"; 20, IF(Fin_Done, "Completed", "Pending") & IF(ConsumptionInvoice <> "", " / " & ConsumptionInvoice, "")}),
          Wh_Row, RowFn({6, "Warehouse Action Required"; 20, WarehouseName & " / " & IF(Wh_Done, "Completed", "Pending")}),

          Base_Rows, VSTACK(
            RowFn({4, FormattedDate & " / " & ReturnCode & " / " & Username; 30, OrderProgress; 37, " "}),
            RowFn({4, OutletName}),
            RowFn({5, Qty & "x"; 6, ItemDisplayName; 30, "Price: " & Price & ", Total: " & TotalValue}),
            RowFn({6, "Reason: " & Reason & IF(TRIM(ReasonComment) <> "", " / " & ReasonComment, "")})
          ),

          curr_block, IF(
            AND(Fin_Needed, Wh_Needed),
            VSTACK(Base_Rows, Fin_Row, Wh_Row, RowFn({0, ""})),
            IF(
              Fin_Needed,
              VSTACK(Base_Rows, Fin_Row, RowFn({0, ""})),
              IF(
                Wh_Needed,
                VSTACK(Base_Rows, Wh_Row, RowFn({0, ""})),
                VSTACK(Base_Rows, RowFn({0, ""}))
              )
            )
          ),

          IF(k = 1, curr_block, VSTACK(acc, curr_block))
        )
      )
    ),
    RowFn({4, IF(HasInput, "No return records found for this product.", "Please enter a Product Code in cell AB6.")})
  ),

  ReportData, VSTACK(HeaderRows, DynamicPart),
  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula queries data from two spreadsheet files (`OutletFileID` and `MasterFileID`):
1. **`OutletReturns`** (`OutletReturns!A2:AD` in Outlet Spreadsheet):
   - Column 1 (`A`): Code
   - Column 2 (`B`): Outlet Code (resolved to Outlet Name)
   - Column 3 (`C`): Date (sorted descending)
   - Column 4 (`D`): Username
   - Column 5 (`E`): SKU (matched directly or mapped to parent Product Code)
   - Column 6 (`F`): Qty
   - Column 7 (`G`): Price
   - Column 8 (`H`): Reason
   - Column 9 (`I`): Reason Comment
   - Column 10 (`J`): Invoice Adjustment Required
   - Column 11 (`K`): Invoice Adjustment Done
   - Column 12 (`L`): Consumption Invoice Code
   - Column 13 (`M`): Source Invoice Code
   - Column 14 (`N`): Warehouse Action Required
   - Column 15 (`O`): Warehouse Action Completed
   - Column 16 (`P`): Warehouse Code
   - Column 17 (`Q`): Warehouse Action (`"Stocked"`, `"Disposed"`)
   - Column 23 (`W`): Progress status (`"SUBMITTED"`, `"COMPLETED"`, `"CANCELLED"`, etc.)
   - Column 24 (`X`): Status (`"Active"`)
2. **`Outlets`** (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name
3. **`SKUs`** (`SKUs!A2:C` in Master Spreadsheet):
   - Column 1 (`A`): SKU Code
   - Column 2 (`B`): Product Code
   - Column 3 (`C`): Variant 1
4. **`Products`** (`Products!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Product Code
   - Column 2 (`B`): Product Name
5. **`Warehouses`** (`Warehouses!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Warehouse Code
   - Column 2 (`B`): Warehouse Name

---

## Detailed Logic Breakdown

1. **Target Product Resolution**: Resolves `$AB$6` to the canonical Product Code whether the user inputs a Product Code, Product Name, or SKU Code.
2. **Product SKU Mapping & Filtering**:
   - Cleans blank rows from `OutletReturns`.
   - Compares each return's SKU code with `TargetProdCode` (either direct code match or mapped parent product code).
   - Filters records matching the product and having an active status (Col 24).
3. **Chronological Sorting & Recent Selection**:
   - Sorts the filtered returns descending by return date (Col 3).
   - Selects the top 12 rows of return records using `CHOOSEROWS`.
4. **Header Alignment (Column Intent)**:
   - Row 10 (Metadata Header): Displays the resolved Product Name in Column D (index 4) and the Document Generation Date in Column AD (index 30).
5. **Multi-line Record Layout (Column Intent)**:
   - For each matching return, a details block is generated without dummy rows:
     - **Line 1 (Heading Anchor)**: Date, Code, and Username string in Column D (index 4). Column AD (index 30) contains the return Progress, and Column AK (index 37) has a single space `" "` to clip text.
     - **Line 2 (Outlet Name)**: Displays the name of the returning Outlet starting in Column D (index 4).
     - **Line 3 (Product Line)**: Displays the Qty in Column E (index 5), formatted SKU code with variant values in Column F (index 6), and price details in Column AD (index 30).
     - **Line 4 (Reason Row)**: Displays Reason and Comment in Column F (index 6).
     - **Lines 5 & 6 (Conditional Rows)**:
       - **Financial Adjustment Row**: Rendered if adjustment is required.
       - **Warehouse Action Row**: Rendered if warehouse action is required.
