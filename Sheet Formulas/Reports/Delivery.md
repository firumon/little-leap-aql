# Delivery Report

The **Delivery Report** generates an Outlet Delivery Document for a specific dispatch shipment code. It aggregates shipment metadata, total counters, and lists all dispatched items grouped by their target outlets.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: Cell **`$AB$6`** (Delivery shipment Code).
- **Purpose**: Retrieves details for the delivery shipment matching this code. If `$AB$6` is blank or invalid, it outputs a warning: `"Please enter a valid Delivery Code in cell AB6."`

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

  DeliveryCodes, TOCOL(CHOOSECOLS(RawDeliveries, 1)),
  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),
  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  RestockCodes, TOCOL(CHOOSECOLS(RawRestocks, 1)),
  RestockOutlets, TOCOL(CHOOSECOLS(RawRestocks, 3)),

  MatchIdx, IFERROR(MATCH($AB$6, DeliveryCodes, 0), 0),
  HasOrder, MatchIdx > 0,

  OrderRow, IF(HasOrder, CHOOSEROWS(RawDeliveries, MatchIdx), MAKEARRAY(1, 20, LAMBDA(r, c, ""))),

  DeliveryDate, CHOOSEROWS(CHOOSECOLS(OrderRow, 2), 1),
  DeliveryUser, CHOOSEROWS(CHOOSECOLS(OrderRow, 3), 1),
  DeliveryProgress, CHOOSEROWS(CHOOSECOLS(OrderRow, 4), 1),
  ItemCodesCSV, CHOOSEROWS(CHOOSECOLS(OrderRow, 5), 1),

  ItemCodes, IFERROR(TOCOL(SPLIT(ItemCodesCSV, ",")), ""),
  HasItems, AND(HasOrder, CHOOSEROWS(ItemCodes, 1) <> ""),

  F_Items, IFERROR(
    FILTER(RawItems, ISNUMBER(MATCH(TOCOL(CHOOSECOLS(RawItems, 1)), ItemCodes, 0))),
    MAKEARRAY(1, 17, LAMBDA(r, c, ""))
  ),

  F_RestockCodes, IF(HasItems, TOCOL(CHOOSECOLS(F_Items, 2)), ""),
  F_OutletCodes, MAP(F_RestockCodes, LAMBDA(rc, IF(HasItems, IFERROR(XLOOKUP(rc, RestockCodes, RestockOutlets, "Unknown"), "Unknown"), ""))),
  F_OutletNames, MAP(F_OutletCodes, LAMBDA(oc, IF(HasItems, IFERROR(XLOOKUP(oc, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"), ""))),

  UniqueOutletNames, IF(HasItems, SORT(UNIQUE(F_OutletNames)), ""),
  TotalOutletsCount, IF(HasItems, ROWS(UniqueOutletNames), 0),
  TotalItemsCount, IF(HasItems, ROWS(F_Items), 0),

  DummyRow, RowFn({0, "DUMMY"}),

  DynamicPart, REDUCE(DummyRow, UniqueOutletNames, LAMBDA(acc, o_name, LET(
    ItemIndices, FILTER(SEQUENCE(ROWS(F_Items)), F_OutletNames = o_name),
    GroupCount, ROWS(ItemIndices),
    
    OutletHeader, RowFn({4, o_name; 22, GroupCount & " Items"}),
    
    GroupRows, REDUCE(DummyRow, SEQUENCE(GroupCount), LAMBDA(inner_acc, k, LET(
      idx, CHOOSEROWS(ItemIndices, k),
      item_row, CHOOSEROWS(F_Items, idx),
      
      ItemSku, CHOOSEROWS(CHOOSECOLS(item_row, 4), 1),
      ItemQty, CHOOSEROWS(CHOOSECOLS(item_row, 6), 1),
      ItemProgress, CHOOSEROWS(CHOOSECOLS(item_row, 7), 1),
      DeliveredAt, CHOOSEROWS(CHOOSECOLS(item_row, 11), 1),
      DeliveredBy, CHOOSEROWS(CHOOSECOLS(item_row, 12), 1),
      
      SKU_Row, XLOOKUP(ItemSku, SKU_Codes, RawSKUs, MAKEARRAY(1, 7, LAMBDA(r, c, ""))),
      ProdName, CHOOSEROWS(CHOOSECOLS(SKU_Row, 4), 1),
      SKU_Code, CHOOSEROWS(CHOOSECOLS(SKU_Row, 2), 1),
      VariantValues, CHOOSEROWS(CHOOSECOLS(SKU_Row, 6), 1),
      ItemNameSuffix, IF(VariantValues <> "", VariantValues, SKU_Code),
      ItemDisplayName, ProdName & IF(ItemNameSuffix <> "", " - " & ItemNameSuffix, ""),
      
      ProgressLabel, IF(
        UPPER(ItemProgress) = "DELIVERED",
        "Delivered By " & DeliveredBy & " At " & TEXT(IFERROR(DATEVALUE(LEFT(DeliveredAt, 10)), TODAY()), "yyyy-mm-dd"),
        ItemProgress
      ),
      
      VSTACK(
        inner_acc,
        RowFn({5, ItemQty & "x"; 6, ItemDisplayName; 22, ProgressLabel})
      )
    ))),
    
    CleanGroupRows, CHOOSEROWS(GroupRows, SEQUENCE(MAX(1, ROWS(GroupRows) - 1), 1, 2)),
    
    VSTACK(
      acc,
      OutletHeader,
      CleanGroupRows,
      RowFn({0, ""})
    )
  ))),

  ReportData, IF(
    HasOrder,
    VSTACK(
      RowFn({4, "Date: " & TEXT(DeliveryDate, "yyyy-mm-dd"); 22, "Progress: " & DeliveryProgress}),
      RowFn({4, "User: " & DeliveryUser; 22, "Total Items: " & TotalItemsCount}),
      RowFn({22, "Total Outlets: " & TotalOutletsCount}),
      RowFn({0, ""}),
      CHOOSEROWS(DynamicPart, SEQUENCE(MAX(1, ROWS(DynamicPart) - 1), 1, 2))
    ),
    VSTACK(
      RowFn({4, "OUTLET DELIVERY DOCUMENT"}),
      RowFn({0, ""}),
      RowFn({4, "Please enter a valid Delivery Code in cell AB6."})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula queries data from three spreadsheet files (`OutletFileID`, `ViewFileID`, `masterFileID`):
1. **`OutletDeliveries`** (`OutletDeliveries!A2:T` in Outlet Spreadsheet):
   - Column 1 (`A`): Delivery Code (matches `$AB$6`)
   - Column 2 (`B`): Date
   - Column 3 (`C`): Delivery Driver/User
   - Column 4 (`D`): Delivery Progress status
   - Column 5 (`E`): Item Codes CSV list (Comma-separated string of restock item primary keys)
2. **`OutletRestockItems`** (`OutletRestockItems!A2:Q` in Outlet Spreadsheet):
   - Column 1 (`A`): Restock Item Primary Code (matched against parsed CSV array)
   - Column 2 (`B`): Parent Restock Code
   - Column 4 (`D`): SKU Code
   - Column 6 (`F`): Quantity
   - Column 7 (`G`): Item Progress status (`"DELIVERED"`, etc.)
   - Column 11 (`K`): Delivered At timestamp
   - Column 12 (`L`): Delivered By driver name
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

1. **Delivery Search**: Matches `$AB$6` to extract dispatch date, user, status, and the CSV string of packed item IDs.
2. **CSV SPLIT & Item Filtering**:
   - `SPLIT(ItemCodesCSV, ",")`: Converts the cell string to an array of item codes.
   - Filters `OutletRestockItems` to extract details only for those codes.
3. **Target Outlet Back-Resolution**:
   - For each restock item, looks up the parent restock order code, maps it to the target outlet code, and runs a `VLOOKUP` to retrieve the Outlet Name.
   - Computes unique target outlets count and total item count for the delivery summary.
4. **Group Reduction (`REDUCE`)**:
   - Loops through unique target outlets.
   - Inserts an Outlet Name header.
   - Lists all items dispatched to this outlet, displaying item quantity (Col 5), SKU display name (Col 6), and a progress label (Col 22). If an item is delivered, it appends the driver name and delivery date.
5. **Layout Output**: Combines delivery header metadata (date, user, status, counts) with the outlet groups inside a 39-column layout.
