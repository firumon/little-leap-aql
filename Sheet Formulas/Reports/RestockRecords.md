# RestockRecords Report

The **RestockRecords Report** provides a filtered search and listing tool for Restock Orders. It applies user, date, and progress filters to display a list of restocks, with child items nested under each restock order.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A15`
- **User Input Dependencies**:
  - Cell **`$J$11`**: Requesting User Filter (supports specific username or `"Any User"` / blank for no filter).
  - Cell **`$J$12`**: Restock Date Filter (supports specific date or `"Any Date"` / blank for no filter).
  - Cell **`$J$13`**: Order Progress Filter (supports specific status like `"DRAFT"`, `"APPROVED"`, `"DELIVERED"`, or `"All Progress"` / blank for no filter).
- **Default Behavior**: If no filters are entered, the report defaults to listing the **latest 15 restock records**.

---

## Google Sheet Formula

```excel
=LET(
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),
  SKUFileID, VLOOKUP("ViewFileID", Config!A:B, 2, 0),
  MasterFileID, VLOOKUP("masterFileID", Config!A:B, 2, 0),

  RawRestocks, IMPORTRANGE(OutletFileID, "OutletRestocks!A2:T"),
  RawItems, IMPORTRANGE(OutletFileID, "OutletRestockItems!A2:Q"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),
  RawSKUs, IMPORTRANGE(SKUFileID, "SKU!A2:G"),
  RawWarehouses, IMPORTRANGE(MasterFileID, "Warehouses!A2:B"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),

  UserFilter, IF(OR($J$11 = "", $J$11 = "Any User"), "", $J$11),
  DateFilter, IF(OR($J$12 = "", $J$12 = "Any Date"), "", $J$12),
  ProgressFilter, IF(OR($J$13 = "", $J$13 = "All Progress"), "", $J$13),

  HasInput, OR(UserFilter <> "", DateFilter <> "", ProgressFilter <> ""),

  RestocksCode, TOCOL(CHOOSECOLS(RawRestocks, 1)),
  RestocksDate, TOCOL(CHOOSECOLS(RawRestocks, 2)),
  RestocksOutletCode, TOCOL(CHOOSECOLS(RawRestocks, 3)),
  RestocksRequestedUser, TOCOL(CHOOSECOLS(RawRestocks, 5)),
  RestocksProgress, TOCOL(CHOOSECOLS(RawRestocks, 7)),
  RestocksStatus, TOCOL(CHOOSECOLS(RawRestocks, 20)),

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),
  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  WhCodes, TOCOL(CHOOSECOLS(RawWarehouses, 1)),
  WhNames, TOCOL(CHOOSECOLS(RawWarehouses, 2)),

  ParsedDates, MAP(RestocksDate, LAMBDA(d, IFERROR(IF(ISNUMBER(d), d, DATEVALUE(LEFT(d, 10))), 0))),
  ParsedDateFilter, IFERROR(IF(ISNUMBER(DateFilter), DateFilter, DATEVALUE(LEFT(DateFilter, 10))), 0),

  Filtered, IFERROR(
    FILTER(
      RawRestocks,
      (RestocksStatus = "Active") *
      (IF(
        HasInput,
        ((UserFilter = "") + (RestocksRequestedUser = UserFilter)) *
        ((DateFilter = "") + (ParsedDates = ParsedDateFilter)) *
        ((ProgressFilter = "") + (RestocksProgress = ProgressFilter)),
        SEQUENCE(ROWS(RawRestocks))*0 + 1
      ))
    ),
    MAKEARRAY(1, 20, LAMBDA(r, c, ""))
  ),

  FirstCell, CHOOSEROWS(CHOOSECOLS(Filtered, 1), 1),
  HasData, AND(NOT(ISERR(Filtered)), FirstCell <> ""),

  F_Date, IF(HasData, TOCOL(CHOOSECOLS(Filtered, 2)), TODAY()),
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
    
    RestockCode, CHOOSEROWS(CHOOSECOLS(row_arr, 1), 1),
    RestockDate, CHOOSEROWS(CHOOSECOLS(row_arr, 2), 1),
    OutletCode, CHOOSEROWS(CHOOSECOLS(row_arr, 3), 1),
    ReqUser, CHOOSEROWS(CHOOSECOLS(row_arr, 5), 1),
    AppUser, CHOOSEROWS(CHOOSECOLS(row_arr, 6), 1),
    OrderProgress, CHOOSEROWS(CHOOSECOLS(row_arr, 7), 1),
    
    OutletName, IFERROR(XLOOKUP(OutletCode, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"),

    Row_1, RowFn({4, TEXT(RestockDate, "yyyy-mm-dd") & " / " & RestockCode; 14, OutletName; 28, "  "; 29, OrderProgress}),
    Row_2, RowFn({5, "Requested User: " & ReqUser; 20, "Approved User: " & AppUser}),
    
    ItemMatches, IFERROR(
      FILTER(RawItems, (TOCOL(CHOOSECOLS(RawItems, 2)) = RestockCode) * (TOCOL(CHOOSECOLS(RawItems, 17)) = "Active")),
      MAKEARRAY(1, 17, LAMBDA(r, c, ""))
    ),
    HasItems, CHOOSEROWS(CHOOSECOLS(ItemMatches, 1), 1) <> "",
    
    ItemRows, REDUCE(DummyRow, SEQUENCE(IF(HasItems, ROWS(ItemMatches), 1)), LAMBDA(inner_acc, item_k, LET(
      item_row, CHOOSEROWS(ItemMatches, item_k),
      ItemSku, CHOOSEROWS(CHOOSECOLS(item_row, 4), 1),
      ItemQty, CHOOSEROWS(CHOOSECOLS(item_row, 6), 1),
      ItemStorage, CHOOSEROWS(CHOOSECOLS(item_row, 5), 1),
      ItemProgress, CHOOSEROWS(CHOOSECOLS(item_row, 7), 1),
      ItemWh, CHOOSEROWS(CHOOSECOLS(item_row, 3), 1),
      
      SKU_Row, XLOOKUP(ItemSku, SKU_Codes, RawSKUs, MAKEARRAY(1, 7, LAMBDA(r, c, ""))),
      ProdName, CHOOSEROWS(CHOOSECOLS(SKU_Row, 4), 1),
      SKU_Code, CHOOSEROWS(CHOOSECOLS(SKU_Row, 2), 1),
      VariantValues, CHOOSEROWS(CHOOSECOLS(SKU_Row, 6), 1),
      ItemNameSuffix, IF(VariantValues <> "", VariantValues, SKU_Code),
      ItemDisplayName, ProdName & IF(ItemNameSuffix <> "", " - " & ItemNameSuffix, ""),

      WhName, IFERROR(XLOOKUP(ItemWh, WhCodes, WhNames, ItemWh), ItemWh),
      WhShortName, IF(LEN(WhName) > 10, LEFT(WhName, 7) & "...", WhName),
      
      VSTACK(
        inner_acc,
        RowFn({6, ItemQty & "x"; 7, ItemDisplayName; 29, ItemProgress & IF(TRIM(ItemStorage )<>""," " & ItemStorage & " (" & WhShortName & ")",""); 37, "  "})
      )
    ))),
    
    CleanItemRows, IF(
      HasItems,
      CHOOSEROWS(ItemRows, SEQUENCE(MAX(1, ROWS(ItemRows) - 1), 1, 2)),
      RowFn({6, "No items found in this restock."})
    ),
    
    VSTACK(
      acc,
      Row_1,
      Row_2,
      CleanItemRows,
      RowFn({0, ""})
    )
  ))),

  FallbackText, IF(HasInput, "No restock records matched the selected filters.", "No active restock records found."),

  ReportData, IF(
    HasData,
    VSTACK(
      RowFn({4, IF(HasInput, "RESTOCK RECORDS REPORT", "RECENT RESTOCK RECORDS (LATEST 15)")}),
      RowFn({0, ""}),
      CHOOSEROWS(DynamicPart, SEQUENCE(MAX(1, ROWS(DynamicPart) - 1), 1, 2))
    ),
    VSTACK(
      RowFn({4, "RESTOCK RECORDS REPORT"}),
      RowFn({0, ""}),
      RowFn({4, FallbackText})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula queries three spreadsheet files via Config parameters (`OutletFileID`, `ViewFileID`, `masterFileID`):
1. **`OutletRestocks`** (`OutletRestocks!A2:T` in Outlet Spreadsheet):
   - Column 1 (`A`): Restock Code
   - Column 2 (`B`): Date
   - Column 3 (`C`): Outlet Code
   - Column 5 (`E`): Requested User (compared to `$J$11`)
   - Column 6 (`F`): Approved User
   - Column 7 (`G`): Order Progress (compared to `$J$13`)
   - Column 20 (`T`): Record status (`"Active"`)
2. **`OutletRestockItems`** (`OutletRestockItems!A2:Q` in Outlet Spreadsheet):
   - Column 2 (`B`): Restock Code (linked to parent)
   - Column 3 (`C`): Source Warehouse Code
   - Column 4 (`D`): SKU Code
   - Column 5 (`E`): Storage location
   - Column 6 (`F`): Quantity
   - Column 7 (`G`): Item Progress Status
   - Column 17 (`Q`): Record Status (`"Active"`)
3. **`Outlets`** (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name
4. **`SKU`** (`SKU!A2:G` in Views Spreadsheet):
   - Column 1 (`A`): SKU Code
   - Column 2 (`B`): SKUCode
   - Column 4 (`D`): Product Name
   - Column 6 (`F`): Variant Values
5. **`Warehouses`** (`Warehouses!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Warehouse Code
   - Column 2 (`B`): Warehouse Name

---

## Detailed Logic Breakdown

1. **User Filter Inputs**: Resolves filters from cells `$J$11`, `$J$12`, and `$J$13`. Checks if they represent default empty states like `"Any User"`, `"Any Date"`, or `"All Progress"`.
2. **Dynamic Filtering**:
   - Parses dates into system serial numbers.
   - Filters `OutletRestocks` for rows matching the specified search parameters.
   - If no input filters are active (`HasInput` is false), the search logic is bypassed, returning all active records.
3. **Chronological Sorting & Limits**:
   - Sorts records by date in descending order (newest first).
   - If search inputs are active, lists all matching records. If inactive, limits the output array to the **latest 15 rows**.
4. **Reduction accumulator (`REDUCE`)**:
   - Loops through each filtered restock order.
   - Adds order header rows (Row 1: date, code, outlet name, progress; Row 2: requesting user, approving user).
   - Filters and displays corresponding items under that order code from `OutletRestockItems`.
   - Looks up descriptions from `SKU` view, and source warehouses from `Warehouses`.
   - Outputs a blank space between orders.
5. **Report Header**: Outputs a header title block indicating if the results represent a custom search report or the latest 15 records.
