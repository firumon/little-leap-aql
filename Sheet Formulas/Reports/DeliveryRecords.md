# DeliveryRecords Report

The **DeliveryRecords Report** provides a filtered search and checklist log for Outlet Delivery Dispatches. It filters deliveries by driver/user and date, sorting by date descending, and flattens associated item dispatches grouped by outlet underneath each delivery code.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A14`
- **User Input Dependencies**:
  - Cell **`$J$11`**: Delivery User/Driver Filter (supports specific username or `"Any User"` / blank for no filter).
  - Cell **`$J$12`**: Delivery Date Filter (supports specific date or `"Any Date"` / blank for no filter).
- **Default Behavior**: If no filters are active, the report displays the **latest 10 delivery dispatches**.

---

## Google Sheet Formula

```excel
=LET(
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),
  SKUFileID, VLOOKUP("ViewFileID", Config!A:B, 2, 0),
  MasterFileID, VLOOKUP("masterFileID", Config!A:B, 2, 0),

  RawDeliveries, IMPORTRANGE(OutletFileID, "OutletDeliveries!A2:T"),
  RawItems, IMPORTRANGE(OutletFileID, "OutletRestockItems!A2:Q"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),
  RawSKUs, IMPORTRANGE(SKUFileID, "SKU!A2:G"),
  RawRestocks, IMPORTRANGE(OutletFileID, "OutletRestocks!A2:T"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),

  UserFilter, IF(OR($J$11 = "", $J$11 = "Any User"), "", $J$11),
  DateFilter, IF(OR($J$12 = "", $J$12 = "Any Date"), "", $J$12),

  HasInput, OR(UserFilter <> "", DateFilter <> ""),

  DeliveriesCode, TOCOL(CHOOSECOLS(RawDeliveries, 1)),
  DeliveriesDate, TOCOL(CHOOSECOLS(RawDeliveries, 2)),
  DeliveriesUser, TOCOL(CHOOSECOLS(RawDeliveries, 3)),
  DeliveriesProgress, TOCOL(CHOOSECOLS(RawDeliveries, 4)),
  DeliveriesStatus, TOCOL(CHOOSECOLS(RawDeliveries, 15)),

  ParsedDates, MAP(DeliveriesDate, LAMBDA(d, IFERROR(IF(ISNUMBER(d), d, DATEVALUE(LEFT(d, 10))), 0))),
  ParsedDateFilter, IFERROR(IF(ISNUMBER(DateFilter), DateFilter, DATEVALUE(LEFT(DateFilter, 10))), 0),

  Filtered, IFERROR(
    FILTER(
      RawDeliveries,
      (DeliveriesStatus = "Active") *
      ((UserFilter = "") + (DeliveriesUser = UserFilter)) *
      ((DateFilter = "") + (ParsedDates = ParsedDateFilter))
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

  LimitRows, IF(HasInput, ROWS(SortedData), MIN(10, ROWS(SortedData))),
  SortedDataLimited, CHOOSEROWS(SortedData, SEQUENCE(LimitRows)),

  S_Idx, TOCOL(CHOOSECOLS(SortedDataLimited, 1)),

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),
  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  RestockCodes, TOCOL(CHOOSECOLS(RawRestocks, 1)),
  RestockOutlets, TOCOL(CHOOSECOLS(RawRestocks, 3)),

  DummyRow, RowFn({0, "DUMMY"}),

  DynamicPart, REDUCE(DummyRow, SEQUENCE(LimitRows), LAMBDA(acc, loop_k, LET(
    idx, CHOOSEROWS(S_Idx, loop_k),
    row_arr, CHOOSEROWS(Filtered, idx),
    
    DeliveryCode, CHOOSEROWS(CHOOSECOLS(row_arr, 1), 1),
    DeliveryDate, CHOOSEROWS(CHOOSECOLS(row_arr, 2), 1),
    DeliveryUser, CHOOSEROWS(CHOOSECOLS(row_arr, 3), 1),
    DeliveryProgress, CHOOSEROWS(CHOOSECOLS(row_arr, 4), 1),
    ItemCodesCSV, CHOOSEROWS(CHOOSECOLS(row_arr, 5), 1),
    
    DeliveryDateStr, IF(ISNUMBER(DeliveryDate), TEXT(DeliveryDate, "yyyy-mm-dd"), LEFT(DeliveryDate, 10)),
    ItemCodes, IFERROR(TOCOL(SPLIT(ItemCodesCSV, ",")), ""),
    TotalItemsCount, IF(ItemCodesCSV = "", 0, ROWS(ItemCodes)),
    
    DeliveryHeader, RowFn({4, DeliveryDateStr & " / " & DeliveryCode & " / " & DeliveryUser; 24, DeliveryProgress; 32, TotalItemsCount & " Items"}),
    
    F_Items, IF(
      TotalItemsCount > 0,
      IFERROR(
        FILTER(RawItems, ISNUMBER(MATCH(TOCOL(CHOOSECOLS(RawItems, 1)), ItemCodes, 0))),
        MAKEARRAY(1, 17, LAMBDA(r, c, ""))
      ),
      MAKEARRAY(1, 17, LAMBDA(r, c, ""))
    ),
    
    F_RestockCodes, TOCOL(CHOOSECOLS(F_Items, 2)),
    F_OutletCodes, MAP(F_RestockCodes, LAMBDA(rc, IFERROR(XLOOKUP(rc, RestockCodes, RestockOutlets, "Unknown"), "Unknown"))),
    F_OutletNames, MAP(F_OutletCodes, LAMBDA(oc, IFERROR(XLOOKUP(oc, OutletCodes, OutletNames, "Unknown"), "Unknown"))),
    
    DummyInner, RowFn({0, "DUMMY_INNER"}),
    
    CleanGroupsPart, IF(
      TotalItemsCount > 0,
      LET(
        UniqueOutlets, UNIQUE(F_OutletNames),
        GroupsPart, REDUCE(DummyInner, UniqueOutlets, LAMBDA(inner_acc, out_name, LET(
          ItemIndices, FILTER(SEQUENCE(ROWS(F_Items)), F_OutletNames = out_name),
          GroupCount, ROWS(ItemIndices),
          OutletHeader, RowFn({5, out_name; 32, GroupCount & " Items"}),
          
          ItemRows, REDUCE(DummyInner, SEQUENCE(GroupCount), LAMBDA(item_acc, loop_item_k, LET(
            idx_item, CHOOSEROWS(ItemIndices, loop_item_k),
            item_row, CHOOSEROWS(F_Items, idx_item),
            ItemSku, CHOOSEROWS(CHOOSECOLS(item_row, 4), 1),
            ItemQty, CHOOSEROWS(CHOOSECOLS(item_row, 6), 1),
            ItemProgress, CHOOSEROWS(CHOOSECOLS(item_row, 7), 1),
            DeliveredAt, CHOOSEROWS(CHOOSECOLS(item_row, 11), 1),
            
            SKU_Row, XLOOKUP(ItemSku, SKU_Codes, RawSKUs, MAKEARRAY(1, 7, LAMBDA(r, c, ""))),
            ProdName, CHOOSEROWS(CHOOSECOLS(SKU_Row, 4), 1),
            SKU_Code, CHOOSEROWS(CHOOSECOLS(SKU_Row, 2), 1),
            VariantValues, CHOOSEROWS(CHOOSECOLS(SKU_Row, 6), 1),
            ItemNameSuffix, IF(VariantValues <> "", VariantValues, SKU_Code),
            ItemDisplayName, ProdName & IF(ItemNameSuffix <> "", " - " & ItemNameSuffix, ""),
            
            DeliveredAtStr, IF(ISNUMBER(DeliveredAt), TEXT(DeliveredAt, "yyyy-mm-dd"), LEFT(DeliveredAt, 10)),
            ProgressLabel, IF(
              UPPER(ItemProgress) = "DELIVERED",
              "Delivered at " & DeliveredAtStr,
              ItemProgress
            ),
            
            VSTACK(
              item_acc,
              RowFn({6, ItemQty & "x"; 7, ItemDisplayName; 24, ProgressLabel})
            )
          ))),
          CleanItemRows, CHOOSEROWS(ItemRows, SEQUENCE(MAX(1, ROWS(ItemRows) - 1), 1, 2)),
          VSTACK(
            inner_acc,
            OutletHeader,
            CleanItemRows
          )
        ))),
        CHOOSEROWS(GroupsPart, SEQUENCE(MAX(1, ROWS(GroupsPart) - 1), 1, 2))
      ),
      RowFn({5, "(No items found)"})
    ),
    
    VSTACK(
      acc,
      DeliveryHeader,
      CleanGroupsPart,
      RowFn({0, ""})
    )
  ))),

  FallbackText, IF(HasInput, "No delivery records matched the selected filters.", "No active delivery records found."),

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

The formula queries data from three spreadsheet files (`OutletFileID`, `ViewFileID`, `masterFileID`):
1. **`OutletDeliveries`** (`OutletDeliveries!A2:T` in Outlet Spreadsheet):
   - Column 1 (`A`): Delivery Code
   - Column 2 (`B`): Date
   - Column 3 (`C`): Delivery Driver/User (compared to `$J$11`)
   - Column 4 (`D`): Delivery Progress status
   - Column 5 (`E`): Item Codes CSV list
   - Column 15 (`O`): Record Status (`"Active"`)
2. **`OutletRestockItems`** (`OutletRestockItems!A2:Q` in Outlet Spreadsheet):
   - Column 1 (`A`): Restock Item Primary Code (matched against parsed CSV array)
   - Column 2 (`B`): Parent Restock Code
   - Column 4 (`D`): SKU Code
   - Column 6 (`F`): Quantity
   - Column 7 (`G`): Item Progress status (`"DELIVERED"`, etc.)
   - Column 11 (`K`): Delivered At timestamp
3. **`OutletRestocks`** (`OutletRestocks!A2:T` in Outlet Spreadsheet):
   - Column 1 (`A`): Restock Code
   - Column 3 (`C`): Outlet Code (mapped to lookup outlet names)
4. **`Outlets`** (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name
5. **`SKU`** (`SKU!A2:G` in Views Spreadsheet):
   - Column 1 (`A`): SKU Code
   - Column 2 (`B`): SKUCode
   - Column 4 (`D`): Product Name
   - Column 6 (`F`): Variant Values

---

## Detailed Logic Breakdown

1. **User Filter Inputs**: Resolves search filters from cells `$J$11` (driver) and `$J$12` (date).
2. **Dynamic Filtering**:
   - Parses dates into system serial numbers.
   - Filters `OutletDeliveries` for rows matching the specified search parameters.
3. **Chronological Sorting & Limits**:
   - Sorts records by date descending.
   - If search inputs are active, lists all matching records. If inactive, limits the output array to the **latest 10 rows**.
4. **Reduction Accumulator (`REDUCE`)**:
   - Loops through each matching delivery record.
   - Renders a delivery header row detailing date, code, user, status, and item counts.
   - Splits and filters corresponding item rows from `OutletRestockItems`.
   - Groups items by target outlet.
   - Renders outlet section headers.
   - Lists items under each outlet displaying quantity, name, and delivery progress status/date.
   - Outputs a blank space between delivery logs.
