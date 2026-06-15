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

  UserFilter, IF(OR($J$11 = "", $J$11 = "Any User"), "", $J$11),
  DateFilter, IF(OR($J$12 = "", $J$12 = "All Date"), "", $J$12),
  ReasonFilter, IF(OR($J$13 = "", $J$13 = "Any Reason"), "", $J$13),

  HasInput, OR(UserFilter <> "", DateFilter <> "", ReasonFilter <> ""),

  ReturnCodes, TOCOL(CHOOSECOLS(RawReturns, 1)),
  OutletCodesInReturns, TOCOL(CHOOSECOLS(RawReturns, 2)),
  DatesInReturns, TOCOL(CHOOSECOLS(RawReturns, 3)),
  UsernamesInReturns, TOCOL(CHOOSECOLS(RawReturns, 4)),
  SKUsInReturns, TOCOL(CHOOSECOLS(RawReturns, 5)),
  QtysInReturns, TOCOL(CHOOSECOLS(RawReturns, 6)),
  PricesInReturns, TOCOL(CHOOSECOLS(RawReturns, 7)),
  ReasonsInReturns, TOCOL(CHOOSECOLS(RawReturns, 8)),
  StatusInReturns, TOCOL(CHOOSECOLS(RawReturns, 23)),

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),
  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  WarehouseCodes, TOCOL(CHOOSECOLS(RawWarehouses, 1)),
  WarehouseNames, TOCOL(CHOOSECOLS(RawWarehouses, 2)),

  ParsedDates, MAP(DatesInReturns, LAMBDA(d, IFERROR(IF(ISNUMBER(d), d, DATEVALUE(LEFT(d, 10))), 0))),
  ParsedDateFilter, IFERROR(IF(ISNUMBER(DateFilter), DateFilter, DATEVALUE(LEFT(DateFilter, 10))), 0),

  Filtered, IFERROR(
    FILTER(
      RawReturns,
      (StatusInReturns = "Active") *
      (IF(
        HasInput,
        ((UserFilter = "") + (UsernamesInReturns = UserFilter)) *
        ((DateFilter = "") + (ParsedDates = ParsedDateFilter)) *
        ((ReasonFilter = "") + (ReasonsInReturns = ReasonFilter)),
        SEQUENCE(ROWS(RawReturns))*0 + 1
      ))
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

  LimitRows, IF(HasInput, ROWS(SortedData), MIN(15, ROWS(SortedData))),
  SortedDataLimited, CHOOSEROWS(SortedData, SEQUENCE(LimitRows)),

  S_Idx, TOCOL(CHOOSECOLS(SortedDataLimited, 1)),

  DummyRow, RowFn({0, "DUMMY"}),

  DynamicPart, REDUCE(DummyRow, SEQUENCE(LimitRows), LAMBDA(acc, k, LET(
    idx, CHOOSEROWS(S_Idx, k),
    row_arr, CHOOSEROWS(Filtered, idx),

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

    OutletName, IFERROR(XLOOKUP(OutletCode, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"),

    SKU_Row, XLOOKUP(SKUCode, SKU_Codes, RawSKUs, MAKEARRAY(1, 7, LAMBDA(r, c, ""))),
    ProdName, CHOOSEROWS(CHOOSECOLS(SKU_Row, 4), 1),
    SKU_Code_Val, CHOOSEROWS(CHOOSECOLS(SKU_Row, 2), 1),
    VarValues, CHOOSEROWS(CHOOSECOLS(SKU_Row, 6), 1),
    ItemNameSuffix, IF(VarValues <> "", VarValues, SKU_Code_Val),
    ItemDisplayName, ProdName & IF(AND(ItemNameSuffix <> "", ItemNameSuffix <> SKUCode), " - " & ItemNameSuffix, "") & " (" & SKUCode & ")",

    WarehouseName, IF(WhCode <> "", IFERROR(XLOOKUP(WhCode, WarehouseCodes, WarehouseNames, WhCode), WhCode), "N/A"),

    TotalValue, Qty * Price,
    FormattedDate, FormatEpochDateOnly(ReturnDate),

    Row_1, RowFn({4, FormattedDate & " / " & ReturnCode & " / " & Username; 30, OrderProgress; 37, " "}),
    Row_2, RowFn({4, OutletName}),
    Row_3, RowFn({5, Qty & "x"; 6, ItemDisplayName; 30, "Price: " & Price & ", Total: " & TotalValue}),
    Row_4, RowFn({6, "Reason: " & Reason & IF(ReasonComment <> "", " / " & ReasonComment, "")}),

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
      Row_1,
      Row_2,
      Row_3,
      Row_4,
      Filtered_Cond_Rows,
      RowFn({0, ""})
    )
  ))),

  FallbackText, IF(HasInput, "No return records matched the selected filters.", "No active return records found."),

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
1. **`OutletReturns`** (`OutletReturns!A2:AB` in Outlet Spreadsheet):
   - Column 1 (`A`): Code
   - Column 2 (`B`): Outlet Code
   - Column 3 (`C`): Date
   - Column 4 (`D`): Username
   - Column 5 (`E`): SKU
   - Column 6 (`F`): Qty
   - Column 7 (`G`): Price
   - Column 8 (`H`): Reason
   - Column 9 (`I`): Reason Comment
   - Column 10 (`J`): Invoice Adjustment Required
   - Column 11 (`K`): Invoice Adjustment Done
   - Column 12 (`L`): Consumption Invoice Code
   - Column 13 (`M`): Warehouse Action Required
   - Column 14 (`N`): Warehouse Action Completed
   - Column 15 (`O`): Warehouse Code
   - Column 16 (`P`): Warehouse Action (`"Stocked"`, `"Disposed"`)
   - Column 22 (`V`): Progress status (`"SUBMITTED"`, `"COMPLETED"`, `"CANCELLED"`)
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

1. **User Filter Inputs**: Resolves search filters from cells `$J$11` (Username), `$J$12` (Date), and `$J$13` (Reason). If set to defaults (`"Any User"`, `"All Date"`, or `"Any Reason"`), they are treated as empty.
2. **Dynamic Filtering**:
   - Parses date fields into standard serial numbers.
   - Filters `OutletReturns` where the row status is `"Active"` and matches all provided filter inputs.
3. **Sorting & Slicing**:
   - Sorts results descending by return date.
   - If no search filters are active, limits the output array to the **latest 15 rows**.
4. **Stacked Record Reduction**:
   - Loops through each returned record.
   - Row 1: Displays return date, transaction code, and requesting user at Column D (index 4).
   - Row 2: Displays Outlet Name starting at Column D (index 4).
   - Row 3: Displays item quantity at Column E (index 5), formatted display name starting at Column F (index 6), and pricing/totals at Column AD (index 30).
   - Row 4: Displays the return reason and comments starting at Column F (index 6).
   - Stacks financial adjustment and warehouse processing status lines conditionally.
   - Separates each return log with a spacer row.
