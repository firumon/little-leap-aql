# OutletRestockHistory Report

The **OutletRestockHistory Report** calculates restock counts (KPI Dashboard) and displays a detailed historical log of all restock orders and order items requested by a specific outlet.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: Cell **`$AB$6`** (Outlet Code). The formula reads `$AB$6` to filter and summarize restock history for that specific outlet.

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

  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),
  WhCodes, TOCOL(CHOOSECOLS(RawWarehouses, 1)),
  WhNames, TOCOL(CHOOSECOLS(RawWarehouses, 2)),

  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  SKU_ProdCodes, TOCOL(CHOOSECOLS(RawSKUs, 2)),
  Product_Codes, TOCOL(CHOOSECOLS(RawProducts, 1)),
  Product_Names, TOCOL(CHOOSECOLS(RawProducts, 2)),

  OutletName, IF($AB$6 = "", "Unknown Outlet", IFERROR(XLOOKUP($AB$6, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet")),

  MatchingRestocks, IFERROR(FILTER(RawRestocks, INDEX(RawRestocks, 0, 3) = $AB$6, INDEX(RawRestocks, 0, 26) = "Active"), {"", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""}),
  HasData, AND($AB$6 <> "", INDEX(MatchingRestocks, 1, 1) <> ""),

  Progs, IF(HasData, TOCOL(CHOOSECOLS(MatchingRestocks, 7)), ""),
  PendingCount, IF(HasData, IFERROR(ROWS(FILTER(Progs, Progs <> "DRAFT", Progs <> "DELIVERED", Progs <> "REJECTED")), 0), 0),
  DeliveredCount, IF(HasData, IFERROR(ROWS(FILTER(Progs, Progs = "DELIVERED")), 0), 0),
  RejectedCount, IF(HasData, IFERROR(ROWS(FILTER(Progs, Progs = "REJECTED")), 0), 0),
  TotalNumber, PendingCount + DeliveredCount + RejectedCount,

  SortedData, IF(HasData, IFERROR(SORT(MatchingRestocks, 2, FALSE), MatchingRestocks), MatchingRestocks),

  DashboardRows, VSTACK(
    RowFn({4, "Outlet Code"; 24, "Pending"; 25, PendingCount}),
    RowFn({4, $AB$6; 24, "Delivered"; 25, DeliveredCount}),
    RowFn({4, "Outlet Name"; 24, "Rejected"; 25, RejectedCount}),
    RowFn({4, OutletName}),
    RowFn({4, "Total Restocks"}),
    RowFn({4, TotalNumber}),
    RowFn({4, "History Generation Date"}),
    RowFn({4, TEXT(NOW(), "yyyy-mm-dd HH:mm:ss")}),
    RowFn({0, ""}),
    RowFn({0, ""})
  ),

  DynamicPart, REDUCE(
    IFERROR(1/0, ""),
    SEQUENCE(ROWS(SortedData)),
    LAMBDA(acc, k,
      LET(
        RestockCode, INDEX(SortedData, k, 1),
        RestockDate_raw, INDEX(SortedData, k, 2),
        RestockDate, IFERROR(INT(RestockDate_raw), IFERROR(DATEVALUE(LEFT(RestockDate_raw, 10)), TODAY())),
        ReqUser, INDEX(SortedData, k, 5),
        OrderProgress, INDEX(SortedData, k, 7),

        ParentRow, RowFn({4, TEXT(RestockDate, "yyyy-mm-dd") & " / " & RestockCode; 16, "Requested User: " & ReqUser; 27, OrderProgress}),

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
                WhShortName, IF(LEN(WhName) > 15, LEFT(WhName, 12) & "...", WhName),

                detail_str, IF(
                  AND(ItemStorage <> "", WhShortName <> ""),
                  ItemStorage & " (" & WhShortName & ")",
                  IF(ItemStorage <> "", ItemStorage, IF(WhShortName <> "", "(" & WhShortName & ")", ""))
                ),

                status_str, IF(detail_str <> "", ItemProgress & " - " & detail_str, ItemProgress),

                curr_item, RowFn({6, ItemQty & "x"; 7, ItemDisplayName; 27, status_str}),

                IF(item_k = 1, curr_item, VSTACK(inner_acc, curr_item))
              )
            )
          ),
          RowFn({6, "No items found in this restock."})
        ),

        curr_restock, VSTACK(ParentRow, ItemRows, RowFn({0, ""})),

        IF(k = 1, curr_restock, VSTACK(acc, curr_restock))
      )
    )
  ),

  ReportData, IF(
    HasData,
    VSTACK(
      DashboardRows,
      DynamicPart
    ),
    VSTACK(
      DashboardRows,
      RowFn({4, "No restock records found for this outlet."})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula imports data from two spreadsheets (`MasterFileID` and `OutletFileID`):
1. **`OutletRestocks`** (`OutletRestocks!A2:Z` in Outlet Spreadsheet):
   - Column 1 (`A`): Restock Code
   - Column 2 (`B`): Order Date
   - Column 3 (`C`): Outlet Code (compared with `$AB$6`)
   - Column 5 (`E`): Requested User
   - Column 7 (`G`): Restock Progress status (`"DRAFT"`, `"DELIVERED"`, `"REJECTED"`, etc.)
   - Column 26 (`Z`): Record status (`"Active"`)
2. **`OutletRestockItems`** (`OutletRestockItems!A2:Q` in Outlet Spreadsheet):
   - Column 2 (`B`): Restock Code
   - Column 3 (`C`): Source Warehouse Code
   - Column 4 (`D`): SKU Code
   - Column 5 (`E`): Source Storage Name
   - Column 6 (`F`): Quantity
   - Column 7 (`G`): Item Progress status
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

1. **Dashboard Calculations**:
   - `PendingCount`: Counts active, non-draft, non-delivered, non-rejected orders.
   - `DeliveredCount`: Counts active, delivered orders.
   - `RejectedCount`: Counts active, rejected orders.
2. **Dashboard Output**: Generates structured cells (KPI labels and counts) for the KPI Dashboard.
3. **Chronological Sorting**: Retrieves and sorts the restock orders for the outlet code `$AB$6` by date descending.
4. **Restock Order Accumulator (`REDUCE`)**:
   - Loops through each sorted restock order.
   - Appends a Parent Restock row showing the date, code, requesting user, and order progress.
   - Filters `OutletRestockItems` for active item entries under that restock order code.
   - Resolves item descriptions directly from `Products` and `SKUs` in Master, and source warehouses from `Warehouses`.
   - Appends item description rows detailing quantity, display name, and clean progress with storage/warehouse.
5. **Final Assembly**: Stacks the KPI dashboard header rows and dynamic restock records into a 39-column wide report array.
