# WarehouseStock View

The **WarehouseStock View** calculates the current active stock levels across warehouses and storage locations. It groups transaction movements by Warehouse, Storage, and SKU, sums up their quantities, filters out zero/negative balances, and joins the results with warehouse names and SKU details from the local `SKU` view.

---

## Google Sheet Formula

```excel
=LET(
  MasterFileID, VLOOKUP("MasterFileID",Config!A1:B,2,0),
  OperationFileID, VLOOKUP("OperationFileID",Config!A1:B,2,0),

  StockMovementsRaw, IMPORTRANGE(OperationFileID, "StockMovements!A2:E"),
  Movements, IFERROR(FILTER(StockMovementsRaw, IFERROR(INDEX(StockMovementsRaw, 0, 1) <> "", FALSE)), {"", "", "", "", 0}),

  wh_codes, INDEX(Movements, 0, 2),
  storages, INDEX(Movements, 0, 3),
  skus, INDEX(Movements, 0, 4),
  qtys, MAP(INDEX(Movements, 0, 5), LAMBDA(q, IFERROR(VALUE(q), 0))),

  UniqueKeys, IFERROR(UNIQUE(FILTER(HSTACK(wh_codes, storages, skus), wh_codes <> "")), {"", "", ""}),
  unique_whs, INDEX(UniqueKeys, 0, 1),
  unique_sts, INDEX(UniqueKeys, 0, 2),
  unique_sks, INDEX(UniqueKeys, 0, 3),

  GroupedInventory,
  MAP(
    unique_whs,
    unique_sts,
    unique_sks,
    LAMBDA(wh, st, sk,
      LET(
        qty, SUM(IFERROR(FILTER(qtys, (wh_codes = wh) * (storages = st) * (skus = sk)), 0)),
        HSTACK(wh, st, sk, qty)
      )
    )
  ),

  ActiveInventory, IFERROR(FILTER(GroupedInventory, CHOOSECOLS(GroupedInventory, 4) > 0), {"", "", "", ""}),

  WarehousesRaw, IMPORTRANGE(MasterFileID, "Warehouses!A2:B"),

  HEADER, {
    "WarehouseCode", "WarehouseName", "StorageName", "SKU", "ProductCode", "ProductName", "VariantNames", "VariantValues", "UOMCode", "UOMName", "Quantity"
  },

  DATA,
  BYROW(
    ActiveInventory,
    LAMBDA(inv_row,
      LET(
        wh_code, INDEX(inv_row, 1, 1),
        storage, INDEX(inv_row, 1, 2),
        sku, INDEX(inv_row, 1, 3),
        qty, INDEX(inv_row, 1, 4),

        wh_name, IFERROR(VLOOKUP(wh_code, WarehousesRaw, 2, FALSE), ""),

        pcode, IFERROR(VLOOKUP(sku, SKU!B:D, 2, FALSE), ""),
        pname, IFERROR(VLOOKUP(sku, SKU!B:D, 3, FALSE), ""),
        vnames, IFERROR(VLOOKUP(sku, SKU!B:E, 4, FALSE), ""),
        vvals, IFERROR(VLOOKUP(sku, SKU!B:F, 5, FALSE), ""),
        uom_code, IFERROR(VLOOKUP(sku, SKU!B:H, 7, FALSE), ""),
        uom_name, IFERROR(VLOOKUP(sku, SKU!B:I, 8, FALSE), ""),

        HSTACK(
          wh_code,
          wh_name,
          storage,
          sku,
          pcode,
          pname,
          vnames,
          vvals,
          uom_code,
          uom_name,
          qty
        )
      )
    )
  ),

  IF(
    OR(INDEX(ActiveInventory, 1, 1) = "", ISBLANK(INDEX(ActiveInventory, 1, 1))),
    HEADER,
    VSTACK(HEADER, DATA)
  )
)
```

---

## Inputs & Dependencies

1. **`StockMovements`** (`StockMovements!A2:E` from Operations Spreadsheet): The raw stock transaction log containing Warehouse Code, Storage Name, SKU, and transaction Quantity.
2. **`Warehouses`** (`Warehouses!A2:B` from Master Spreadsheet): Registry mapping Warehouse Codes to Warehouse Names.
3. **`SKU`** (Local View Sheet): Provides ProductName, Variant details, and UOM information.

---

## Columns Produced

The output table matches the following schema:

| Column | Header | Source/Formula | Description |
| :--- | :--- | :--- | :--- |
| 1 | `WarehouseCode` | `ActiveInventory` Col 1 | Unique code of the warehouse. |
| 2 | `WarehouseName` | `WarehousesRaw` lookup | Name of the warehouse. |
| 3 | `StorageName` | `ActiveInventory` Col 2 | Name of the specific storage bin/area. |
| 4 | `SKU` | `ActiveInventory` Col 3 | SKU identifier. |
| 5 | `ProductCode` | `SKU` lookup | Parent Product Code. |
| 6 | `ProductName` | `SKU` lookup | Parent Product Name. |
| 7 | `VariantNames` | `SKU` lookup | Comma-separated list of variant dimensions. |
| 8 | `VariantValues` | `SKU` lookup | Comma-separated list of variant values. |
| 9 | `UOMCode` | `SKU` lookup | Unit of Measure Code. |
| 10 | `UOMName` | `SKU` lookup | Unit of Measure Name. |
| 11 | `Quantity` | `ActiveInventory` Col 4 | Net current quantity in stock. |

---

## Detailed Logic Breakdown

1. **Configurations lookup**: Fetches `MasterFileID` and `OperationFileID` from the `Config` sheet.
2. **Movement extraction**: Imports stock transaction logs and extracts columns (warehouse codes, storage locations, SKU codes, and quantities parsed as numeric values).
3. **Inventory Grouping**:
   - `UNIQUE` + `FILTER` gets the distinct combinations of Warehouse, Storage location, and SKU.
   - `MAP` iterates through these unique combinations, running a `SUM` on transaction quantities filtered by the specific combination keys.
4. **Active Filter**: `ActiveInventory` filters out combinations with `Quantity <= 0`.
5. **BYROW Data Join**:
   - Loops through each active inventory row.
   - Looks up the Warehouse Name from `WarehousesRaw` using `wh_code`.
   - Looks up Product Code, Product Name, variants, and UOM details from the local `SKU` view.
   - Combines all fields via `HSTACK`.
6. **Fallback Output**: Checks if the `ActiveInventory` is empty. If so, returns the header row only. Otherwise, stacks the header and data.
