# ReturnRecords Report

The **ReturnRecords Report** provides a filtered search and checklist log for Outlet Returns. It filters return records by username, date, and return reason, sorting by date descending, and displays item details, adjustment statuses, and warehouse processing details for each return.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A15`
- **User Input Dependencies**:
  - Cell **`$J$11`**: Username Filter (supports specific username or `"Any User"` / blank for no filter).
  - Cell **`$J$12`**: Return Date Filter (supports specific date or `"All Date"` / blank for no filter).
  - Cell **`$J$13`**: Return Reason Filter (supports specific reason or `"Any Reason"` / blank for no filter).
- **Default Behavior**: If no filters are active, the report displays the **latest 15 return records**.

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

  UserFilter, IF(OR($J$11 = "", $J$11 = "Any User"), "", TRIM($J$11)),
  DateFilter, IF(OR($J$12 = "", $J$12 = "All Date", $J$12 = "Any Date"), "", $J$12),
  ReasonFilter, IF(OR($J$13 = "", $J$13 = "Any Reason", $J$13 = "All Reason"), "", TRIM($J$13)),

  HasInput, OR(UserFilter <> "", DateFilter <> "", ReasonFilter <> ""),

  FilterDateSerial, IFERROR(INT(DateFilter), IFERROR(DATEVALUE(LEFT(DateFilter, 10)), 0)),

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),
  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  SKU_ProdCodes, TOCOL(CHOOSECOLS(RawSKUs, 2)),
  Product_Codes, TOCOL(CHOOSECOLS(RawProducts, 1)),
  Product_Names, TOCOL(CHOOSECOLS(RawProducts, 2)),
  WarehouseCodes, TOCOL(CHOOSECOLS(RawWarehouses, 1)),
  WarehouseNames, TOCOL(CHOOSECOLS(RawWarehouses, 2)),

  ReturnsWithData, IFERROR(FILTER(RawReturns, INDEX(RawReturns, 0, 1) <> ""), ""),
  HasAnyReturns, AND(INDEX(ReturnsWithData, 1, 1) <> "", INDEX(ReturnsWithData, 1, 1) <> "#N/A"),

  UserMatch, IF(UserFilter = "", TRUE, MAP(INDEX(ReturnsWithData, 0, 4), LAMBDA(u, TRIM(u) = UserFilter))),
  DateMatch, IF(DateFilter = "", TRUE, MAP(INDEX(ReturnsWithData, 0, 3), LAMBDA(d, IFERROR(INT(d), IFERROR(DATEVALUE(LEFT(d, 10)), -1)) = FilterDateSerial))),
  ReasonMatch, IF(ReasonFilter = "", TRUE, MAP(INDEX(ReturnsWithData, 0, 8), LAMBDA(r, UPPER(TRIM(r)) = UPPER(ReasonFilter)))),
  StatusMatch, MAP(INDEX(ReturnsWithData, 0, 24), LAMBDA(st, UPPER(TRIM(st)) = "ACTIVE")),

  Filtered, IF(
    HasAnyReturns,
    IF(
      HasInput,
      IFERROR(FILTER(ReturnsWithData, StatusMatch, UserMatch, DateMatch, ReasonMatch), ""),
      IFERROR(FILTER(ReturnsWithData, StatusMatch), "")
    ),
    ""
  ),
  HasData, AND(INDEX(Filtered, 1, 1) <> "", INDEX(Filtered, 1, 1) <> "#N/A"),

  SortedData, IF(HasData, IFERROR(SORT(Filtered, 3, FALSE), Filtered), Filtered),
  LimitRows, IF(NOT(HasData), 0, IF(HasInput, ROWS(SortedData), MIN(15, ROWS(SortedData)))),
  SortedDataLimited, IF(LimitRows > 0, CHOOSEROWS(SortedData, SEQUENCE(LimitRows)), SortedData),

  FallbackText, IF(HasInput, "No return records matched the selected filters.", "No active return records found."),

  DynamicPart, IF(
    LimitRows > 0,
    REDUCE(
      IFERROR(1/0, ""),
      SEQUENCE(LimitRows),
      LAMBDA(acc, k,
        LET(
          row_arr, CHOOSEROWS(SortedDataLimited, k),

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

          p_code, IFERROR(XLOOKUP(SKUCode, SKU_Codes, SKU_ProdCodes, ""), ""),
          p_name, IFERROR(XLOOKUP(p_code, Product_Codes, Product_Names, ""), ""),
          ItemDisplayName, IF(p_name <> "", p_name & " (" & SKUCode & ")", SKUCode),

          WarehouseName, IF(WhCode <> "", IFERROR(XLOOKUP(WhCode, WarehouseCodes, WarehouseNames, WhCode), WhCode), "N/A"),

          TotalValue, IFERROR(Qty * Price, 0),
          FormattedDate, FormatEpochDateOnly(ReturnDate_raw),

          Row_1, RowFn({4, FormattedDate & " / " & ReturnCode & " / " & Username; 30, OrderProgress; 37, " "}),
          Row_2, RowFn({4, OutletName}),
          Row_3, RowFn({5, Qty & "x"; 6, ItemDisplayName; 30, "Price: " & Price & ", Total: " & TotalValue}),
          Row_4, RowFn({6, "Reason: " & Reason & IF(TRIM(ReasonComment) <> "", " / " & ReasonComment, "")}),

          Fin_Needed, OR(UPPER(TRIM(InvoiceAdjRequired)) = "TRUE", InvoiceAdjRequired = TRUE),
          Wh_Needed, OR(UPPER(TRIM(WhActionRequired)) = "TRUE", WhActionRequired = TRUE),

          Fin_Done, OR(UPPER(TRIM(InvoiceAdjDone)) = "TRUE", InvoiceAdjDone = TRUE),
          Wh_Done, OR(UPPER(TRIM(WhActionCompleted)) = "TRUE", WhActionCompleted = TRUE),

          Fin_Row, RowFn({6, "Financial Adjustment Required"; 20, IF(Fin_Done, "Completed", "Pending") & IF(ConsumptionInvoice <> "", " / " & ConsumptionInvoice, "")}),
          Wh_Row, RowFn({6, "Warehouse Action Required"; 20, WarehouseName & " / " & IF(Wh_Done, "Completed", "Pending")}),

          Base_Rows, VSTACK(Row_1, Row_2, Row_3, Row_4),

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
    RowFn({4, FallbackText})
  ),

  ReportData, DynamicPart,
  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula queries data from two spreadsheet files (`OutletFileID` and `MasterFileID`):
1. **`OutletReturns`** (`OutletReturns!A2:AD` in Outlet Spreadsheet):
   - Column 1 (`A`): Code
   - Column 2 (`B`): Outlet Code (resolved to Outlet Name)
   - Column 3 (`C`): Date (filtered against `$J$12` and sorted descending)
   - Column 4 (`D`): Username (filtered against `$J$11`)
   - Column 5 (`E`): SKU
   - Column 6 (`F`): Qty
   - Column 7 (`G`): Price
   - Column 8 (`H`): Reason (filtered against `$J$13`)
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

1. **User Filter Inputs**: Resolves search filters from cells `$J$11` (Username), `$J$12` (Date), and `$J$13` (Reason). Default values like `"Any User"`, `"All Date"`, or `"Any Reason"` are treated as inactive filters.
2. **Dynamic Filtering**:
   - Cleans blank rows from `OutletReturns`.
   - Filters active records (Col 24 = `"Active"`) matching all specified search filters with native boolean arguments.
   - If no filters are active, all active return records are processed.
3. **Sorting & Limits**:
   - Sorts records descending by return date (Col 3).
   - If search filters are active, lists all matching records. If no filters are active, limits output to the **latest 15 rows**.
4. **Stacked Record Reduction**:
   - Loops through each returned record without dummy rows:
     - Row 1: Displays return date, transaction code, and requesting user at Column D (index 4), and Progress at Column AD (index 30).
     - Row 2: Displays Outlet Name starting at Column D (index 4).
     - Row 3: Displays item quantity at Column E (index 5), product display name starting at Column F (index 6), and price/totals at Column AD (index 30).
     - Row 4: Displays the return reason and comments starting at Column F (index 6).
     - Rows 5 & 6 (Conditional): Displays financial adjustment and warehouse action rows if required.
     - Separates each return log with a spacer row.
