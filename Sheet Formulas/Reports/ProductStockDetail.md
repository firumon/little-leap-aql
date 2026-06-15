# ProductStockDetail Report

The **ProductStockDetail Report** displays stock availability for a parent product (by Product Code) across both warehouses and outlets. It lists all SKUs and variants for that product, grouped into separate Warehouse and Outlet stock sections.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: Cell **`$AB$6`** (Product Code).
- **Purpose**: Queries inventory records matching this Product Code across warehouses and outlets. If cell `$AB$6` is empty, the report is blank. If no stock is found in a section, a placeholder message is shown.

---

## Google Sheet Formula

```excel
=IF(TRIM($AB$6)="",,LET(
  ViewFileID, VLOOKUP("ViewFileID", Config!A:B, 2, 0),
  MasterFileID, VLOOKUP("MasterFileID", Config!A:B, 2, 0),

  RawWarehouseStock, IMPORTRANGE(ViewFileID, "WarehouseStock!A2:K"),
  RawOutletStock, IMPORTRANGE(ViewFileID, "OutletStock!A2:J"),
  RawProducts, IMPORTRANGE(MasterFileID, "Products!A2:B"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),

  ProductCodes, TOCOL(CHOOSECOLS(RawProducts, 1)),
  ProductNames, TOCOL(CHOOSECOLS(RawProducts, 2)),
  ProductName, IFERROR(XLOOKUP($AB$6, ProductCodes, ProductNames, "Unknown Product"), "Unknown Product"),

  FilteredWarehouseStock, IFERROR(
    FILTER(RawWarehouseStock, TOCOL(CHOOSECOLS(RawWarehouseStock, 5)) = $AB$6),
    {"", "", "", "", "", "", "", "", "", "", 0}
  ),
  FilteredOutletStock, IFERROR(
    FILTER(RawOutletStock, TOCOL(CHOOSECOLS(RawOutletStock, 4)) = $AB$6),
    {"", "", "", "", "", "", "", "", "", 0}
  ),

  HasWarehouseData, INDEX(FilteredWarehouseStock, 1, 1) <> "",
  HasOutletData, INDEX(FilteredOutletStock, 1, 1) <> "",

  FirstLine, RowFn({4, $AB$6; 27, "Report Generated On"}),
  SecondLine, RowFn({4, ProductName; 27, TEXT(NOW(), "yyyy-mm-dd HH:mm:ss")}),
  BlankLine, RowFn({0, ""}),

  WarehouseSectionRows, IF(
    HasWarehouseData,
    REDUCE(
      RowFn({6, "#"; 7, "SKU / Variants"; 19, "Storage Location"; 27, "Qty"; 29, "UOM"}),
      SEQUENCE(ROWS(FilteredWarehouseStock)),
      LAMBDA(acc, idx,
        LET(
          row_val, CHOOSEROWS(FilteredWarehouseStock, idx),
          sku, INDEX(row_val, 1, 4),
          storage, INDEX(row_val, 1, 3),
          variants, INDEX(row_val, 1, 8),
          uom, INDEX(row_val, 1, 10),
          qty, INDEX(row_val, 1, 11),

          SkuAndVariants, sku & IF(variants <> "", " / " & variants, ""),
          item_row, RowFn({6, idx & "."; 7, SkuAndVariants; 19, storage; 27, qty; 29, uom}),

          VSTACK(acc, item_row)
        )
      )
    ),
    RowFn({6, "No warehouse stock found for this product."})
  ),

  OutletSectionRows, IF(
    HasOutletData,
    LET(
      UniqueOutletCodes, SORT(UNIQUE(FILTER(CHOOSECOLS(FilteredOutletStock, 1), CHOOSECOLS(FilteredOutletStock, 1) <> ""))),
      RawOutletBlocks, REDUCE(
        BlankLine,
        UniqueOutletCodes,
        LAMBDA(acc, out_code,
          LET(
            matching_rows, FILTER(FilteredOutletStock, CHOOSECOLS(FilteredOutletStock, 1) = out_code),
            out_name, INDEX(matching_rows, 1, 2),
            out_header, RowFn({5, out_name}),

            block, REDUCE(
              out_header,
              SEQUENCE(ROWS(matching_rows)),
              LAMBDA(inner_acc, idx,
                LET(
                  row_val, CHOOSEROWS(matching_rows, idx),
                  sku, INDEX(row_val, 1, 3),
                  variants, INDEX(row_val, 1, 7),
                  uom, INDEX(row_val, 1, 9),
                  qty, INDEX(row_val, 1, 10),

                  SkuAndVariants, sku & IF(variants <> "", " / " & variants, ""),
                  item_row, RowFn({6, idx & "."; 7, SkuAndVariants; 27, qty; 29, uom}),

                  VSTACK(inner_acc, item_row)
                )
              )
            ),
            VSTACK(acc, block, BlankLine)
          )
        )
      ),
      CHOOSEROWS(RawOutletBlocks, SEQUENCE(ROWS(RawOutletBlocks) - 2, 1, 2))
    ),
    RowFn({6, "No outlet stock found for this product."})
  ),

  VSTACK(
    FirstLine,
    SecondLine,
    BlankLine,
    RowFn({4, "WAREHOUSE STOCK"}),
    WarehouseSectionRows,
    BlankLine,
    RowFn({4, "OUTLET STOCK"}),
    OutletSectionRows
  )
))
```

