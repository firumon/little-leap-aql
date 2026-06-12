# SKU View

The **SKU View** consolidates normalized data from three separate source sheets in the Master Spreadsheet into a single denormalized table. This serves as the primary data source for SKU details (including product info, variant metadata, variant JSON strings, and UOM settings) throughout the system.

---

## Google Sheet Formula

```excel
=LET(
  Master, VLOOKUP("MasterFileID",Config!A1:B,2,0),

  Products, QUERY(IMPORTRANGE(Master, "Products!A2:I"), "where Col1 is not null", 0),
  SKUs, QUERY(IMPORTRANGE(Master, "SKUs!A2:N"), "where Col1 is not null", 0),
  UOMs, QUERY(IMPORTRANGE(Master, "UOMs!A2:E"), "where Col1 is not null", 0),

  HEADER, {
    "SKU", "SKUCode", "ProductCode", "ProductName", "VariantNames", "VariantValues",
    "NameValueJson", "UOMCode", "UOMName", "BaseUOM", "UOMConversionFactor",
    "ProductStatus", "SKUStatus", "UOMStatus", "TaxCode"
  },

  DATA,
  BYROW(
    SKUs,
    LAMBDA(sku_row,
      LET(
        sku, INDEX(sku_row, 1, 1),
        pcode, INDEX(sku_row, 1, 2),
        uom, INDEX(sku_row, 1, 8),
        taxCode, INDEX(sku_row, 1, 9),
        skuStatus, INDEX(sku_row, 1, 10),

        pname, IFERROR(VLOOKUP(pcode, Products, 2, FALSE), ""),
        vnames, IFERROR(VLOOKUP(pcode, Products, 3, FALSE), ""),
        pstatus, IFERROR(VLOOKUP(pcode, Products, 5, FALSE), ""),

        vvals_raw, {
          INDEX(sku_row, 1, 3),
          INDEX(sku_row, 1, 4),
          INDEX(sku_row, 1, 5),
          INDEX(sku_row, 1, 6),
          INDEX(sku_row, 1, 7)
        },
        vnames_split, IFERROR(SPLIT(vnames, ","), {"", "", "", "", ""}),

        variantValuesCSV,
        TEXTJOIN(",", TRUE, vvals_raw),

        nameValueJson,
        LET(
          json_string,
          TEXTJOIN(
            ",",
            TRUE,
            MAP(
              SEQUENCE(1, 5),
              LAMBDA(i,
                LET(
                  vname, TRIM(IFERROR(INDEX(vnames_split, 1, i), "")),
                  vval, TRIM(TO_TEXT(INDEX(vvals_raw, 1, i))),
                  IF(
                    OR(vname = "", vval = ""),
                    "",
                    "{""variant"":""" & vname & """,""value"":""" & vval & """}"
                  )
                )
              )
            )
          ),
          IF(json_string = "", "[]", "[" & json_string & "]")
        ),

        uomName, IFERROR(VLOOKUP(uom, UOMs, 2, FALSE), ""),
        baseUOM, IFERROR(VLOOKUP(uom, UOMs, 3, FALSE), ""),
        uomFactor, IFERROR(VLOOKUP(uom, UOMs, 4, FALSE), ""),
        uomStatus, IFERROR(VLOOKUP(uom, UOMs, 5, FALSE), ""),

        HSTACK(
          sku,
          sku,
          pcode,
          pname,
          vnames,
          variantValuesCSV,
          nameValueJson,
          uom,
          uomName,
          baseUOM,
          uomFactor,
          pstatus,
          skuStatus,
          uomStatus,
          taxCode
        )
      )
    )
  ),

  VSTACK(HEADER, DATA)
)
```

---

## Inputs & Dependencies

The formula imports data from the spreadsheet corresponding to `MasterFileID` defined in the local `Config` sheet:
1. **`Products`** (`Products!A2:I`): Supplies product name, variant names list, and product status.
2. **`SKUs`** (`SKUs!A2:N`): Supplies the main list of SKU records, variant values, associated UOM codes, tax codes, and SKU status.
3. **`UOMs`** (`UOMs!A2:E`): Supplies the UOM definitions (UOM Name, Base UOM, Conversion Factor, Status).

---

## Columns Produced

The output table matches the following schema:

| Column | Header | Source/Formula | Description |
| :--- | :--- | :--- | :--- |
| 1 | `SKU` | `SKUs` Col 1 | Unique SKU Identifier. |
| 2 | `SKUCode` | `SKUs` Col 1 | Unique SKU Code (duplicate of Col 1 for matching consistency). |
| 3 | `ProductCode` | `SKUs` Col 2 | Parent Product Code. |
| 4 | `ProductName` | `Products` lookup | Name of the parent product. |
| 5 | `VariantNames` | `Products` lookup | Comma-separated list of variant dimensions (e.g. `Color,Size`). |
| 6 | `VariantValues` | `SKUs` Col 3-7 joined | Comma-separated list of variant values matching the dimensions. |
| 7 | `NameValueJson` | Computed JSON | A JSON array containing key-value pairs of the variants, e.g. `[{"variant":"Color","value":"Red"},{"variant":"Size","value":"L"}]`. |
| 8 | `UOMCode` | `SKUs` Col 8 | Unit of Measure identifier. |
| 9 | `UOMName` | `UOMs` lookup | Human-readable name of the UOM. |
| 10 | `BaseUOM` | `UOMs` lookup | Code of the base UOM for conversions. |
| 11 | `UOMConversionFactor` | `UOMs` lookup | Numerical factor for conversion to Base UOM. |
| 12 | `ProductStatus` | `Products` lookup | Status of the parent product. |
| 13 | `SKUStatus` | `SKUs` Col 10 | Status of the specific SKU. |
| 14 | `UOMStatus` | `UOMs` lookup | Status of the specific UOM. |
| 15 | `TaxCode` | `SKUs` Col 9 | Tax Code associated with the SKU. |

---

## Detailed Logic Breakdown

1. **`Config` Lookup**: Finds the `MasterFileID` to load external spreadsheet data.
2. **`QUERY` + `IMPORTRANGE`**: Imports and filters out null rows from `Products`, `SKUs`, and `UOMs` dynamically.
3. **`BYROW` Iteration**: Loops over each SKU in the `SKUs` array to perform contextual lookups and formatting.
4. **JSON Structuring (`NameValueJson`)**:
   - Splitting: Splitting the `VariantNames` list by `,`.
   - Mapping: Mapping over sequence indexes 1 to 5 to pair the variant names with the corresponding raw values (`vvals_raw` indexes 1-5).
   - Text Joining: Filtering out empty spaces and joining the pairs with commas, wrapped in brackets to form a valid JSON array `[...]`.
5. **Lookups**: `VLOOKUP` calls get descriptions and statuses from `Products` and `UOMs` for each SKU code and UOM code.
6. **Output Assembly**: `HSTACK` combines the generated properties into a single row, and `VSTACK` prepends the header row to the compiled records.
