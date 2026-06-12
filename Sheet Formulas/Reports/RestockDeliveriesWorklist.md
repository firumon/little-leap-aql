# RestockDeliveriesWorklist Report

The **RestockDeliveriesWorklist Report** compiles an active packing and dispatch checklist for a selected warehouse. It identifies what items have been allocated and are ready for delivery, and what items are pending allocation.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: Cell **`$AB$6`** (Warehouse Code or name).
- **Purpose**: Filters the `"ALLOCATED AND UNDELIVERED"` section to only list items sourced from the selected warehouse.

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

  RestockCodes, TOCOL(CHOOSECOLS(RawRestocks, 1)),
  RestockOutlets, TOCOL(CHOOSECOLS(RawRestocks, 3)),
  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),
  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  WhCodes, TOCOL(CHOOSECOLS(RawWarehouses, 1)),
  WhNames, TOCOL(CHOOSECOLS(RawWarehouses, 2)),

  ItemProgressCol, TOCOL(CHOOSECOLS(RawItems, 7)),
  ItemStatusCol, TOCOL(CHOOSECOLS(RawItems, 17)),

  SelectedWhName, IFERROR(XLOOKUP($AB$6, WhCodes, WhNames, $AB$6), $AB$6),

  AllocatedItems, IFERROR(
    FILTER(
      RawItems,
      (ItemStatusCol = "Active") *
      (ItemProgressCol = "ALLOCATED") *
      (TOCOL(CHOOSECOLS(RawItems, 3)) = $AB$6)
    ),
    MAKEARRAY(1, 17, LAMBDA(r, c, ""))
  ),

  PendingItems, IFERROR(
    FILTER(
      RawItems,
      (ItemStatusCol = "Active") *
      (ItemProgressCol = "PENDING")
    ),
    MAKEARRAY(1, 17, LAMBDA(r, c, ""))
  ),

  DummyRow, RowFn({0, "DUMMY"}),

  BuildSection, LAMBDA(filtered_items, section_header_row, is_allocated, LET(
    FirstCode, CHOOSEROWS(CHOOSECOLS(filtered_items, 1), 1),
    HasSectionItems, AND(NOT(ISERR(filtered_items)), FirstCode <> ""),
    IF(
      HasSectionItems,
      IF(
        is_allocated,
        LET(
          GroupCount, ROWS(filtered_items),
          WarehouseHeader, RowFn({5, SelectedWhName; 27, GroupCount & " Items"}),
          
          GroupRows, REDUCE(DummyRow, SEQUENCE(GroupCount), LAMBDA(inner_acc, k, LET(
            item_row, CHOOSEROWS(filtered_items, k),
            ItemSku, CHOOSEROWS(CHOOSECOLS(item_row, 4), 1),
            ItemQty, CHOOSEROWS(CHOOSECOLS(item_row, 6), 1),
            ItemStorage, CHOOSEROWS(CHOOSECOLS(item_row, 5), 1),
            
            SKU_Row, XLOOKUP(ItemSku, SKU_Codes, RawSKUs, MAKEARRAY(1, 7, LAMBDA(r, c, ""))),
            ProdName, CHOOSEROWS(CHOOSECOLS(SKU_Row, 4), 1),
            SKU_Code, CHOOSEROWS(CHOOSECOLS(SKU_Row, 2), 1),
            VariantValues, CHOOSEROWS(CHOOSECOLS(SKU_Row, 6), 1),
            ItemNameSuffix, IF(VariantValues <> "", VariantValues, SKU_Code),
            ItemDisplayName, ProdName & IF(ItemNameSuffix <> "", " - " & ItemNameSuffix, ""),
            
            VSTACK(
              inner_acc,
              RowFn({6, ItemQty & "x"; 7, ItemDisplayName; 27, ItemStorage})
            )
          ))),
          
          CleanGroupRows, CHOOSEROWS(GroupRows, SEQUENCE(MAX(1, ROWS(GroupRows) - 1), 1, 2)),
          
          VSTACK(
            section_header_row,
            RowFn({0, ""}),
            WarehouseHeader,
            CleanGroupRows,
            RowFn({0, ""})
          )
        ),
        LET(
          ItemRestockCodes, TOCOL(CHOOSECOLS(filtered_items, 2)),
          ItemOutletCodes, MAP(ItemRestockCodes, LAMBDA(rc, IFERROR(XLOOKUP(rc, RestockCodes, RestockOutlets, "Unknown"), "Unknown"))),
          UniqueOutlets, SORT(UNIQUE(ItemOutletCodes)),
          
          DynamicPart, REDUCE(DummyRow, UniqueOutlets, LAMBDA(acc, o_code, LET(
            ItemIndices, FILTER(SEQUENCE(ROWS(filtered_items)), ItemOutletCodes = o_code),
            GroupCount, ROWS(ItemIndices),
            
            o_name, IFERROR(XLOOKUP(o_code, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"),
            OutletHeader, RowFn({5, o_name; 27, GroupCount & " Items"}),
            
            GroupRows, REDUCE(DummyRow, SEQUENCE(GroupCount), LAMBDA(inner_acc, k, LET(
              idx, CHOOSEROWS(ItemIndices, k),
              item_row, CHOOSEROWS(filtered_items, idx),
              
              ItemSku, CHOOSEROWS(CHOOSECOLS(item_row, 4), 1),
              ItemQty, CHOOSEROWS(CHOOSECOLS(item_row, 6), 1),
              
              SKU_Row, XLOOKUP(ItemSku, SKU_Codes, RawSKUs, MAKEARRAY(1, 7, LAMBDA(r, c, ""))),
              ProdName, CHOOSEROWS(CHOOSECOLS(SKU_Row, 4), 1),
              SKU_Code, CHOOSEROWS(CHOOSECOLS(SKU_Row, 2), 1),
              VariantValues, CHOOSEROWS(CHOOSECOLS(SKU_Row, 6), 1),
              ItemNameSuffix, IF(VariantValues <> "", VariantValues, SKU_Code),
              ItemDisplayName, ProdName & IF(ItemNameSuffix <> "", " - " & ItemNameSuffix, ""),
              
              VSTACK(
                inner_acc,
                RowFn({6, ItemQty & "x"; 7, ItemDisplayName})
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
          
          VSTACK(
            section_header_row,
            RowFn({0, ""}),
            CHOOSEROWS(DynamicPart, SEQUENCE(MAX(1, ROWS(DynamicPart) - 1), 1, 2))
          )
        )
      ),
      VSTACK(
        section_header_row,
        RowFn({0, ""}),
        RowFn({5, "No items in this section."})
      )
    )
  )),

  Section_1_Rows, BuildSection(AllocatedItems, RowFn({4, "ALLOCATED AND UNDELIVERED"}), TRUE),
  Section_2_Rows, BuildSection(PendingItems, RowFn({4, "PENDING ALLOCATION"}), FALSE),

  ReportData, VSTACK(
    RowFn({27, "Date: " & TEXT(NOW(), "yyyy-mm-dd hh:mm:ss")}),
    RowFn({27, SelectedWhName}),
    Section_1_Rows,
    RowFn({0, ""}),
    Section_2_Rows
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula imports data from three files (using `masterFileID`, `OutletFileID`, and `ViewFileID` from Config):
1. **`OutletRestocks`** (`OutletRestocks!A2:T` in Outlet Spreadsheet):
   - Column 1 (`A`): Restock Code
   - Column 3 (`C`): Outlet Code
2. **`OutletRestockItems`** (`OutletRestockItems!A2:Q` in Outlet Spreadsheet):
   - Column 2 (`B`): Restock Code
   - Column 3 (`C`): Source Warehouse Code (compared with `$AB$6` for allocation checks)
   - Column 4 (`D`): SKU Code
   - Column 5 (`E`): Source Storage Name
   - Column 6 (`F`): Quantity
   - Column 7 (`G`): Item Progress Status (`"ALLOCATED"`, `"PENDING"`)
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

1. **Allocated Items Search**: Filters `OutletRestockItems` where the record is active, the status is `"ALLOCATED"`, and the warehouse matches `$AB$6`.
2. **Pending Items Search**: Filters `OutletRestockItems` where the record is active and the status is `"PENDING"`.
3. **`BuildSection` LAMBDA Helper**:
   - Handles the differences in structuring between the two checklist sections.
   - **For Allocated Section (`is_allocated` is true)**:
     - Groups all matching rows under the selected warehouse header.
     - Lists each allocated item detailing quantity (Col 6), SKU name + variant suffix (Col 7), and specific source storage bin location (Col 27).
   - **For Pending Section (`is_allocated` is false)**:
     - Back-resolves the target Outlet Code by matching the restock code with the parent `OutletRestocks` sheet.
     - Groups pending items by target outlet.
     - For each outlet, displays the Outlet Name header (Col 5) and lists the items with quantities (Col 6) and display names (Col 7).
4. **Layout Compilation**: Stacks current timestamp metadata, warehouse name header, and both checklist sections into a 39-column checklist grid.
