# ConsumptionRecords Report

The **ConsumptionRecords Report** provides a filtered search and checklist log for Outlet Consumptions. It filters consumption records by username and date, sorting by date descending, and displays item details and order progress statuses for each record, nesting child items under each consumption record.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A15`
- **User Input Dependencies**:
  - Cell **`$J$11`**: Username Filter (supports specific username or `"Any User"` / blank for no filter).
  - Cell **`$J$12`**: Consumption Date Filter (supports specific date or `"All Date"` / blank for no filter).
- **Default Behavior**: If no filters are active, the report displays the **latest 15 consumption records**. No section heading blocks are prepended.

---

## Google Sheet Formula

```excel
=LET(
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),
  SKUFileID, VLOOKUP("ViewFileID", Config!A:B, 2, 0),
  MasterFileID, VLOOKUP("masterFileID", Config!A:B, 2, 0),

  RawConsumptions, IMPORTRANGE(OutletFileID, "OutletConsumptions!A2:Q"),
  RawItems, IMPORTRANGE(OutletFileID, "OutletConsumptionItems!A2:E"),
  RawSKUs, IMPORTRANGE(SKUFileID, "SKU!A2:G"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
  FormatEpochDateOnly, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd"), val))),

  UserFilter, IF(OR($J$11 = "", $J$11 = "Any User"), "", $J$11),
  DateFilter, IF(OR($J$12 = "", $J$12 = "All Date"), "", $J$12),

  HasInput, OR(UserFilter <> "", DateFilter <> ""),

  ConsumptionsCode, TOCOL(CHOOSECOLS(RawConsumptions, 1)),
  ConsumptionsDate, TOCOL(CHOOSECOLS(RawConsumptions, 3)),
  ConsumptionsOutletCode, TOCOL(CHOOSECOLS(RawConsumptions, 2)),
  ConsumptionsRequestedUser, TOCOL(CHOOSECOLS(RawConsumptions, 4)),
  ConsumptionsProgress, TOCOL(CHOOSECOLS(RawConsumptions, 6)),
  ConsumptionsStatus, TOCOL(CHOOSECOLS(RawConsumptions, 16)),

  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),

  ParsedDates, MAP(ConsumptionsDate, LAMBDA(d, IFERROR(IF(ISNUMBER(d), d, DATEVALUE(LEFT(d, 10))), 0))),
  ParsedDateFilter, IFERROR(IF(ISNUMBER(DateFilter), DateFilter, DATEVALUE(LEFT(DateFilter, 10))), 0),

  Filtered, IFERROR(
    FILTER(
      RawConsumptions,
      (ConsumptionsStatus = "Active") *
      (IF(
        HasInput,
        ((UserFilter = "") + (ConsumptionsRequestedUser = UserFilter)) *
        ((DateFilter = "") + (ParsedDates = ParsedDateFilter)),
        SEQUENCE(ROWS(RawConsumptions))*0 + 1
      ))
    ),
    MAKEARRAY(1, 17, LAMBDA(r, c, ""))
  ),

  FirstCell, CHOOSEROWS(CHOOSECOLS(Filtered, 1), 1),
  HasData, AND(NOT(ISERR(Filtered)), FirstCell <> ""),

  F_Date, IF(HasData, TOCOL(CHOOSECOLS(Filtered, 3)), TODAY()),
  F_ParsedDate, MAP(F_Date, LAMBDA(d, IFERROR(IF(ISNUMBER(d), d, DATEVALUE(LEFT(d, 10))), TODAY()))),

  F_Indices, SEQUENCE(ROWS(Filtered)),
  F_Data, HSTACK(F_Indices, F_ParsedDate),
  SortedData, SORT(F_Data, 2, FALSE),

  LimitRows, IF(HasInput, ROWS(SortedData), MIN(15, ROWS(SortedData))),
  SortedDataLimited, CHOOSEROWS(SortedData, SEQUENCE(LimitRows)),

  S_Idx, TOCOL(CHOOSECOLS(SortedDataLimited, 1)),

  DummyRow, RowFn({0, "DUMMY"}),

  DynamicPart, REDUCE(DummyRow, SEQUENCE(LimitRows), LAMBDA(acc, k, LET(
    idx, CHOOSEROWS(S_Idx, k),
    row_arr, CHOOSEROWS(Filtered, idx),

    ConsumptionCode, CHOOSEROWS(CHOOSECOLS(row_arr, 1), 1),
    ConsumptionDate, CHOOSEROWS(CHOOSECOLS(row_arr, 3), 1),
    OutletCode, CHOOSEROWS(CHOOSECOLS(row_arr, 2), 1),
    Username, CHOOSEROWS(CHOOSECOLS(row_arr, 4), 1),
    OrderProgress, CHOOSEROWS(CHOOSECOLS(row_arr, 6), 1),

    OutletName, IFERROR(XLOOKUP(OutletCode, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"),
    FormattedDate, FormatEpochDateOnly(ConsumptionDate),

    Row_1, RowFn({4, FormattedDate & " / " & ConsumptionCode & " / " & Username; 29, OrderProgress}),
    Row_2, RowFn({4, OutletName}),

    ItemMatches, IFERROR(
      FILTER(RawItems, (TOCOL(CHOOSECOLS(RawItems, 2)) = ConsumptionCode) * (TOCOL(CHOOSECOLS(RawItems, 5)) = "Active")),
      MAKEARRAY(1, 5, LAMBDA(r, c, ""))
    ),
    HasItems, CHOOSEROWS(CHOOSECOLS(ItemMatches, 1), 1) <> "",

    ItemRows, REDUCE(DummyRow, SEQUENCE(IF(HasItems, ROWS(ItemMatches), 1)), LAMBDA(inner_acc, item_k, LET(
      item_row, CHOOSEROWS(ItemMatches, item_k),
      ItemSku, CHOOSEROWS(CHOOSECOLS(item_row, 3), 1),
      ItemQty, CHOOSEROWS(CHOOSECOLS(item_row, 4), 1),

      SKU_Row, XLOOKUP(ItemSku, SKU_Codes, RawSKUs, MAKEARRAY(1, 7, LAMBDA(r, c, ""))),
      ProdName, CHOOSEROWS(CHOOSECOLS(SKU_Row, 4), 1),
      SKU_Code, CHOOSEROWS(CHOOSECOLS(SKU_Row, 2), 1),
      VariantValues, CHOOSEROWS(CHOOSECOLS(SKU_Row, 6), 1),
      ItemNameSuffix, IF(VariantValues <> "", VariantValues, SKU_Code),
      ItemDisplayName, ProdName & IF(ItemNameSuffix <> "", " - " & ItemNameSuffix, ""),

      VSTACK(
        inner_acc,
        RowFn({6, ItemQty & "x"; 7, ItemDisplayName; 29, ItemSku; 37, "  "})
      )
    ))),

    CleanItemRows, IF(
      HasItems,
      CHOOSEROWS(ItemRows, SEQUENCE(MAX(1, ROWS(ItemRows) - 1), 1, 2)),
      RowFn({6, "No items found in this consumption."})
    ),

    VSTACK(
      acc,
      Row_1,
      Row_2,
      CleanItemRows,
      RowFn({0, ""})
    )
  ))),

  FallbackText, IF(HasInput, "No consumption records matched the selected filters.", "No active consumption records found."),

  ReportData, IF(
    HasData,
    CHOOSEROWS(DynamicPart, SEQUENCE(MAX(1, ROWS(DynamicPart) - 1), 1, 2)),
    RowFn({4, FallbackText})
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula queries three spreadsheet files via Config parameters (`OutletFileID`, `ViewFileID`, `masterFileID`):
1. **`OutletConsumptions`** (`OutletConsumptions!A2:Q` in Outlet Spreadsheet):
   - Column 1 (`A`): Consumption Code
   - Column 2 (`B`): Outlet Code
   - Column 3 (`C`): Date
   - Column 4 (`D`): Username (compared to `$J$11`)
   - Column 6 (`F`): Order Progress status
   - Column 16 (`P`): Record status (`"Active"`)
2. **`OutletConsumptionItems`** (`OutletConsumptionItems!A2:E` in Outlet Spreadsheet):
   - Column 2 (`B`): Outlet Consumption Code (linked to parent)
   - Column 3 (`C`): SKU Code
   - Column 4 (`D`): Quantity
   - Column 5 (`E`): Record Status (`"Active"`)
3. **`Outlets`** (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name
4. **`SKU`** (`SKU!A2:G` in Views Spreadsheet):
   - Column 1 (`A`): SKU Code
   - Column 2 (`B`): SKUCode
   - Column 4 (`D`): Product Name
   - Column 6 (`F`): Variant Values

---

## Detailed Logic Breakdown

1. **User Filter Inputs**: Resolves filters from cells `$J$11` (User) and `$J$12` (Date). Checks if they represent default empty states like `"Any User"` or `"All Date"`.
2. **Dynamic Filtering**:
   - Parses dates into system serial numbers.
   - Filters `OutletConsumptions` for rows matching the specified search parameters.
   - If no input filters are active (`HasInput` is false), the search logic is bypassed, returning all active records.
3. **Chronological Sorting & Limits**:
   - Sorts records by date in descending order (newest first).
   - If search inputs are active, lists all matching records. If inactive, limits the output array to the **latest 15 rows**.
4. **Reduction accumulator (`REDUCE`)**:
   - Loops through each filtered consumption record.
   - Adds order header rows:
     - Row 1: date, code, and username merged in a single string `FormattedDate & " / " & ConsumptionCode & " / " & Username` starting at Column D (index 4), and progress status at Column AC (index 29).
     - Row 2: outlet name starting at Column D (index 4).
   - Filters and displays corresponding items under that consumption code from `OutletConsumptionItems`.
   - Looks up descriptions from `SKU` view.
   - Outputs a blank space between records.
5. **Final Output Assembly**: Outputs only the dynamic records, omitting any report heading strings.
