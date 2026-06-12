# WarehouseStockReportStorageWise Report

The **WarehouseStockReportStorageWise Report** calculates and formats stock availability grouped by warehouse storage locations, parent products, and child SKUs.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `D13`
- **User Input Dependency**: Cell **`AD10`** (Warehouse Code). The formula checks if `AD10` is blank. If it is, the report remains empty. If populated, it queries inventory records specifically for that warehouse.

---

## Google Sheet Formula

```excel
=IF(TRIM(AD10)="",,LET(
  ViewFileID, VLOOKUP("ViewFileID", Config!A:B, 2, 0),
  FullStock, IMPORTRANGE(ViewFileID, "WarehouseStock!A:K"),
  WarehouseStock, IFERROR(FILTER(FullStock, CHOOSECOLS(FullStock, 1) = AD10), {"", "", "", "", "", "", "", "", "", "", 0}),
  sku_data, IMPORTRANGE(ViewFileID, "SKU!A:J"),

  ActiveStock, IFERROR(FILTER(WarehouseStock, MAP(CHOOSECOLS(WarehouseStock, 11), LAMBDA(q, IFERROR(VALUE(q), 0))) > 0), {"", "", "", "", "", "", "", "", "", "", 0}),

  act_storages, TOCOL(CHOOSECOLS(ActiveStock, 3)),
  act_skus, TOCOL(CHOOSECOLS(ActiveStock, 4)),
  act_qtys, MAP(TOCOL(CHOOSECOLS(ActiveStock, 11)), LAMBDA(q, IFERROR(VALUE(q), 0))),
  act_product_codes, MAP(act_skus, LAMBDA(s, IFERROR(VLOOKUP(TRIM(s), sku_data, 3, FALSE), ""))),

  UniqueStorages, SORT(UNIQUE(FILTER(act_storages, act_storages <> "")), 1, TRUE),

  HEADER, {"Storage Name", "", "", "", "", "", "", "", "", "Product Detail", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Stock", "", "", "", "", "", ""},

  ReportData,
  REDUCE(
    HEADER,
    UniqueStorages,
    LAMBDA(acc_st, stName,
      LET(
        unique_st_pcodes, SORT(UNIQUE(FILTER(act_product_codes, act_storages = stName)), 1, TRUE),

        st_rows,
        REDUCE(
          VSTACK(
            {"", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""},
            {stName, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""}
          ),
          unique_st_pcodes,
          LAMBDA(acc_p, pCode,
            LET(
              pName, INDEX(FILTER(ActiveStock, act_product_codes = pCode), 1, 6),
              p_st_qty, SUM(IFERROR(FILTER(act_qtys, (act_storages = stName) * (act_product_codes = pCode)), 0)),
              p_st_skus, SORT(UNIQUE(FILTER(act_skus, (act_storages = stName) * (act_product_codes = pCode))), 1, TRUE),

              p_rows,
              REDUCE(
                {"", pCode, "", "", "", "", "", "", "", pName, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", p_st_qty & "  ", "", "", "", "", "", ""},
                p_st_skus,
                LAMBDA(acc_s, sku,
                  LET(
                    sku_st_qty, SUM(IFERROR(FILTER(act_qtys, (act_storages = stName) * (act_skus = sku)), 0)),
                    vVals, INDEX(FILTER(ActiveStock, act_skus = sku), 1, 8),
                    uomName, INDEX(FILTER(ActiveStock, act_skus = sku), 1, 10),

                    sku_row, {"", "", sku, "", "", "", "", "", "", "", vVals, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", sku_st_qty & " " & uomName, "", "", "", "", "", ""},
                    VSTACK(acc_s, sku_row)
                  )
                )
              ),

              VSTACK(acc_p, p_rows)
            )
          )
        ),

        VSTACK(acc_st, st_rows)
      )
    )
  ),

  IF(
    OR(INDEX(ActiveStock, 1, 1) = "", ISBLANK(INDEX(ActiveStock, 1, 1))),
    HEADER,
    ReportData
  )
))
```

---

## Source Sheets & Column Dependencies

The formula queries data from the View Spreadsheet (`ViewFileID` from Config):
1. **`WarehouseStock`** view (`WarehouseStock!A:K`):
   - Column 1 (`A`): Warehouse Code (compared with `AD10`)
   - Column 3 (`C`): Storage Name
   - Column 4 (`D`): SKU Code
   - Column 6 (`F`): Product Name
   - Column 8 (`H`): Variant Values
   - Column 10 (`J`): UOM Name
   - Column 11 (`K`): Quantity
2. **`SKU`** view (`SKU!A:J`):
   - Column 1 or 2 (`A` or `B`): matched SKU Code
   - Column 3 (`C`): Product Code (fetched via `VLOOKUP`)

---

## Detailed Logic Breakdown

1. **Warehouse Filter**: Pulls stock records from `WarehouseStock` and filters them to match the warehouse code input in cell `AD10`.
2. **Active Filter**: Keeps only records where quantity > 0.
3. **Product Lookup**: Translates the SKU Code of each stock entry to its parent Product Code via `VLOOKUP` on the `SKU` view.
4. **Reduction Loops (`REDUCE`)**:
   - **Outer Loop**: Iterates through each unique Storage Name (`UniqueStorages`).
     - Inserts a blank spacing row.
     - Adds a Storage Header row showing the Storage Name (Col D).
   - **Middle Loop**: Iterates through unique Product Codes present in that storage location.
     - Adds a Product row showing the Product Code (Col E), Product Name (Col M), and the sum total quantity of this product in this storage (Col AE).
   - **Inner Loop**: Iterates through SKUs of that product in that storage.
     - Adds a SKU row containing the SKU Code (Col F), Variant Values (Col N), and SKU quantity in this storage formatted with the UOM name (Col AE).
5. **Layout Output**: Arranges details into a 34-column layout starting from `D` through `AK`. If no inventory matches, it outputs the header row only.
