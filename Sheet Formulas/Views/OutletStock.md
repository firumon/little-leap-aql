# OutletStock View

The **OutletStock View** calculates the current inventory levels at each outlet. It aggregates transaction movements from the Outlet log by Outlet and SKU, sums up their quantities, filters out zero/negative balances, and joins the results with outlet names and SKU details from the local `SKU` view.

---

## Google Sheet Formula

```excel
=LET(
  MasterFileID, VLOOKUP("MasterFileID", Config!A:B, 2, 0),
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),

  OutletMovementsRaw, IMPORTRANGE(OutletFileID, "OutletMovements!A2:E"),
  Movements, IFERROR(FILTER(OutletMovementsRaw, IFERROR(INDEX(OutletMovementsRaw, 0, 1) <> "", FALSE)), {"", "", "", "", 0}),

  outlet_codes, INDEX(Movements, 0, 2),
  skus, INDEX(Movements, 0, 4),
  qtys, MAP(INDEX(Movements, 0, 5), LAMBDA(q, IFERROR(VALUE(q), 0))),

  UniqueKeys, IFERROR(UNIQUE(FILTER(HSTACK(outlet_codes, skus), outlet_codes <> "")), {"", ""}),
  unique_outlets, INDEX(UniqueKeys, 0, 1),
  unique_skus, INDEX(UniqueKeys, 0, 2),

  GroupedInventory,
  MAP(
    unique_outlets,
    unique_skus,
    LAMBDA(out_code, sk,
      LET(
        qty, SUM(IFERROR(FILTER(qtys, (outlet_codes = out_code) * (skus = sk)), 0)),
        HSTACK(out_code, sk, qty)
      )
    )
  ),

  ActiveInventory, IFERROR(FILTER(GroupedInventory, CHOOSECOLS(GroupedInventory, 3) > 0), {"", "", ""}),

  OutletsRaw, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),

  HEADER, {
    "OutletCode", "OutletName", "SKU", "ProductCode", "ProductName", "VariantNames", "VariantValues", "UOMCode", "UOMName", "Quantity"
  },

  DATA,
  BYROW(
    ActiveInventory,
    LAMBDA(inv_row,
      LET(
        outlet_code, INDEX(inv_row, 1, 1),
        sku, INDEX(inv_row, 1, 2),
        qty, INDEX(inv_row, 1, 3),

        outlet_name, IFERROR(VLOOKUP(outlet_code, OutletsRaw, 2, FALSE), ""),

        pcode, IFERROR(VLOOKUP(sku, SKU!B:D, 2, FALSE), ""),
        pname, IFERROR(VLOOKUP(sku, SKU!B:D, 3, FALSE), ""),
        vnames, IFERROR(VLOOKUP(sku, SKU!B:E, 4, FALSE), ""),
        vvals, IFERROR(VLOOKUP(sku, SKU!B:F, 5, FALSE), ""),
        uom_code, IFERROR(VLOOKUP(sku, SKU!B:H, 7, FALSE), ""),
        uom_name, IFERROR(VLOOKUP(sku, SKU!B:I, 8, FALSE), ""),

        HSTACK(
          outlet_code,
          outlet_name,
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

1. **`OutletMovements`** (`OutletMovements!A2:E` from Outlet Spreadsheet): Raw log of inventory transaction movements at outlets, detailing Outlet Code, SKU, and transaction Quantity.
2. **`Outlets`** (`Outlets!A2:B` from Master Spreadsheet): Registry mapping Outlet Codes to Outlet Names.
3. **`SKU`** (Local View Sheet): Provides ProductName, Variant details, and UOM information.

---

## Columns Produced

The output table matches the following schema:

| Column | Header | Source/Formula | Description |
| :--- | :--- | :--- | :--- |
| 1 | `OutletCode` | `ActiveInventory` Col 1 | Unique code of the outlet. |
| 2 | `OutletName` | `OutletsRaw` lookup | Name of the outlet. |
| 3 | `SKU` | `ActiveInventory` Col 2 | SKU identifier. |
| 4 | `ProductCode` | `SKU` lookup | Parent Product Code. |
| 5 | `ProductName` | `SKU` lookup | Parent Product Name. |
| 6 | `VariantNames` | `SKU` lookup | Comma-separated list of variant dimensions. |
| 7 | `VariantValues` | `SKU` lookup | Comma-separated list of variant values. |
| 8 | `UOMCode` | `SKU` lookup | Unit of Measure Code. |
| 9 | `UOMName` | `SKU` lookup | Unit of Measure Name. |
| 10 | `Quantity` | `ActiveInventory` Col 3 | Net current quantity in stock at the outlet. |

---

## Detailed Logic Breakdown

1. **Configurations lookup**: Fetches `MasterFileID` and `OutletFileID` from the `Config` sheet.
2. **Movement extraction**: Imports outlet transaction logs, extracts outlet codes, SKU codes, and quantities parsed as numeric values.
3. **Inventory Grouping**:
   - `UNIQUE` + `FILTER` gets the distinct combinations of Outlet Code and SKU.
   - `MAP` loops through these unique combinations, running a `SUM` on transaction quantities filtered by the specific outlet code and SKU keys.
4. **Active Filter**: `ActiveInventory` filters out combinations with `Quantity <= 0`.
5. **BYROW Data Join**:
   - Loops through each active inventory row.
   - Looks up the Outlet Name from `OutletsRaw` using `outlet_code`.
   - Looks up Product Code, Product Name, variants, and UOM details from the local `SKU` view.
   - Combines all fields via `HSTACK`.
6. **Fallback Output**: Checks if the `ActiveInventory` is empty. If so, returns the header row only. Otherwise, stacks the header and data.
