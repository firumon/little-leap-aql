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
  OutletFileID, IFERROR(VLOOKUP("OutletFileID", Config!A:B, 2, 0), VLOOKUP("OperationFileID", Config!A:B, 2, 0)),
  MasterFileID, IFERROR(VLOOKUP("MasterFileID", Config!A:B, 2, 0), VLOOKUP("masterFileID", Config!A:B, 2, 0)),

  RawRestocks, IMPORTRANGE(OutletFileID, "OutletRestocks!A2:Z"),
  RawItems, IMPORTRANGE(OutletFileID, "OutletRestockItems!A2:Q"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),
  RawWarehouses, IMPORTRANGE(MasterFileID, "Warehouses!A2:B"),
  RawSKUs, IMPORTRANGE(MasterFileID, "SKUs!A2:B"),
  RawProducts, IMPORTRANGE(MasterFileID, "Products!A2:B"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),

  UserFilter, IF(OR($J$11 = "", $J$11 = "Any User"), "", TRIM($J$11)),
  DateFilter, IF(OR($J$12 = "", $J$12 = "Any Date"), "", $J$12),
  ProgressFilter, IF(OR($J$13 = "", $J$13 = "All Progress"), "", TRIM($J$13)),

  HasInput, OR(UserFilter <> "", DateFilter <> "", ProgressFilter <> ""),

  ParsedDateFilter, IF(DateFilter = "", 0, IFERROR(INT(DateFilter), IFERROR(DATEVALUE(LEFT(DateFilter, 10)), 0))),

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),
  WhCodes, TOCOL(CHOOSECOLS(RawWarehouses, 1)),
  WhNames, TOCOL(CHOOSECOLS(RawWarehouses, 2)),
  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  SKU_ProdCodes, TOCOL(CHOOSECOLS(RawSKUs, 2)),
  Product_Codes, TOCOL(CHOOSECOLS(RawProducts, 1)),
  Product_Names, TOCOL(CHOOSECOLS(RawProducts, 2)),

  ActiveRestocks, IFERROR(FILTER(RawRestocks, INDEX(RawRestocks, 0, 26) = "Active"), {"", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""}),
  HasActive, INDEX(ActiveRestocks, 1, 1) <> "",

  R_Users, IF(HasActive, TOCOL(CHOOSECOLS(ActiveRestocks, 5)), ""),
  R_Dates_Raw, IF(HasActive, TOCOL(CHOOSECOLS(ActiveRestocks, 2)), ""),
  R_Dates, MAP(R_Dates_Raw, LAMBDA(d, IFERROR(INT(d), IFERROR(DATEVALUE(LEFT(d, 10)), 0)))),
  R_Progs, IF(HasActive, TOCOL(CHOOSECOLS(ActiveRestocks, 7)), ""),

  FilteredRestocks, IF(
    NOT(HasActive),
    {""},
    IF(
      NOT(HasInput),
      ActiveRestocks,
      IFERROR(
        FILTER(
          ActiveRestocks,
          IF(UserFilter = "", SEQUENCE(ROWS(ActiveRestocks))*0 + 1, R_Users = UserFilter),
          IF(DateFilter = "", SEQUENCE(ROWS(ActiveRestocks))*0 + 1, R_Dates = ParsedDateFilter),
          IF(ProgressFilter = "", SEQUENCE(ROWS(ActiveRestocks))*0 + 1, R_Progs = ProgressFilter)
        ),
        {""}
      )
    )
  ),

  HasData, AND(INDEX(FilteredRestocks, 1, 1) <> "", INDEX(FilteredRestocks, 1, 1) <> "#N/A"),

  SortedData, IF(HasData, IFERROR(SORT(FilteredRestocks, 2, FALSE), FilteredRestocks), FilteredRestocks),

  LimitRows, IF(NOT(HasData), 0, IF(HasInput, ROWS(SortedData), MIN(15, ROWS(SortedData)))),
  SortedDataLimited, IF(LimitRows > 0, CHOOSEROWS(SortedData, SEQUENCE(LimitRows)), SortedData),

  DynamicPart, REDUCE(
    IFERROR(1/0, ""),
    SEQUENCE(LimitRows),
    LAMBDA(acc, k,
      LET(
        row_arr, CHOOSEROWS(SortedDataLimited, k),
        RestockCode, INDEX(row_arr, 1, 1),
        RestockDate_raw, INDEX(row_arr, 1, 2),
        RestockDate, IFERROR(INT(RestockDate_raw), IFERROR(DATEVALUE(LEFT(RestockDate_raw, 10)), TODAY())),
        OutletCode, INDEX(row_arr, 1, 3),
        ReqUser, INDEX(row_arr, 1, 5),
        AppUser, INDEX(row_arr, 1, 6),
        OrderProgress, INDEX(row_arr, 1, 7),

        OutletName, IFERROR(XLOOKUP(OutletCode, OutletCodes, OutletNames, OutletCode), OutletCode),

        Row_1, RowFn({4, TEXT(RestockDate, "yyyy-mm-dd") & " / " & RestockCode; 14, OutletName; 29, OrderProgress}),
        Row_2, RowFn({5, "Requested User: " & ReqUser; 20, IF(TRIM(AppUser) <> "", "Approved User: " & AppUser, "")}),

        ItemMatches, IFERROR(FILTER(RawItems, INDEX(RawItems, 0, 2) = RestockCode, INDEX(RawItems, 0, 17) = "Active"), ""),
        HasItems, AND(INDEX(ItemMatches, 1, 1) <> "", INDEX(ItemMatches, 1, 1) <> "#N/A"),

        ItemRows, IF(
          HasItems,
          REDUCE(
            IFERROR(1/0, ""),
            SEQUENCE(ROWS(ItemMatches)),
            LAMBDA(inner_acc, item_k,
              LET(
                ItemSku, INDEX(ItemMatches, item_k, 4),
                ItemWh, INDEX(ItemMatches, item_k, 3),
                ItemStorage, TRIM(INDEX(ItemMatches, item_k, 5)),
                ItemQty, INDEX(ItemMatches, item_k, 6),
                ItemProgress, TRIM(INDEX(ItemMatches, item_k, 7)),

                p_code, IFERROR(XLOOKUP(ItemSku, SKU_Codes, SKU_ProdCodes, ""), ""),
                p_name, IFERROR(XLOOKUP(p_code, Product_Codes, Product_Names, ""), ""),
                ItemDisplayName, IF(p_name <> "", p_name & " (" & ItemSku & ")", ItemSku),

                WhName, IFERROR(XLOOKUP(ItemWh, WhCodes, WhNames, ""), ""),
                WhShortName, IF(LEN(WhName) > 10, LEFT(WhName, 8) & "...", WhName),

                detail_str, IF(
                  AND(ItemStorage <> "", WhShortName <> ""),
                  ItemStorage & " (" & WhShortName & ")",
                  IF(ItemStorage <> "", ItemStorage, IF(WhShortName <> "", "(" & WhShortName & ")", ""))
                ),

                status_str, IF(detail_str <> "", ItemProgress & " - " & detail_str, ItemProgress),

                curr_item, RowFn({6, ItemQty & "x"; 7, ItemDisplayName; 29, status_str}),

                IF(item_k = 1, curr_item, VSTACK(inner_acc, curr_item))
              )
            )
          ),
          RowFn({6, "No items found in this restock."})
        ),

        curr_order, VSTACK(Row_1, Row_2, ItemRows, RowFn({0, ""})),

        IF(k = 1, curr_order, VSTACK(acc, curr_order))
      )
    )
  ),

  FallbackText, IF(HasInput, "No restock records matched the selected filters.", "No active restock records found."),

  ReportData, IF(
    HasData,
    VSTACK(
      RowFn({4, IF(HasInput, "RESTOCK RECORDS REPORT", "RECENT RESTOCK RECORDS (LATEST 15)")}),
      RowFn({0, ""}),
      DynamicPart
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

The formula queries two spreadsheet files via Config parameters (`OutletFileID` and `MasterFileID`):
1. **`OutletRestocks`** (`OutletRestocks!A2:Z` in Outlet Spreadsheet):
   - Column 1 (`A`): Restock Code
   - Column 2 (`B`): Order Date
   - Column 3 (`C`): Outlet Code
   - Column 5 (`E`): Requested User (compared to `$J$11`)
   - Column 6 (`F`): Approved User
   - Column 7 (`G`): Order Progress (compared to `$J$13`)
   - Column 26 (`Z`): Record status (`"Active"`)
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
4. **`Warehouses`** (`Warehouses!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Warehouse Code
   - Column 2 (`B`): Warehouse Name
5. **`SKUs`** (`SKUs!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): SKU Code
   - Column 2 (`B`): Product Code
6. **`Products`** (`Products!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Product Code
   - Column 2 (`B`): Product Name

---

## Detailed Logic Breakdown

1. **User Filter Inputs**: Resolves filters from cells `$J$11`, `$J$12`, and `$J$13`. Checks if they represent default empty states like `"Any User"`, `"Any Date"`, or `"All Progress"`.
2. **Dynamic Filtering**:
   - Parses dates into system serial numbers.
   - Filters active `OutletRestocks` records with comma-separated filter arguments.
   - If no input filters are active (`HasInput` is false), all active records are processed.
3. **Chronological Sorting & Limits**:
   - Sorts records by date in descending order (newest first).
   - If search inputs are active, lists all matching records. If inactive, limits the output to the **latest 15 rows**.
4. **Reduction accumulator (`REDUCE`)**:
   - Loops through each filtered restock order without dummy rows.
   - Adds order header rows (Row 1: date, code, outlet name, progress; Row 2: requesting user, approving user).
   - Filters and displays corresponding items under that order code from `OutletRestockItems`.
   - Looks up descriptions directly from `Products` and `SKUs` in Master, and source warehouses from `Warehouses`.
   - Outputs clean progress status without empty parentheses.
5. **Report Header**: Outputs a header title block indicating if the results represent a custom search report or the latest 15 records.
