# OutletConsumptionHistory Report

The **OutletConsumptionHistory Report** calculates consumption counts (KPI Dashboard) and displays a detailed chronological historical log of all stock consumption records and items recorded for a specific outlet.

---

## Cell Destination & Input Details

- **Output Destination Cell**: `A10`
- **User Input Dependency**: Cell **`$AB$6`** (Outlet Code). The formula reads `$AB$6` to filter and summarize consumption history for that specific outlet.

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

  ConsumptionsOutletCode, TOCOL(CHOOSECOLS(RawConsumptions, 2)),
  ConsumptionsProgress, TOCOL(CHOOSECOLS(RawConsumptions, 6)),
  ConsumptionsStatus, TOCOL(CHOOSECOLS(RawConsumptions, 16)),

  SKU_Codes, TOCOL(CHOOSECOLS(RawSKUs, 1)),
  OutletCodes, TOCOL(CHOOSECOLS(RawOutlets, 1)),
  OutletNames, TOCOL(CHOOSECOLS(RawOutlets, 2)),

  Ones, MAP(ConsumptionsOutletCode, LAMBDA(x, 1)),

  PendingInvoiceCount, SUM(IFERROR(FILTER(Ones, (ConsumptionsOutletCode = $AB$6) * (ConsumptionsStatus = "Active") * (ConsumptionsProgress = "PENDING_INVOICE_GENERATION")), 0)),
  InvoiceGeneratedCount, SUM(IFERROR(FILTER(Ones, (ConsumptionsOutletCode = $AB$6) * (ConsumptionsStatus = "Active") * (ConsumptionsProgress = "INVOICE_GENERATED")), 0)),
  CancelledCount, SUM(IFERROR(FILTER(Ones, (ConsumptionsOutletCode = $AB$6) * (ConsumptionsStatus = "Active") * (ConsumptionsProgress = "CANCELLED")), 0)),
  TotalNumber, PendingInvoiceCount + InvoiceGeneratedCount + CancelledCount,

  OutletName, IFERROR(XLOOKUP($AB$6, OutletCodes, OutletNames, "Unknown Outlet"), "Unknown Outlet"),

  Filtered, IFERROR(
    FILTER(
      RawConsumptions,
      (ConsumptionsOutletCode = $AB$6) * (ConsumptionsStatus = "Active")
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

  S_Idx, TOCOL(CHOOSECOLS(SortedData, 1)),

  DummyRow, RowFn({0, "DUMMY"}),

  DashboardRows, VSTACK(
    RowFn({4, "Outlet Code"; 24, "Pending Invoice"; 25, PendingInvoiceCount}),
    RowFn({4, $AB$6; 24, "Invoice Generated"; 25, InvoiceGeneratedCount}),
    RowFn({4, "Outlet Name"; 24, "Cancelled"; 25, CancelledCount}),
    RowFn({4, OutletName}),
    RowFn({4, "Total Consumptions"}),
    RowFn({4, TotalNumber}),
    RowFn({4, "History Generation Date"}),
    RowFn({4, TEXT(NOW(), "yyyy-mm-dd HH:mm:ss")}),
    RowFn({0, ""}),
    RowFn({0, ""})
  ),

  DynamicPart, REDUCE(DummyRow, SEQUENCE(ROWS(SortedData)), LAMBDA(acc, k, LET(
    idx, CHOOSEROWS(S_Idx, k),
    row_arr, CHOOSEROWS(Filtered, idx),

    ConsumptionCode, CHOOSEROWS(CHOOSECOLS(row_arr, 1), 1),
    ConsumptionDate, CHOOSEROWS(CHOOSECOLS(row_arr, 3), 1),
    Username, CHOOSEROWS(CHOOSECOLS(row_arr, 4), 1),
    OrderProgress, CHOOSEROWS(CHOOSECOLS(row_arr, 6), 1),

    FormattedDate, FormatEpochDateOnly(ConsumptionDate),

    ParentRow, RowFn({4, FormattedDate & " / " & ConsumptionCode & " / " & Username; 27, OrderProgress}),

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
      VarValues, CHOOSEROWS(CHOOSECOLS(SKU_Row, 6), 1),
      ItemNameSuffix, IF(VarValues <> "", VarValues, SKU_Code),
      ItemDisplayName, ProdName & IF(ItemNameSuffix <> "", " - " & ItemNameSuffix, ""),

      VSTACK(
        inner_acc,
        RowFn({6, ItemQty & "x"; 7, ItemDisplayName; 27, ItemSku})
      )
    ))),

    CleanItemRows, IF(
      HasItems,
      CHOOSEROWS(ItemRows, SEQUENCE(ROWS(ItemRows) - 1, 1, 2)),
      RowFn({6, "No items found in this consumption."})
    ),

    VSTACK(
      acc,
      ParentRow,
      CleanItemRows,
      RowFn({0, ""})
    )
  ))),

  ReportData, IF(
    HasData,
    VSTACK(
      DashboardRows,
      CHOOSEROWS(DynamicPart, SEQUENCE(ROWS(DynamicPart) - 1, 1, 2))
    ),
    VSTACK(
      DashboardRows,
      RowFn({4, "No consumption records found for this outlet."})
    )
  ),

  ReportData
)
```

---

## Source Sheets & Column Dependencies

The formula imports data from three files (using `masterFileID`, `OutletFileID`, and `ViewFileID` from Config):
1. **`OutletConsumptions`** (`OutletConsumptions!A2:Q` in Outlet Spreadsheet):
   - Column 2 (`B`): Outlet Code (compared with `$AB$6`)
   - Column 3 (`C`): Consumption Date
   - Column 4 (`D`): Username
   - Column 6 (`F`): Order Progress status (`"PENDING_INVOICE_GENERATION"`, `"INVOICE_GENERATED"`, `"CANCELLED"`)
   - Column 16 (`P`): Status (`"Active"`)
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

1. **Dashboard Calculations**:
   - `PendingInvoiceCount`: Counts active, pending invoice consumptions.
   - `InvoiceGeneratedCount`: Counts active, invoice generated consumptions.
   - `CancelledCount`: Counts active, cancelled consumptions.
2. **Dashboard Output**: Generates structured KPI labels and counts for the dashboard header.
3. **Chronological Sorting**: Retrieves and sorts the consumption records for the outlet code `$AB$6` by date descending.
4. **Consumption Record Accumulator (`REDUCE`)**:
   - Loops through each sorted consumption order.
   - Appends a Parent Row showing the date, code, and username in a single merged string `FormattedDate & " / " & ConsumptionCode & " / " & Username` starting at Column D (index 4), and progress status at Column AA (index 27).
   - Filters `OutletConsumptionItems` for active item entries under that consumption code.
   - Resolves item descriptions from the `SKU` view.
   - Appends item description rows detailing quantity, display name, and SKU.
5. **Final Assembly**: Stacks the KPI dashboard header rows and dynamic consumption records into a 39-column wide report array.
