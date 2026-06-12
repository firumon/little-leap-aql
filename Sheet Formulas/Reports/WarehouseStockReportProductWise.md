# WarehouseStockReportProductWise Report

The **WarehouseStockReportProductWise Report** calculates and formats stock availability grouped by parent products, child SKUs, and storage locations for a specific warehouse.

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

  UniqueProducts, SORT(UNIQUE(FILTER(act_product_codes, act_product_codes <> "")), 1, TRUE),

  HEADER, {"Code", "", "", "", "", "", "", "", "", "Detail", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Quantity", "", "", "", "", "", ""},

  ReportData,
  REDUCE(
    HEADER,
    UniqueProducts,
    LAMBDA(acc_p, pCode,
      LET(
        pName, INDEX(FILTER(ActiveStock, act_product_codes = pCode), 1, 6),
        p_skus, SORT(UNIQUE(FILTER(act_skus, act_product_codes = pCode)), 1, TRUE),

        p_rows,
        REDUCE(
          VSTACK(
            {"", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""},
            {pCode, "", "", "", "", "", "", "", "", pName, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", SUM(IFERROR(FILTER(act_qtys, act_product_codes = pCode), 0)) & "  ", "", "", "", "", "", ""}
          ),
          p_skus,
          LAMBDA(acc_s, sku,
            LET(
              vVals, INDEX(FILTER(ActiveStock, act_skus = sku), 1, 8),
              sku_storages_all, FILTER(HSTACK(act_storages, act_qtys), act_skus = sku),
              sku_storages_sorted, SORT(sku_storages_all, 1, TRUE),

              s_rows,
              MAP(
                SEQUENCE(ROWS(sku_storages_sorted)),
                LAMBDA(r,
                  LET(
                    st_name, INDEX(sku_storages_sorted, r, 1),
                    st_qty, INDEX(sku_storages_sorted, r, 2),
                    {"", "", st_name, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", st_qty & "  ", "", "", "", "", "", ""}
                  )
                )
              ),

              VSTACK(
                acc_s,
                {"", sku, "", "", "", "", "", "", "", "", vVals, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", LET(sku_qty, SUM(IFERROR(FILTER(act_qtys, act_skus = sku), 0)), uom_name, INDEX(FILTER(ActiveStock, act_skus = sku), 1, 10), sku_qty & " " & uom_name), "", "", "", "", "", ""},
                s_rows
              )
            )
          )
        ),

        VSTACK(acc_p, p_rows)
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
   - **Outer Loop**: Iterates through each unique Product Code.
     - Inserts a blank spacing row.
     - Adds a Product row showing the Product Code (Col D), Product Name (Col M), and the sum total quantity of all its SKUs (Col AE).
   - **Inner Loop**: Iterates through the SKUs associated with that parent product.
     - Adds a SKU row containing the SKU Code (Col E), Variant Values (Col N), and total SKU quantity formatted with the UOM name (Col AE).
     - Maps storage details under that SKU, printing Storage Name (Col F) and specific storage quantity (Col AE).
5. **Layout Output**: Arranges details into a 34-column layout starting from `D` through `AK`. If no inventory matches, it outputs the header row only.
