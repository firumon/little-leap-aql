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
  MasterFileID, IFERROR(VLOOKUP("MasterFileID", Config!A:B, 2, 0), VLOOKUP("masterFileID", Config!A:B, 2, 0)),
  OutletFileID, IFERROR(VLOOKUP("OutletFileID", Config!A:B, 2, 0), VLOOKUP("OperationFileID", Config!A:B, 2, 0)),

  RawReturns, IMPORTRANGE(OutletFileID, "OutletReturns!A2:AD"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),
  RawSKUs, IMPORTRANGE(MasterFileID, "SKUs!A2:B"),
  RawProducts, IMPORTRANGE(MasterFileID, "Products!A2:B"),
  RawWarehouses, IMPORTRANGE(MasterFileID, "Warehouses!A2:B"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
  FormatEpochDateOnly, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(TRIM(val) = "", "", IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd"), IFERROR(TEXT(INT(val), "yyyy-mm-dd"), IFERROR(TEXT(DATEVALUE(LEFT(val, 10)), "yyyy-mm-dd"), val)))))),

  ReturnCodes, TOCOL(CHOOSECOLS(RawReturns, 1)),
  OutletCodesInReturns, TOCOL(CHOOSECOLS(RawReturns, 2)),
  DatesInReturns, TOCOL(CHOOSECOLS(RawReturns, 3)),
  StatusInReturns, TOCOL(CHOOSECOLS(RawReturns, 24)),

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),
  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  SKU_ProdCodes, TOCOL(CHOOSECOLS(RawSKUs, 2)),
  Product_Codes, TOCOL(CHOOSECOLS(RawProducts, 1)),
  Product_Names, TOCOL(CHOOSECOLS(RawProducts, 2)),
  WarehouseCodes, TOCOL(CHOOSECOLS(RawWarehouses, 1)),
  WarehouseNames, TOCOL(CHOOSECOLS(RawWarehouses, 2)),

  CleanInput, TRIM($AB$6),
  HasInput, AND(CleanInput <> "", CleanInput <> "#N/A"),

  OutletName, IF(HasInput, IFERROR(XLOOKUP(CleanInput, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"), ""),
  FormattedNow, TEXT(NOW(), "yyyy-mm-dd"),

  HeaderRows, VSTACK(
    RowFn({4, OutletName; 30, FormattedNow}),
    RowFn({0, ""})
  ),

  FilteredReturns, IF(HasInput, IFERROR(FILTER(RawReturns, OutletCodesInReturns = CleanInput, StatusInReturns = "Active"), ""), ""),
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

          p_code, IFERROR(XLOOKUP(SKUCode, SKU_Codes, SKU_ProdCodes, ""), ""),
          p_name, IFERROR(XLOOKUP(p_code, Product_Codes, Product_Names, ""), ""),
          ItemDisplayName, IF(p_name <> "", p_name & " (" & SKUCode & ")", SKUCode),

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
    RowFn({4, IF(HasInput, "No return records found for this outlet.", "Please enter an Outlet Code in cell AB6.")})
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
   - Column 2 (`B`): Outlet Code (filtered against `$AB$6`)
   - Column 3 (`C`): Date (sorted descending)
   - Column 4 (`D`): Username
   - Column 5 (`E`): SKU
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
3. **`Warehouses`** (`Warehouses!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Warehouse Code
   - Column 2 (`B`): Warehouse Name
4. **`SKUs`** (`SKUs!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): SKU Code
   - Column 2 (`B`): Product Code
5. **`Products`** (`Products!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Product Code
   - Column 2 (`B`): Product Name

---

## Detailed Logic Breakdown

1. **Outlet Filter & Sorting**: Filters `OutletReturns` where the OutletCode matches trimmed `$AB$6` and the status is `"Active"` (Column 24). It then sorts these records descending by the return date (Col 3).
2. **Recent 12 Selection**: Slices the top 12 rows of sorted return records using `CHOOSEROWS`.
3. **Registry Lookup**: Resolves the Outlet Name from `Outlets` based on `$AB$6`. Product details are resolved directly from `Products` and `SKUs` in the Master spreadsheet.
4. **Header Alignment (Column Intent)**:
   - Row 10 (Metadata Header): Displays the raw Outlet Name (Column D, index 4) without prefix and Document Generation Date (Column AD, index 30) formatted as `yyyy-mm-dd` using `TEXT(NOW(), "yyyy-mm-dd")`.
5. **Multi-line Record Layout (Column Intent)**:
   - For each return record, details are distributed over multiple lines:
     - **Line 1 (Heading Anchor)**: Placed in Column D (index 4) containing the formatted Return Date, Code, and Username (`FormattedDate & " / " & ReturnCode & " / " & Username`) to serve as a conditional formatting anchor, and the order Progress in Column AD (index 30). In Column AK (index 37), a space `" "` is placed to act as a text-clipping blocker for progress text.
     - **Line 2 (Product Row)**: Displays the Qty with suffix `"x"` in Column E (index 5), the Product Name/code info in Column F (index 6), and the price detail (`Price: <Price>, Total: <Total>`) in Column AD (index 30).
     - **Line 3 (Reason Row)**: Displays the combined reason and comment string starting at Column F (index 6) as `"Reason: " & Reason & " / " & Comment` (if present).
     - **Lines 4 & 5 (Conditional Rows)**:
       - **Financial Adjustment Row**: Placed in Column F (index 6) (`Financial Adjustment Required`) and Column T (index 20) (`<Status> / <InvCode>` if done, or `<Status>` if pending). Rendered *only* if required.
       - **Warehouse Action Row**: Placed in Column F (index 6) (`Warehouse Action Required`) and Column T (index 20) (`<WHName> / <WH Status>`). Rendered *only* if required.
   - Stacks the headers and dynamic rows into a clean 39-column wide report array without dummy rows.
