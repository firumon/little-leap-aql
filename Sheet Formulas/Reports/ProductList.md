# ProductList Report

The **ProductList Report** generates a structured product catalog hierarchy, displaying each parent Product Code and Product Name followed by its associated SKUs and their respective variant combinations (e.g. `Color: Red, Size: L`).

---

## Cell Destination & Input Details

- **Output Destination Cell**: `C10`
- **User Input Dependency**: *None*. This report compiles automatically using available Master Product and SKU databases.

---

## Google Sheet Formula

```excel
=LET(MasterFileID,VLOOKUP("MasterFileID",Config,2,0),
Products,QUERY(IMPORTRANGE(MasterFileID,"Products!A:C"),"where Col1 is not null"),
SKUs,QUERY(IMPORTRANGE(MasterFileID,"SKUs!A:G"),"where Col1 is not null"),
ProductVariants,BYROW(Products,LAMBDA(pRow,LET(Variants,TRIM(INDEX(pRow,,3)),IF(Variants="",{INDEX(pRow,,1),"","","","",""},{INDEX(pRow,,1),SPLIT(Variants,",")})))),
SKUVariants,BYROW(SKUs,LAMBDA(sRow,LET(PCode,INDEX(sRow,,2),Variants,FILTER(ProductVariants,INDEX(ProductVariants,,1)=PCode),{INDEX(sRow,,1),TEXTJOIN(", ",TRUE,MAP(SEQUENCE(1,5,2),LAMBDA(idx,IF(INDEX(Variants,,idx)="",,INDEX(Variants,,idx) & ": " & IFERROR(INDEX(sRow,,idx+1),)))))}))),
ProductSKUs,BYROW(Products,LAMBDA(pRow,LET(pCode,INDEX(pRow,,1),HSTACK(pCode,TRANSPOSE(FILTER(INDEX(SKUs,,1),INDEX(SKUs,,2)=pCode)))))),
REDUCE({"Code","","","","","","","","","","Details"},SEQUENCE(ROWS(Products)-1,1,2),LAMBDA(acc,pIdx,LET(pCode,INDEX(Products,pIdx,1),pSkusRaw,TRANSPOSE(FILTER(ProductSKUs,INDEX(ProductSKUs,,1)=pCode)),pSkus,FILTER(pSkusRaw,INDEX(pSkusRaw,,1)<>""),VSTACK(acc,{ pCode,"","","","","","","","","",INDEX(Products,pIdx,2) }, BYROW(SEQUENCE(ROWS(pSkus)-1,1,2),LAMBDA(rNum,LET(sku,INDEX(pSkus,rNum,1),{ "",sku,"","","","","","","","",VLOOKUP(sku,SKUVariants,2,0) }))))))))
```

---

## Source Sheets & Column Dependencies

The formula imports data from the Master Spreadsheet (`MasterFileID`):
1. **`Products`** (`Products!A:C`):
   - Column 1 (`A`): Product Code (Unique parent identifier)
   - Column 2 (`B`): Product Name
   - Column 3 (`C`): Variant Names (Comma-separated, e.g. `Color,Size`)
2. **`SKUs`** (`SKUs!A:G`):
   - Column 1 (`A`): SKU Code
   - Column 2 (`B`): Parent Product Code
   - Columns 3–7 (`C:G`): Variant values corresponding to the parent's variant dimensions

---

## Detailed Logic Breakdown

1. **Imports & Cleaning**:
   - `Products` and `SKUs` are imported via `IMPORTRANGE` and cleaned of empty rows using `QUERY`.
2. **Variant Parsing (`ProductVariants`)**:
   - Maps through `Products`, splitting the comma-separated variant names (e.g. `Color,Size` -> `{"Color", "Size"}`) for up to 5 dimensions.
3. **SKU Variant Compiling (`SKUVariants`)**:
   - Loops through each SKU in `SKUs`.
   - Filters the parsed variant dimensions for the parent product.
   - Text-joins each variant label with its value (e.g. `Color: Red, Size: L`).
4. **Product-to-SKU Mapping (`ProductSKUs`)**:
   - For each parent product, filters and transposes the list of child SKU codes, grouping them horizontally next to the Product Code.
5. **Hierarchical Reduction (`REDUCE`)**:
   - Starts with the header: `{"Code", "", ..., "", "Details"}` (11 columns).
   - Iterates through each product.
   - Appends a Product Header row: `{ ProductCode, "", ..., "", ProductName }`.
   - Appends child SKU rows nested under the product: `{ "", SKUCode, "", ..., "", VariantString }` looked up from `SKUVariants`.
