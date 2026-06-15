# Consumption Report

The **Consumption Report** generates a comprehensive Consumption Document for a specific stock consumption transaction. It formats the metadata details of the consumption (date, outlet, username, and visit code) and the itemized consumed items list into a printable 39-column layout.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: Cell **`$AB$6`** (Consumption Code).
- **Purpose**: Retrieves details for the outlet consumption record matching this code. If `$AB$6` is blank or invalid, it outputs a warning: `"Please enter a valid Consumption Code in cell AB6."`

---

## Google Sheet Formula

```excel
=LET(
  OutletFileID, VLOOKUP("OutletFileID", Config!A:B, 2, 0),
  MasterFileID, VLOOKUP("masterFileID", Config!A:B, 2, 0),
  SKUFileID, VLOOKUP("ViewFileID", Config!A:B, 2, 0),

  RawConsumptions, IMPORTRANGE(OutletFileID, "OutletConsumptions!A2:Q"),
  RawItems, IMPORTRANGE(OutletFileID, "OutletConsumptionItems!A2:E"),
  RawOutlets, IMPORTRANGE(MasterFileID, "Outlets!A2:B"),
  RawSKUs, IMPORTRANGE(SKUFileID, "SKU!A2:I"),

  RowFn, LAMBDA(idx_val_pairs, MAP(SEQUENCE(1, 39), LAMBDA(col_idx, IFERROR(VLOOKUP(col_idx, idx_val_pairs, 2, FALSE), "")))),
  FormatEpochDateOnly, LAMBDA(val, LET(num, IFERROR(VALUE(val), 0), IF(num > 100000000000, TEXT(25569 + num / 86400000, "yyyy-mm-dd"), val))),

  ConsumptionCodes, TOCOL(CHOOSECOLS(RawConsumptions, 1)),
  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),
  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),

  MatchIdx, IFERROR(MATCH($AB$6, ConsumptionCodes, 0), 0),
  HasOrder, MatchIdx > 0,

  OrderRow, IF(HasOrder, CHOOSEROWS(RawConsumptions, MatchIdx), MAKEARRAY(1, 17, LAMBDA(r, c, ""))),

  ConsumptionDate, CHOOSEROWS(CHOOSECOLS(OrderRow, 3), 1),
  OutletCode, CHOOSEROWS(CHOOSECOLS(OrderRow, 2), 1),
  Username, CHOOSEROWS(CHOOSECOLS(OrderRow, 4), 1),
  OutletVisitCode, CHOOSEROWS(CHOOSECOLS(OrderRow, 5), 1),
  OrderProgress, CHOOSEROWS(CHOOSECOLS(OrderRow, 6), 1),

  OutletName, IF(HasOrder, IFERROR(XLOOKUP(OutletCode, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"), ""),

  DummyRow, RowFn({0, "DUMMY"}),

  FilteredItems, IFERROR(
    FILTER(RawItems, (TOCOL(CHOOSECOLS(RawItems, 2)) = $AB$6) * (TOCOL(CHOOSECOLS(RawItems, 5)) = "Active")),
    MAKEARRAY(1, 5, LAMBDA(r, c, ""))
  ),

  HasItems, AND(HasOrder, CHOOSEROWS(CHOOSECOLS(FilteredItems, 1), 1) <> ""),

  ItemRows, REDUCE(DummyRow, SEQUENCE(ROWS(FilteredItems)), LAMBDA(acc, k, LET(
    item_row, CHOOSEROWS(FilteredItems, k),
    ItemSku, CHOOSEROWS(CHOOSECOLS(item_row, 3), 1),
    ItemQty, CHOOSEROWS(CHOOSECOLS(item_row, 4), 1),

    SKU_Row, XLOOKUP(ItemSku, SKU_Codes, RawSKUs, MAKEARRAY(1, 9, LAMBDA(r, c, ""))),
    ProdName, CHOOSEROWS(CHOOSECOLS(SKU_Row, 4), 1),
    VarValues, CHOOSEROWS(CHOOSECOLS(SKU_Row, 6), 1),
    UOMName, CHOOSEROWS(CHOOSECOLS(SKU_Row, 9), 1),

    Line1, RowFn({6, k & ". " & ProdName; 23, ItemQty & " " & UOMName}),
    Line2, RowFn({7, ItemSku & IF(VarValues <> "", " - " & VarValues, "")}),

    VSTACK(
      acc,
      Line1,
      Line2,
      RowFn({0, ""})
    )
  ))),

  CleanItemRows, IF(
    HasItems,
    CHOOSEROWS(ItemRows, SEQUENCE(ROWS(ItemRows) - 1, 1, 2)),
    RowFn({6, "No items found in this consumption."})
  ),

  FormattedConsumptionDate, FormatEpochDateOnly(ConsumptionDate),

  ReportData, IF(
    HasOrder,
    VSTACK(
      RowFn({4, "Date: " & FormattedConsumptionDate; 23, "Progress: " & OrderProgress}),
      RowFn({4, "User: " & Username; 23, "Visit Code: " & IF(OutletVisitCode <> "", OutletVisitCode, "N/A")}),
      RowFn({4, "Outlet: " & OutletName}),
      RowFn({0, ""}),
      RowFn({4, "CONSUMED ITEMS"}),
      RowFn({0, ""}),
      CleanItemRows
    ),
    VSTACK(
      RowFn({4, "CONSUMPTION DOCUMENT"}),
      RowFn({0, ""}),
      RowFn({4, "Please enter a valid Consumption Code in cell AB6."})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula imports data from three files (using `masterFileID`, `OutletFileID`, and `ViewFileID` from Config):
1. **`OutletConsumptions`** (`OutletConsumptions!A2:Q` in Outlet Spreadsheet):
   - Column 1 (`A`): Consumption Code (matches `$AB$6`)
   - Column 2 (`B`): Outlet Code
   - Column 3 (`C`): Consumption Date
   - Column 4 (`D`): Username
   - Column 5 (`E`): Outlet Visit Code
   - Column 6 (`F`): Order Progress status
   - Column 16 (`P`): Status (`"Active"`)
2. **`OutletConsumptionItems`** (`OutletConsumptionItems!A2:E` in Outlet Spreadsheet):
   - Column 2 (`B`): Outlet Consumption Code (matches `$AB$6`)
   - Column 3 (`C`): SKU Code
   - Column 4 (`D`): Quantity
   - Column 5 (`E`): Record Status (`"Active"`)
3. **`Outlets`** (`Outlets!A2:B` in Master Spreadsheet):
   - Column 1 (`A`): Outlet Code
   - Column 2 (`B`): Outlet Name
4. **`SKU`** (`SKU!A2:I` in Views Spreadsheet):
   - Column 1 (`A`): SKU Code
   - Column 2 (`B`): SKUCode
   - Column 4 (`D`): Product Name
   - Column 6 (`F`): Variant Values
   - Column 9 (`I`): UOM Name

---

## Detailed Logic Breakdown

1. **Order Search**: Matches the Consumption Code in `$AB$6` with `OutletConsumptions`.
2. **Item Filtering & Detail Join**:
   - Filters `OutletConsumptionItems` where consumption code = `$AB$6` and status = `"Active"`.
   - Loops through items:
     - Looks up SKU product description, variant values, and UOM name from the `SKU` view.
     - Renders a multi-row card block for each item (display name and quantity on line 1, SKU code and variant details on line 2).
3. **Output Stacking**: Arranges order details and item cards into a 39-column wide printable layout sheet.
