# PriceListInline View

The **PriceListInline View** flattens price lists where SKU-to-price associations are saved as key-value pairs in a JSON object inside a single cell. This formula parses the JSON, flattens it into multiple rows (one row per SKU per price list), and joins the records with corresponding SKU details from the local `SKU` view sheet.

---

## Google Sheet Formula

```excel
=LET(
  MasterFileID, VLOOKUP("MasterFileID",Config!A1:B,2,0),
  PriceListRaw, IMPORTRANGE(MasterFileID, "PriceList!A2:H"),
  PriceLists, IFERROR(FILTER(PriceListRaw, IFERROR(INDEX(PriceListRaw, 0, 1) <> "", FALSE)), {"", "", "", "", "", "", "", ""}),
  REDUCE(
    {"PLCode", "PLName", "Currency", "IsDefault", "SKUCode", "ProductName", "VariantNames", "VariantValues", "UOMCode", "UOMName", "Price", "TaxInclusive", "DiscountTaxPolicy"},
    SEQUENCE(ROWS(PriceLists)),
    LAMBDA(acc, i,
      LET(
        pl_row, INDEX(PriceLists, i, 0),
        pl_code, INDEX(pl_row, 1, 1),
        pl_name, INDEX(pl_row, 1, 2),
        currency, INDEX(pl_row, 1, 4),
        is_default, INDEX(pl_row, 1, 5),
        sku_prices_json, INDEX(pl_row, 1, 6),
        tax_inclusive, INDEX(pl_row, 1, 7),
        discount_tax_policy, INDEX(pl_row, 1, 8),

        IF(
          OR(pl_code = "", sku_prices_json = "", sku_prices_json = "{}", ISBLANK(sku_prices_json)),
          acc,
          LET(
            cleaned, REGEXREPLACE(sku_prices_json, "^\{|\}$", ""),
            pairs, TRANSPOSE(SPLIT(cleaned, ",")),
            
            sku_rows,
            MAP(
              pairs,
              LAMBDA(p,
                LET(
                  sku_code, REGEXEXTRACT(p, """([^""]+)""\s*:"),
                  price, VALUE(REGEXEXTRACT(p, ":\s*(-?\d+\.?\d*)")),

                  pname, IFERROR(VLOOKUP(sku_code, SKU!B:D, 3, FALSE), ""),
                  vnames, IFERROR(VLOOKUP(sku_code, SKU!B:E, 4, FALSE), ""),
                  vvals, IFERROR(VLOOKUP(sku_code, SKU!B:F, 5, FALSE), ""),
                  uom_code, IFERROR(VLOOKUP(sku_code, SKU!B:H, 7, FALSE), ""),
                  uom_name, IFERROR(VLOOKUP(sku_code, SKU!B:I, 8, FALSE), ""),

                  HSTACK(pl_code, pl_name, currency, is_default, sku_code, pname, vnames, vvals, uom_code, uom_name, price, tax_inclusive, discount_tax_policy)
                )
              )
            ),
            VSTACK(acc, sku_rows)
          )
        )
      )
    )
  )
)
```

---

## Inputs & Dependencies

1. **`PriceList`** (`PriceList!A2:H` from Master Spreadsheet): Contains price list metadata, pricing JSON object, tax inclusive flag, and discount tax policy.
2. **`SKU`** (Local View Sheet): Provides ProductName, VariantNames, VariantValues, UOMCode, and UOMName based on the extracted `sku_code`.

---

## Columns Produced

The output table matches the following schema:

| Column | Header | Source/Formula | Description |
| :--- | :--- | :--- | :--- |
| 1 | `PLCode` | `PriceListRaw` Col 1 | Price list code/identifier. |
| 2 | `PLName` | `PriceListRaw` Col 2 | Price list name. |
| 3 | `Currency` | `PriceListRaw` Col 4 | Price list currency (e.g. `USD`, `INR`). |
| 4 | `IsDefault` | `PriceListRaw` Col 5 | Boolean indicator specifying if this is the default price list. |
| 5 | `SKUCode` | Extracted from JSON key | SKU Code parsed from the JSON object. |
| 6 | `ProductName` | `SKU` lookup | Parent Product Name. |
| 7 | `VariantNames` | `SKU` lookup | Comma-separated list of variant dimensions. |
| 8 | `VariantValues` | `SKU` lookup | Comma-separated list of variant values. |
| 9 | `UOMCode` | `SKU` lookup | Code of the UOM. |
| 10 | `UOMName` | `SKU` lookup | Name of the UOM. |
| 11 | `Price` | Extracted from JSON value | Price associated with this SKU in this price list (converted to numeric). |
| 12 | `TaxInclusive` | `PriceListRaw` Col 7 | Boolean indicator specifying if the pricing is tax inclusive. |
| 13 | `DiscountTaxPolicy` | `PriceListRaw` Col 8 | Discount tax policy (e.g. `POST_TAX`). |

---

## Detailed Logic Breakdown

1. **`IMPORTRANGE` + `FILTER`**: Imports raw price list rows, filtering out blank entries.
2. **`REDUCE` Loop**: Accumulates table rows. The accumulator starting value is the header row `{ "PLCode", ... }`.
3. **JSON Parsing & Splitting**:
   - **`REGEXREPLACE`**: Removes leading `{` and trailing `}` braces from the JSON text `sku_prices_json`.
   - **`SPLIT` + `TRANSPOSE`**: Splits the remaining string by `,` and transposes it to get a vertical array of pairs, e.g. `"sku_1":10.5`.
4. **Key-Value Extraction**:
   - **`REGEXEXTRACT(p, """([^""]+)""\s*:")`**: Extracts the SKU string from the quotes before the colon.
   - **`REGEXEXTRACT(p, ":\s*(-?\d+\.?\d*)")`**: Extracts the numeric price string after the colon, which is then parsed using `VALUE`.
5. **Details Lookup**: Uses `VLOOKUP` against the local `SKU` view (searching columns B to I) to pull product name, variants, and UOM characteristics.
6. **Stacking Results**: `HSTACK` compiles the row attributes, and `VSTACK` appends them to the accumulated rows (`acc`).