---

## Source Sheets & Column Dependencies

The formula imports data from three sources:
1. **`WarehouseStock`** view (`WarehouseStock!A2:K` in Views Spreadsheet):
   - Column 3 (`C`): `StorageName`
   - Column 4 (`D`): `SKU`
   - Column 5 (`E`): `ProductCode` (compared with `$AB$6`)
   - Column 8 (`H`): `VariantValues`
   - Column 10 (`J`): `UOMName`
   - Column 11 (`K`): `Quantity`
2. **`OutletStock`** view (`OutletStock!A2:J` in Views Spreadsheet):
   - Column 1 (`A`): `OutletCode`
   - Column 2 (`B`): `OutletName`
   - Column 3 (`C`): `SKU`
   - Column 4 (`D`): `ProductCode` (compared with `$AB$6`)
   - Column 7 (`G`): `VariantValues`
   - Column 9 (`I`): `UOMName`
   - Column 10 (`J`): `Quantity`
3. **`Products`** registry (`Products!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): `ProductCode`
   - Column 2 (`B`): `ProductName`

---

## Detailed Logic Breakdown

1. **Parameter & Dependency Ingestion**: Retrieves `ViewFileID` and `MasterFileID` from the local `Config` sheet, importing `WarehouseStock`, `OutletStock` views, and the master `Products` list.
2. **Product Profile Lookup**: Resolves the product name matching `$AB$6` from `Products` for the header.
3. **Filter Stock by Product**:
   - Filters `WarehouseStock` on ProductCode (Column 5) equal to `$AB$6`.
   - Filters `OutletStock` on ProductCode (Column 4) equal to `$AB$6`.
4. **Header Lines**: 
   - `FirstLine` (Row 10): Displays product code in Column D (index 4) and `"Report Generated On"` in Column AA (index 27).
   - `SecondLine` (Row 11): Displays product name in Column D (index 4) and timestamp in Column AA (index 27).
5. **Warehouse Section Generator**:
   - Loops through matching warehouse stock rows, outputting:
     - S.No followed by a period (`idx & "."`) in Column F (index 6).
     - SKU and Variants combined (`SKU / VariantValues`) in Column G (index 7).
     - Storage Name in Column S (index 19).
     - Quantity in Column AA (index 27).
     - UOM Name in Column AC (index 29).
6. **Outlet Section Generator**:
   - Extracts unique outlet codes.
   - For each outlet, inserts an outlet header row (`E: <OutletName>`) starting at Column E (index 5) followed by its SKUs:
     - S.No followed by a period (`idx & "."`) starting at Column F (index 6).
     - SKU and Variants combined in Column G (index 7).
     - Quantity in Column AA (index 27).
     - UOM Name in Column AC (index 29).
     - (Note: Outlets do not track storage locations, so Column S is left blank).
7. **Final Output Assembly**: Combines the general header, WAREHOUSE STOCK title, warehouse list, OUTLET STOCK title, and outlet list into a shape-safe 39-column layout, with no extra blank rows between titles and header/item rows.
